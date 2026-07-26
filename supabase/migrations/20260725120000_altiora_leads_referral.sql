-- =============================================================================
-- Migration: 20260725120000_altiora_leads_referral.sql
-- Adiciona campos de referral Altiora na tabela leads
--
-- A tabela leads já tem: people_id, leads_pipelines_id, leads_stages_id,
-- users_id (consultor genérico), value, status, loss_reason, metadata, etc.
--
-- Novos campos usam prefixo `altiora_` para isolamento semântico.
-- Todos nullable com DEFAULT NULL → compatível com leads não-Altiora.
--
-- Casos de uso cobertos:
--   UC10 — email_handoff_id: vínculo com e-mail de handoff Avenue
--   UC11 — altiora_origem: 'manual' para cadastro manual
--   UC12 — altiora_closer_id, altiora_gestor_id, altiora_data_atribuicao, altiora_origem_atribuicao
--   UC16 — altiora_possibilidade_retomada, altiora_etapa_perda
-- =============================================================================

BEGIN;

-- ── 1. Colunas Altiora em leads ──────────────────────────────────────────────

ALTER TABLE public.leads
  -- UC10/UC11: Origem do referral
  ADD COLUMN IF NOT EXISTS altiora_origem             text,

  -- UC12: Closer responsável (papel diferente de users_id genérico do CRM)
  ADD COLUMN IF NOT EXISTS altiora_closer_id          uuid
    REFERENCES public.settings_users(id) ON DELETE SET NULL,

  -- UC12: Gestor Comercial que recebeu e atribuiu
  ADD COLUMN IF NOT EXISTS altiora_gestor_id          uuid
    REFERENCES public.settings_users(id) ON DELETE SET NULL,

  -- UC10: Timestamp do handoff Avenue → Altiora
  ADD COLUMN IF NOT EXISTS altiora_data_handoff       timestamptz,

  -- UC12: Timestamp da atribuição ao Closer
  ADD COLUMN IF NOT EXISTS altiora_data_atribuicao    timestamptz,

  -- UC10: ID do e-mail de handoff original (referência ao sistema de e-mail)
  ADD COLUMN IF NOT EXISTS altiora_email_handoff_id   text,

  -- UC12: Como o referral foi atribuído ao Closer
  ADD COLUMN IF NOT EXISTS altiora_origem_atribuicao  text,

  -- UC16: Possibilidade de retomada futura (campo obrigatório ao encerrar como perdido)
  ADD COLUMN IF NOT EXISTS altiora_possibilidade_retomada boolean DEFAULT false,

  -- UC16: Nome da etapa em que o referral foi encerrado como perdido
  ADD COLUMN IF NOT EXISTS altiora_etapa_perda        text,

  -- Observações da atribuição (motivo de troca de Closer em UC13)
  ADD COLUMN IF NOT EXISTS altiora_obs_atribuicao     text;

-- ── 2. Check constraints de domínio ─────────────────────────────────────────

DO $$
BEGIN
  -- Origem do referral
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'leads'
      AND constraint_name = 'leads_altiora_origem_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_altiora_origem_check
      CHECK (altiora_origem IS NULL
          OR altiora_origem IN ('avenue_email', 'manual', 'outros'));
  END IF;

  -- Origem da atribuição
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'leads'
      AND constraint_name = 'leads_altiora_origem_atribuicao_check'
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_altiora_origem_atribuicao_check
      CHECK (altiora_origem_atribuicao IS NULL
          OR altiora_origem_atribuicao IN ('email_auto', 'manual'));
  END IF;
END;
$$;

-- ── 3. Índices para queries do pipeline Altiora ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leads_altiora_closer_id
  ON public.leads(altiora_closer_id)
  WHERE altiora_closer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_altiora_gestor_id
  ON public.leads(altiora_gestor_id)
  WHERE altiora_gestor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_altiora_origem
  ON public.leads(altiora_origem)
  WHERE altiora_origem IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_altiora_data_handoff
  ON public.leads(altiora_data_handoff)
  WHERE altiora_data_handoff IS NOT NULL;

-- ── 4. Comentários ───────────────────────────────────────────────────────────

COMMENT ON COLUMN public.leads.altiora_origem IS
  'Origem do referral: avenue_email | manual | outros (UC10/UC11)';

COMMENT ON COLUMN public.leads.altiora_closer_id IS
  'Closer responsável pelo referral — FK settings_users (UC12)';

COMMENT ON COLUMN public.leads.altiora_gestor_id IS
  'Gestor Comercial que recebeu/atribuiu o referral — FK settings_users (UC12)';

COMMENT ON COLUMN public.leads.altiora_data_handoff IS
  'Timestamp do handoff Avenue → Altiora (UC10)';

COMMENT ON COLUMN public.leads.altiora_data_atribuicao IS
  'Timestamp da atribuição ao Closer (UC12)';

COMMENT ON COLUMN public.leads.altiora_email_handoff_id IS
  'Referência ao e-mail de handoff original — ID externo (UC10)';

COMMENT ON COLUMN public.leads.altiora_origem_atribuicao IS
  'Como foi atribuído: email_auto (automático via e-mail) | manual (UC12)';

COMMENT ON COLUMN public.leads.altiora_possibilidade_retomada IS
  'Closer indicou que há possibilidade de retomada futura (UC16)';

COMMENT ON COLUMN public.leads.altiora_etapa_perda IS
  'Etapa do pipeline em que o referral foi encerrado como Perdido (UC16)';

COMMENT ON COLUMN public.leads.altiora_obs_atribuicao IS
  'Observações da atribuição/troca de Closer (UC13)';

COMMIT;
