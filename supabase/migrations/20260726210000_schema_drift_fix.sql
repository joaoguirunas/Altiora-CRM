-- =============================================================================
-- Migration: 20260726210000_schema_drift_fix.sql
-- SD-02: Adiciona todas as colunas faltantes identificadas no gap report SD-01
--
-- Todas as operações usam IF NOT EXISTS — safe to re-run.
-- Absorve o conteúdo de 20260726200000_meetings_missing_columns.sql.
-- Referência: docs/smart-memory/agents/data-engineer/schema-gap-report.md
--
-- Tabelas afetadas: meetings (única tabela com gaps acionáveis)
-- Colunas adicionadas: 7 colunas
-- =============================================================================

BEGIN;

-- ── MEETINGS ─────────────────────────────────────────────────────────────────
-- Colunas referenciadas no código mas ausentes no banco real.
-- Fontes: useAgendamentosSimple, useMeetingSingle, useAgendamentosSimples,
--         useAltioraMeetings, useDashboardAgendamentos, biTools.ts

-- 1. title — título da reunião (usado em múltiplos hooks e modais)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS title text;

-- 2. people_id — FK para clients_people (acesso direto à pessoa sem join via leads)
--    Origem: migration 20260726200000 (absorvida aqui)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS people_id uuid
    REFERENCES public.clients_people(id) ON DELETE SET NULL;

-- 3. description — descrição/pauta da reunião (useAgendamentosSimples)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS description text;

-- 4. meeting_link — link genérico de videoconferência (useMeetingSingle, useAltioraMeetings)
--    Obs: google_meet_link já existe. meeting_link é campo separado para outros provedores.
--    Origem: migration 20260726200000 (absorvida aqui)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_link text;

-- 5. updated_at — timestamp de última atualização (useMeetingSingle type def)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 6. ms_meeting_id — ID da reunião no Microsoft Teams
--    Origem: migration 20260219220000_ms_teams_integration não foi aplicada no banco
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ms_meeting_id text;

-- 7. google_last_synced_at — timestamp do último sync com Google Calendar
--    Origem: migration 20260219130000_google_cal_sync_to_db não foi aplicada no banco
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS google_last_synced_at timestamptz;

-- ── Índices para as novas colunas ─────────────────────────────────────────────

-- people_id: busca de reuniões por pessoa (useAgendamentosSimples, useDeletarPessoa)
CREATE INDEX IF NOT EXISTS idx_meetings_people_id
  ON public.meetings(people_id)
  WHERE people_id IS NOT NULL;

-- ms_meeting_id: deve ser único quando não-nulo (paridade com meetings_ms_meeting_id_idx)
CREATE UNIQUE INDEX IF NOT EXISTS meetings_ms_meeting_id_idx
  ON public.meetings(ms_meeting_id)
  WHERE ms_meeting_id IS NOT NULL;

-- ── Comentários ───────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.meetings.title IS
  'Título da reunião — campo livre definido pelo Closer (SD-02)';

COMMENT ON COLUMN public.meetings.people_id IS
  'FK para clients_people — acesso direto à pessoa sem join via leads (SD-02)';

COMMENT ON COLUMN public.meetings.description IS
  'Descrição ou pauta livre da reunião (SD-02)';

COMMENT ON COLUMN public.meetings.meeting_link IS
  'Link genérico de videoconferência (Zoom, Cal.com, etc.) — distinto de google_meet_link (SD-02)';

COMMENT ON COLUMN public.meetings.updated_at IS
  'Timestamp de última atualização do registro (SD-02)';

COMMENT ON COLUMN public.meetings.ms_meeting_id IS
  'ID da reunião no Microsoft Teams — único quando não-nulo (SD-02)';

COMMENT ON COLUMN public.meetings.google_last_synced_at IS
  'Timestamp do último sync bem-sucedido com Google Calendar (SD-02)';

COMMIT;
