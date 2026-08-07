-- Fix merge_persons() passos 6, 7, 8 e 10 — últimos 4 gaps mapeados na
-- auditoria completa (passo 1 a 14) feita em 20260807220000. Mesma causa:
-- schema drift acumulado desde a última atualização real de merge_persons
-- (origem em 20260310110000_merge_persons_full_reparent-ok.sql), nunca
-- propagado depois de renomeações/consolidações de tabelas.
--
-- Evidência de cada caso (origem investigada nas migrations locais, não
-- assumida):
--
-- Passo 6 — lp_submissions: RENOMEADA para form_pro_submissions em
-- 20260310000000_form_pro_drop_lp_pages-ok.sql linha 40
-- (`ALTER TABLE IF EXISTS lp_submissions RENAME TO form_pro_submissions`).
-- O header da própria migration já classificava lp_submissions como
-- "CRM-facing (UTM, ip, lead_id)" — é a tabela real de submissions do CRM,
-- só mudou de nome. Confirmado via information_schema que
-- form_pro_submissions.people_id existe (uuid, nullable) — mesma coluna,
-- sem rename de coluna, só de tabela.
--
-- Passo 7 — lp_form_submissions: DROP intencional na mesma migration
-- (20260310000000, linha 29), classificada no header como "Page tracking
-- (session_id, visitor_id) — NOT the CRM table". Nunca foi uma tabela ligada
-- a pessoa/contato — era tracking de sessão de página, sem equivalente.
-- Passo removido (mesmo padrão do call_pro_calls em 20260807210000).
--
-- Passo 8 — sends_contacts: tabela não existe mais no banco
-- (to_regclass('public.sends_contacts') = NULL, confirmado). Nenhuma
-- migration de rename explícita foi encontrada, mas sends_people (criada em
-- 20251108195513, ANTES de sends_contacts em 20251110183840) tem exatamente
-- o schema equivalente esperado por este passo: send_id, people_id, lead_id,
-- status, sent_at, delivered_at, read_at, created_at, updated_at — e é a
-- tabela que de fato existe hoje e é usada por BLOCK 6 (marketing) de
-- get_insights_context. Aponta para sends_people, coluna people_id (mesmo
-- nome).
-- ATENÇÃO (achado separado, NÃO corrigido aqui): 6 arquivos do frontend
-- (src/hooks/useSendContacts.ts, useSendMutations.ts, useResetSendStats.ts,
-- useSendContactMutations.ts, useDeletarPessoa.ts,
-- src/components/disparos/TabelaContatos.tsx) ainda fazem
-- .from('sends_contacts') — a tela de contatos de Disparos está
-- provavelmente quebrada em produção pelo mesmo drift. Fora de escopo desta
-- migration (fix de frontend é decisão de produto); reportado ao
-- coordenador.
--
-- Passo 10 — meeting_followup_queue: bug de nomenclatura (não tabela
-- ausente). A coluna real é person_id, não people_id (confirmado via
-- information_schema.columns: id, rule_id, meeting_id, person_id, leads_id,
-- ...). Troca simples de nome de coluna no UPDATE.

CREATE OR REPLACE FUNCTION public.merge_persons(p_canonical_id uuid, p_duplicate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_canonical  public.clients_people%ROWTYPE;
  v_duplicate  public.clients_people%ROWTYPE;
  v_msg_count      INT := 0;
  v_lead_count     INT := 0;
  v_meeting_count  INT := 0;
  v_merge_event    JSONB;
BEGIN
  SELECT * INTO v_canonical FROM public.clients_people WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clients_people WHERE id = p_duplicate_id FOR UPDATE;

  IF v_canonical.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: canonical_id % not found', p_canonical_id;
  END IF;
  IF v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: duplicate_id % not found', p_duplicate_id;
  END IF;
  IF v_duplicate.status = 'merged' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already merged');
  END IF;

  -- 1. Messages
  UPDATE public.messages
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  -- 2. Leads (negócios)
  UPDATE public.leads
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_lead_count = ROW_COUNT;

  -- 3. Meetings (agendamentos)
  UPDATE public.meetings
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_meeting_count = ROW_COUNT;

  -- 4. Calls: removido em 20260807210000 — call_pro_calls foi dropada
  -- (módulo de telefonia legado descontinuado em 20260609000000).

  -- 5. Company associations — avoid (people_id, company_id) duplicates
  --    (updated_at removido em 20260807220000 — clients_people_companies não tem essa coluna)
  INSERT INTO public.clients_people_companies (people_id, company_id, role, is_primary, created_at)
  SELECT p_canonical_id, company_id, role, is_primary, created_at
  FROM   public.clients_people_companies
  WHERE  people_id = p_duplicate_id
    AND  company_id NOT IN (
           SELECT company_id FROM public.clients_people_companies
           WHERE  people_id = p_canonical_id
             AND  company_id IS NOT NULL
         );

  DELETE FROM public.clients_people_companies
  WHERE people_id = p_duplicate_id;

  -- 6. Form Pro submissions (lp_submissions foi renomeada para
  -- form_pro_submissions em 20260310000000_form_pro_drop_lp_pages-ok.sql;
  -- coluna people_id preservada)
  UPDATE public.form_pro_submissions
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 7. lp_form_submissions: removido — dropada intencionalmente na mesma
  -- migration 20260310000000 (era tracking de página por session_id/
  -- visitor_id, nunca foi tabela de CRM ligada a pessoa).

  -- 8. Sends (sends_contacts não existe mais; sends_people é a tabela
  -- equivalente que existe de fato, mesma coluna people_id)
  UPDATE public.sends_people
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 9. Followup queue (column name: person_id)
  UPDATE public.followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 10. Meeting followup queue (coluna real é person_id, não people_id)
  UPDATE public.meeting_followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 11. Message buffer
  UPDATE public.message_buffer
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 12. AI agent execution log
  UPDATE public.ai_agents_execution_log
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 13. Merge identity fields to canonical (keep existing, fill from duplicate)
  UPDATE public.clients_people SET
    email              = COALESCE(email,              v_duplicate.email),
    document           = COALESCE(document,           v_duplicate.document),
    whatsapp           = COALESCE(whatsapp,           v_duplicate.whatsapp),
    telefone           = COALESCE(telefone,           v_duplicate.telefone),
    instagram_user_id  = COALESCE(instagram_user_id,  v_duplicate.instagram_user_id),
    instagram_id       = COALESCE(instagram_id,       v_duplicate.instagram_id),
    instagram_handle   = COALESCE(instagram_handle,   v_duplicate.instagram_handle),
    name = CASE
      WHEN name IN ('WhatsApp User', 'Instagram User', '') THEN COALESCE(NULLIF(v_duplicate.name, ''), name)
      ELSE name
    END,
    merge_history = merge_history || jsonb_build_array(
      jsonb_build_object(
        'merged_at',       NOW(),
        'duplicate_id',    p_duplicate_id,
        'duplicate_name',  v_duplicate.name,
        'messages_moved',  v_msg_count,
        'leads_moved',     v_lead_count,
        'meetings_moved',  v_meeting_count
      )
    ),
    updated_at = NOW()
  WHERE id = p_canonical_id;

  -- 14. Mark duplicate as merged
  UPDATE public.clients_people SET
    status         = 'merged',
    merged_into_id = p_canonical_id,
    updated_at     = NOW()
  WHERE id = p_duplicate_id;

  v_merge_event := jsonb_build_object(
    'canonical_id',   p_canonical_id,
    'duplicate_id',   p_duplicate_id,
    'messages_moved', v_msg_count,
    'leads_moved',    v_lead_count,
    'meetings_moved', v_meeting_count
  );

  RETURN v_merge_event;
END;
$function$;
