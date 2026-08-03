-- ══════════════════════════════════════════════════════════════════════════════
-- Meeting Flow Complete Fix
-- Resolve: "column channel does not exist" ao criar reunião
--
-- CAUSA RAIZ:
--   O trigger trg_meeting_followup_queue faz SELECT channel, webhook_url
--   FROM meetings_followups, mas essas colunas nunca foram aplicadas neste banco.
--   Além disso, meeting_followup_queue e followup_queue não existem.
--
-- GAPS CORRIGIDOS:
--   1. meetings_followups — adiciona colunas ausentes:
--        channel, webhook_url, name, source, whatsapp_template_id,
--        control, as_queue_id, business_hours_only, bh_only_last
--   2. meeting_followup_queue — cria tabela (trigger depende dela)
--   3. followup_queue — cria tabela (hooks useFollowupQueue + stage trigger)
--
-- IDEMPOTENTE: usa ADD COLUMN IF NOT EXISTS e CREATE TABLE IF NOT EXISTS
-- SEM BEGIN/COMMIT: auto-commit por statement (evita problema de transação aberta)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. meetings_followups — colunas ausentes ─────────────────────────────────

-- channel: usado pelo trigger handle_meeting_followup_queue
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('email', 'sms', 'whatsapp', 'phone'));

-- webhook_url: usado pelo trigger e pelo hook useCallProFollowups
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS webhook_url text;

-- name: label da regra
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS name text;

-- source: discriminador channel vs webhook (FWUP-02)
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'channel'
    CHECK (source IN ('webhook', 'channel'));

-- whatsapp_template_id: FK para templates WhatsApp
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid
    REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

-- control: controle de ordem (legado)
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS control integer;

-- as_queue_id: referência para ActiveSend queue
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS as_queue_id text;

-- business_hours_only: respeitar horário comercial
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS business_hours_only boolean NOT NULL DEFAULT false;

-- bh_only_last: aplicar bh_only apenas no último follow-up
ALTER TABLE public.meetings_followups
  ADD COLUMN IF NOT EXISTS bh_only_last boolean NOT NULL DEFAULT true;

-- ─── 2. meeting_followup_queue — cria tabela se não existir ──────────────────
-- Esta tabela é destino de INSERT do trigger trg_meeting_followup_queue.
-- Sem ela, qualquer INSERT em meetings resulta em erro de relação inexistente.

CREATE TABLE IF NOT EXISTS public.meeting_followup_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          uuid        NOT NULL REFERENCES public.meetings_followups(id) ON DELETE CASCADE,
  meeting_id       uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  -- person_id e leads_id: nomes canonicos pós-rename (o trigger usa person_id e leads_id)
  person_id        uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  leads_id         uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  scheduled_for    timestamptz NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  channel          text        NOT NULL,
  webhook_url      text        NOT NULL DEFAULT '',
  message_snapshot text,
  template_id      uuid        REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  fired_at         timestamptz,
  response_status  int,
  response_body    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices para processamento eficiente da Edge Function
CREATE INDEX IF NOT EXISTS idx_mfq_status_scheduled
  ON public.meeting_followup_queue (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mfq_meeting
  ON public.meeting_followup_queue (meeting_id);

CREATE INDEX IF NOT EXISTS idx_mfq_rule
  ON public.meeting_followup_queue (rule_id);

-- RLS
ALTER TABLE public.meeting_followup_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfq_select" ON public.meeting_followup_queue;
CREATE POLICY "mfq_select"
  ON public.meeting_followup_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND ativo = true
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "mfq_write" ON public.meeting_followup_queue;
CREATE POLICY "mfq_write"
  ON public.meeting_followup_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_adm = true OR gestor = true)
        AND ativo = true
        AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.meeting_followup_queue IS
  'Fila de follow-ups agendados por status de reunião. Processada pela Edge Function process-meeting-followups.';

-- ─── 3. followup_queue — cria tabela se não existir ──────────────────────────
-- Usada por:
--   - useFollowupQueue (hook da UI)
--   - trigger notify_lead_stage_changed (UPDATE WHERE source_type=stage)
--   - Edge Function followup-enqueue (INSERT)

CREATE TABLE IF NOT EXISTS public.followup_queue (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referências
  followup_id         uuid        REFERENCES public.leads_stages_followups(id) ON DELETE CASCADE,
  meeting_followup_id uuid        REFERENCES public.meetings_followups(id) ON DELETE CASCADE,
  lead_id             uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  person_id           uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,

  -- Canal/conteúdo (nomes em inglês, pós-FWUP-11 rename)
  channel             text        NOT NULL,
  template_id         text,
  message             text,
  subject             text,
  phone_number        text,

  -- Origem do job
  source_type         text        NOT NULL DEFAULT 'stage'
                                  CHECK (source_type IN ('stage', 'meeting')),

  -- Agendamento
  scheduled_for       timestamptz NOT NULL,
  fired_at            timestamptz,

  -- Status
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'cancelled')),

  -- Resultado
  message_id          bigint,
  response_data       jsonb,
  error_message       text,
  retry_count         integer     NOT NULL DEFAULT 0,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_followup_queue_updated_at ON public.followup_queue;
CREATE TRIGGER update_followup_queue_updated_at
  BEFORE UPDATE ON public.followup_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_fup_queue_pending
  ON public.followup_queue (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_fup_queue_lead
  ON public.followup_queue (lead_id);

CREATE INDEX IF NOT EXISTS idx_fup_queue_status
  ON public.followup_queue (status);

-- RLS
ALTER TABLE public.followup_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fup_queue_select" ON public.followup_queue;
CREATE POLICY "fup_queue_select"
  ON public.followup_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND ativo = true
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "fup_queue_write" ON public.followup_queue;
CREATE POLICY "fup_queue_write"
  ON public.followup_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_adm = true OR gestor = true)
        AND ativo = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND (super_adm = true OR gestor = true)
        AND ativo = true
        AND deleted_at IS NULL
    )
  );

COMMENT ON TABLE public.followup_queue IS
  'Fila de disparos agendados de follow-ups de etapa e reunião. Processada pela Edge Function followup-worker.';

-- ─── 4. Smoke test ────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- meetings_followups.channel
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='meetings_followups' AND column_name='channel'
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: meetings_followups.channel ausente';
  END IF;

  -- meetings_followups.source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='meetings_followups' AND column_name='source'
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: meetings_followups.source ausente';
  END IF;

  -- meeting_followup_queue existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='meeting_followup_queue'
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: meeting_followup_queue não existe';
  END IF;

  -- followup_queue existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='followup_queue'
  ) THEN
    RAISE EXCEPTION 'SMOKE FAIL: followup_queue não existe';
  END IF;

  RAISE NOTICE 'SMOKE PASS — meeting flow fix aplicado com sucesso.';
END $$;
