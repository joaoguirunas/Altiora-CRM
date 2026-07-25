-- =============================================================================
-- Migration: 20260725130000_altiora_meetings_r123.sql
-- Adiciona campos de reuniões Altiora (R1/R2/R3) na tabela meetings
--
-- A tabela meetings já tem:
--   leads_id, users_id, date, start_time, end_time, location, notes, status,
--   source, google_meet_link, calendar_id, outcome, gcal_sync_error, meeting_type
--
-- Novos campos Altiora usam prefixo `altiora_` onde houver ambiguidade.
-- google_event_id é global (sem prefixo) pois é específico da integração GCal.
--
-- Casos de uso cobertos:
--   UC21 — google_event_id, altiora_tipo, altiora_duracao_minutos, altiora_data_hora
--   UC22 — suporte a reagendamento (campos de histórico via altiora_pauta/proxima_acao)
--   UC23 — altiora_compareceu, altiora_motivo_ausencia, altiora_resultado
--   UC24 — altiora_pauta (dados diagnóstico R1), altiora_created_by
--   UC26 — altiora_pauta (contexto R2)
--   UC27 — altiora_resultado (fechamento R3)
-- =============================================================================

BEGIN;

-- ── 1. Colunas Altiora em meetings ───────────────────────────────────────────

ALTER TABLE public.meetings
  -- Tipo de reunião Altiora: R1, R2 ou R3
  ADD COLUMN IF NOT EXISTS altiora_tipo             text,

  -- Duração planejada em minutos
  ADD COLUMN IF NOT EXISTS altiora_duracao_minutos  integer,

  -- Google Calendar Event ID (chave para sync/atualização via API)
  ADD COLUMN IF NOT EXISTS google_event_id          text,

  -- Comparecimento do cliente à reunião (null = ainda não registrado)
  ADD COLUMN IF NOT EXISTS altiora_compareceu       boolean,

  -- Motivo de ausência quando cliente não compareceu
  ADD COLUMN IF NOT EXISTS altiora_motivo_ausencia  text,

  -- Resultado da reunião (complementa `outcome` genérico já existente)
  ADD COLUMN IF NOT EXISTS altiora_resultado        text,

  -- Pauta preparada para a reunião (obrigatória em R2 e R3)
  ADD COLUMN IF NOT EXISTS altiora_pauta            text,

  -- Próxima ação definida ao final da reunião
  ADD COLUMN IF NOT EXISTS altiora_proxima_acao     text,

  -- Quem registrou a reunião (pode ser diferente do users_id responsável)
  ADD COLUMN IF NOT EXISTS altiora_created_by       uuid
    REFERENCES public.settings_users(id) ON DELETE SET NULL,

  -- Timestamp completo start (complementa date + start_time já separados)
  ADD COLUMN IF NOT EXISTS altiora_data_hora        timestamptz;

-- ── 2. Check constraint de tipo ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'meetings'
      AND constraint_name = 'meetings_altiora_tipo_check'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_altiora_tipo_check
      CHECK (altiora_tipo IS NULL OR altiora_tipo IN ('R1', 'R2', 'R3'));
  END IF;
END;
$$;

-- ── 3. Índices ────────────────────────────────────────────────────────────────

-- Google Event ID deve ser único (evita duplicata ao sincronizar GCal)
CREATE UNIQUE INDEX IF NOT EXISTS meetings_google_event_id_uq
  ON public.meetings(google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_altiora_tipo
  ON public.meetings(altiora_tipo)
  WHERE altiora_tipo IS NOT NULL;

-- ── 4. Comentários ───────────────────────────────────────────────────────────

COMMENT ON COLUMN public.meetings.altiora_tipo IS
  'Tipo de reunião Altiora: R1 | R2 | R3 (UC21)';

COMMENT ON COLUMN public.meetings.altiora_duracao_minutos IS
  'Duração planejada da reunião em minutos (UC21)';

COMMENT ON COLUMN public.meetings.google_event_id IS
  'ID do evento Google Calendar — usado para atualizar/cancelar via API (UC21/UC22)';

COMMENT ON COLUMN public.meetings.altiora_compareceu IS
  'Cliente compareceu à reunião: true | false | NULL (ainda não registrado) (UC23)';

COMMENT ON COLUMN public.meetings.altiora_motivo_ausencia IS
  'Motivo de ausência do cliente quando altiora_compareceu = false (UC23)';

COMMENT ON COLUMN public.meetings.altiora_resultado IS
  'Resultado da reunião registrado pelo Closer (UC23/UC24/UC26/UC27)';

COMMENT ON COLUMN public.meetings.altiora_pauta IS
  'Pauta preparada pelo Closer — obrigatória em R2 e R3 (UC24/UC26)';

COMMENT ON COLUMN public.meetings.altiora_proxima_acao IS
  'Próxima ação definida ao final da reunião (UC23)';

COMMENT ON COLUMN public.meetings.altiora_created_by IS
  'Closer que registrou a reunião (FK settings_users) — pode diferir de users_id';

COMMENT ON COLUMN public.meetings.altiora_data_hora IS
  'Timestamp de início completo (UTC) — complementa date + start_time separados (UC21)';

COMMIT;
