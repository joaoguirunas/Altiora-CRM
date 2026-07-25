-- ══════════════════════════════════════════════════════════════════════════════
-- FIX-SENDS-STATUS-BRIDGE-01 — AC3 + AC4
-- Trigger: messages.status → sends_contacts (campaign messages only)
--
-- Contexto: whatsapp-inbound já processa statuses[] da Meta e atualiza
-- messages.status / delivered_at / read_at (FIX-WA-STATUS-WEBHOOK-01).
-- Este trigger fecha o segundo trecho: propaga para sends_contacts quando
-- a mensagem veio de uma campanha (source_type = 'campaign').
--
-- Lógica de dispatch:
--   messages.source_type = 'campaign' AND module_ref_id IS NOT NULL
--   → send_id = messages.module_ref_id
--   → sends_contacts WHERE send_id = module_ref_id AND people_id = messages.people_id
--
-- STATUS_RANK (AC4 — monotônico, nunca regride):
--   pending=0 < sent=1 < delivered=2 < read=3 | error=99 (terminal)
--   'error' substitui qualquer estado < read (marketing cap, opt-out, etc.)
--   'read' nunca vira 'error' (se o usuário leu, a entrega foi bem-sucedida)
--
-- Rollback: supabase/migrations/rollbacks/20260725270000_messages_to_sends_contacts_bridge.rollback.sql
--
-- Pré-condições verificadas (schema audit 2026-07-25):
--   messages.source_type      — existe, inclui 'campaign'
--   messages.module_ref_id    — existe, uuid (fix 20260317000000)
--   messages.people_id        — existe, uuid
--   messages.metadata         — existe, jsonb (re-adicionado em 20260430140000)
--   sends_contacts.send_id    — existe, uuid FK → sends
--   sends_contacts.people_id  — existe, uuid FK → clients_people ON DELETE SET NULL
--   sends_contacts.status     — existe, CHECK ('pending','sent','delivered','read','error')
--   sends_contacts.delivered_at / read_at / error_message — existem
--   NOTA: sends_contacts NÃO tem updated_at — não usar nos UPDATEs
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Índice composto para lookup eficiente no trigger ─────────────────────
-- O trigger faz WHERE send_id = X AND people_id = Y.
-- Já existem idx_sends_contacts_send_id e idx_sends_contacts_people_id separados,
-- mas o composto elimina double-lookup para campanhas grandes (100+ msgs/min).
CREATE INDEX IF NOT EXISTS idx_sends_contacts_send_people
  ON public.sends_contacts (send_id, people_id);


-- ─── 2. Função de trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_messages_to_sends_contacts_bridge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur_status  text;
  v_cur_rank    int;
  v_new_rank    int;
  v_error_msg   text;
BEGIN
  -- Guard: somente mensagens de campanha com send_id preenchido.
  -- WHEN clause no CREATE TRIGGER já filtra na maioria dos casos,
  -- mas checamos novamente por segurança (ex: re-fire em futuro refactor).
  IF NEW.source_type <> 'campaign' OR NEW.module_ref_id IS NULL OR NEW.people_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guard: somente transições relevantes para entrega.
  IF NEW.status NOT IN ('delivered', 'read', 'error') THEN
    RETURN NEW;
  END IF;

  -- Buscar estado atual do sends_contacts correspondente.
  SELECT status
    INTO v_cur_status
    FROM public.sends_contacts
   WHERE send_id   = NEW.module_ref_id
     AND people_id = NEW.people_id
   LIMIT 1;

  -- R4: sem linha em sends_contacts → no-op (contato removido manualmente).
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- STATUS_RANK — mesma lógica do whatsapp-inbound (STATUS_RANK no TS).
  v_new_rank := CASE NEW.status
    WHEN 'pending'   THEN 0
    WHEN 'sent'      THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'read'      THEN 3
    WHEN 'error'     THEN 99
    ELSE -1
  END;

  v_cur_rank := CASE v_cur_status
    WHEN 'pending'   THEN 0
    WHEN 'sent'      THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'read'      THEN 3
    WHEN 'error'     THEN 99
    ELSE -1
  END;

  -- Monotônico para não-error: nunca regredir read → delivered → sent.
  IF NEW.status <> 'error' AND v_new_rank <= v_cur_rank THEN
    RETURN NEW;
  END IF;

  -- Error é terminal mas não sobrescreve 'read' (usuário leu → entrega ok).
  IF NEW.status = 'error' AND v_cur_rank >= 3 THEN
    RETURN NEW;
  END IF;

  -- ─── Aplicar propagação ───────────────────────────────────────────────────

  IF NEW.status = 'delivered' THEN
    UPDATE public.sends_contacts
       SET status       = 'delivered',
           delivered_at = COALESCE(NEW.delivered_at, now())
     WHERE send_id   = NEW.module_ref_id
       AND people_id = NEW.people_id;

  ELSIF NEW.status = 'read' THEN
    -- 'read' implica 'delivered' — backfill delivered_at se Meta pulou o evento.
    UPDATE public.sends_contacts
       SET status       = 'read',
           delivered_at = COALESCE(delivered_at, NEW.delivered_at, now()),
           read_at      = COALESCE(NEW.read_at, now())
     WHERE send_id   = NEW.module_ref_id
       AND people_id = NEW.people_id;

  ELSIF NEW.status = 'error' THEN
    -- Extrair mensagem de erro do metadata (gravado por handleStatusUpdates).
    v_error_msg := COALESCE(
      NEW.metadata -> 'delivery_error' ->> 'title',
      'Meta delivery failure'
    );
    UPDATE public.sends_contacts
       SET status        = 'error',
           error_message = v_error_msg
     WHERE send_id   = NEW.module_ref_id
       AND people_id = NEW.people_id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Erros no trigger nunca bloqueiam o processamento da mensagem principal.
  RAISE WARNING 'fn_messages_to_sends_contacts_bridge: message id=%, error: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


-- ─── 3. Trigger com WHEN clause para filtro eficiente ───────────────────────
-- WHEN clause executada pelo executor antes de chamar a função — evita overhead
-- para os ~95% de mensagens que não são campaigns com status de entrega.
DROP TRIGGER IF EXISTS trg_messages_to_sends_contacts ON public.messages;

CREATE TRIGGER trg_messages_to_sends_contacts
  AFTER UPDATE OF status ON public.messages
  FOR EACH ROW
  WHEN (
    NEW.status IS DISTINCT FROM OLD.status
    AND NEW.source_type = 'campaign'
    AND NEW.module_ref_id IS NOT NULL
    AND NEW.people_id IS NOT NULL
    AND NEW.status IN ('delivered', 'read', 'error')
  )
  EXECUTE FUNCTION public.fn_messages_to_sends_contacts_bridge();

COMMIT;


-- ─── Smoke-test pós-apply ────────────────────────────────────────────────────
-- Confirmar que o trigger e a função foram criados:
--
-- SELECT trigger_name, event_manipulation, action_timing
--   FROM information_schema.triggers
--  WHERE trigger_name = 'trg_messages_to_sends_contacts'
--    AND event_object_table = 'messages';
-- -- Esperado: 1 row (UPDATE, AFTER)
--
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_schema = 'public'
--    AND routine_name = 'fn_messages_to_sends_contacts_bridge';
-- -- Esperado: 1 row
--
-- Confirmar índice criado:
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'sends_contacts'
--    AND indexname = 'idx_sends_contacts_send_people';
-- -- Esperado: 1 row
--
-- Smoke-test de propagação (simulado com UPDATE direto):
-- -- Assumindo uma mensagem de campanha existente com source_type='campaign':
-- UPDATE public.messages
--   SET status = 'delivered', delivered_at = now()
--  WHERE source_type = 'campaign' AND module_ref_id IS NOT NULL
--  LIMIT 1;
-- -- Verificar que sends_contacts correspondente ganhou status='delivered' e delivered_at IS NOT NULL.
