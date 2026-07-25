-- =============================================================================
-- Migration: 20260725190000_altiora_lead_interactions.sql
-- Tabela de interações/eventos de um lead Altiora
--
-- Registra cada evento relevante: atribuição de Closer, troca, reunião agendada,
-- mudança de etapa, etc. Usada por UC12 (ALTIORA-07) e UC21 (ALTIORA-13).
-- =============================================================================

BEGIN;

-- ── 1. Tabela principal ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.altiora_lead_interactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  lead_id       uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Tipo de interação
  type          text        NOT NULL,

  -- Ator que realizou a ação (FK settings_users, null = sistema)
  actor_id      uuid        REFERENCES public.settings_users(id) ON DELETE SET NULL,

  -- Descrição legível da interação
  description   text,

  -- Dados estruturados da interação (ex: { closer_id, stage_from, stage_to })
  payload       jsonb,

  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Constraints ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'altiora_lead_interactions'
      AND constraint_name = 'altiora_lead_interactions_type_check'
  ) THEN
    ALTER TABLE public.altiora_lead_interactions
      ADD CONSTRAINT altiora_lead_interactions_type_check
      CHECK (type IN (
        'closer_assigned',
        'closer_reassigned',
        'stage_changed',
        'meeting_scheduled',
        'meeting_rescheduled',
        'meeting_cancelled',
        'meeting_completed',
        'note_added',
        'email_received',
        'manual_action'
      ));
  END IF;
END;
$$;

-- ── 3. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_altiora_lead_interactions_lead_id
  ON public.altiora_lead_interactions(lead_id);

CREATE INDEX IF NOT EXISTS idx_altiora_lead_interactions_type
  ON public.altiora_lead_interactions(type);

CREATE INDEX IF NOT EXISTS idx_altiora_lead_interactions_actor_id
  ON public.altiora_lead_interactions(actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_altiora_lead_interactions_created_at
  ON public.altiora_lead_interactions(created_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_lead_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.altiora_lead_interactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_select" ON public.altiora_lead_interactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert" ON public.altiora_lead_interactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 5. Comentários ───────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_lead_interactions IS
  'Histórico de interações e eventos de leads Altiora (UC12, UC21)';

COMMENT ON COLUMN public.altiora_lead_interactions.type IS
  'Tipo de interação: closer_assigned | stage_changed | meeting_scheduled | ...';

COMMENT ON COLUMN public.altiora_lead_interactions.actor_id IS
  'Usuário que realizou a ação — null para ações automáticas do sistema';

COMMIT;
