-- =============================================================================
-- Migration: 20260725180000_altiora_email_queue.sql
-- Tabela de log de e-mails inbound Altiora
--
-- Usada pela edge function `altiora-email-referral-inbound` para:
--   - Deduplicação por message_id (evita processar o mesmo e-mail 2x)
--   - Registro de e-mails processados, pendentes e rejeitados
--   - Auditoria de tentativas não autorizadas
--
-- Casos de uso cobertos: UC10 (ALTIORA-05)
-- =============================================================================

BEGIN;

-- ── 1. Tabela principal ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.altiora_email_queue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificador único do e-mail (header Message-ID) — base da deduplicação
  message_id        text        NOT NULL,

  -- Status de processamento
  status            text        NOT NULL DEFAULT 'processed',

  -- Remetente do e-mail
  from_email        text,
  from_name         text,

  -- Destinatários (To + CC) — JSON array de strings
  recipients        jsonb       DEFAULT '[]'::jsonb,

  -- Dados extraídos do corpo do e-mail
  client_name       text,
  client_email      text,
  client_phone      text,
  subject           text,

  -- Corpo bruto do e-mail (primeiros 10k chars)
  body_preview      text,

  -- Lead criado a partir deste e-mail (null se rejeitado/pendente)
  lead_id           uuid        REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Motivo de pendência ou rejeição
  reason            text,

  -- Metadados extras (payload original parcial)
  metadata          jsonb,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Constraints ────────────────────────────────────────────────────────────

-- Deduplicação: um message_id processado uma única vez
ALTER TABLE public.altiora_email_queue
  ADD CONSTRAINT altiora_email_queue_message_id_uq UNIQUE (message_id);

-- Domínio de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'altiora_email_queue'
      AND constraint_name = 'altiora_email_queue_status_check'
  ) THEN
    ALTER TABLE public.altiora_email_queue
      ADD CONSTRAINT altiora_email_queue_status_check
      CHECK (status IN ('processed', 'pending_validation', 'rejected', 'duplicate'));
  END IF;
END;
$$;

-- ── 3. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_altiora_email_queue_status
  ON public.altiora_email_queue(status);

CREATE INDEX IF NOT EXISTS idx_altiora_email_queue_created_at
  ON public.altiora_email_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_altiora_email_queue_lead_id
  ON public.altiora_email_queue(lead_id)
  WHERE lead_id IS NOT NULL;

-- ── 4. Trigger updated_at ─────────────────────────────────────────────────────

CREATE TRIGGER altiora_email_queue_updated_at
  BEFORE UPDATE ON public.altiora_email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_email_queue ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total (edge functions usam service role)
CREATE POLICY "service_role_all" ON public.altiora_email_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuários autenticados podem ver (gestores e admins)
CREATE POLICY "authenticated_select" ON public.altiora_email_queue
  FOR SELECT TO authenticated USING (true);

-- ── 6. Comentários ───────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_email_queue IS
  'Log de e-mails inbound Altiora — deduplicação e auditoria (UC10)';

COMMENT ON COLUMN public.altiora_email_queue.message_id IS
  'Header Message-ID do e-mail — chave de deduplicação (UNIQUE)';

COMMENT ON COLUMN public.altiora_email_queue.status IS
  'processed | pending_validation | rejected | duplicate';

COMMENT ON COLUMN public.altiora_email_queue.lead_id IS
  'Lead criado a partir deste e-mail — null se rejeitado ou pendente';

COMMIT;
