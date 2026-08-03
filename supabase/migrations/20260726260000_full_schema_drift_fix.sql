-- =============================================================================
-- Migration: 20260726260000_full_schema_drift_fix.sql
-- Full Schema Drift Audit Fix — 2026-07-26
--
-- Origem: full-schema-audit-2026-07-26.md (data-engineer agent)
-- Cobre TODOS os MISSING_COLUMN acionáveis identificados no audit definitivo.
--
-- Escopo: apenas gaps reais onde a tabela existe e a coluna não existe.
-- Tabelas faltantes (MISSING_TABLE) não são criadas aqui — pertencem a
-- migrations de features específicas ou foram descontinuadas.
--
-- Todas as operações usam ADD COLUMN IF NOT EXISTS — safe to re-run.
-- =============================================================================

BEGIN;

-- ── 1. LEADS — colunas faltantes ─────────────────────────────────────────────
-- Referenciadas em: useAltioraContatos, useAltioraR1Data, useAltioraR2Data,
--   useAltioraPendencias, useAltioraMetrics, useCompanyRelations

-- 1a. Campos next_action_* (salvar próxima ação agendada pelo closer)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_action_type        text,
  ADD COLUMN IF NOT EXISTS next_action_description text,
  ADD COLUMN IF NOT EXISTS next_action_due_at      timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_responsavel_id uuid
    REFERENCES public.settings_users(id) ON DELETE SET NULL;

-- 1b. Motivo de perda específico Altiora (useAltioraMetrics)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS altiora_motivo_perda text;

-- 1c. FK para empresa (useCompanyRelations)
--     Nota: clients_companies NÃO existe no banco. Adicionamos a coluna como
--     referência solta (sem FK constraint) para não bloquear o código.
--     Quando clients_companies for criada, adicionar o constraint separadamente.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_id uuid;

COMMENT ON COLUMN public.leads.next_action_type IS
  'Tipo da próxima ação do closer (Reunião, Ligação, Email, etc.) — SD-03';
COMMENT ON COLUMN public.leads.next_action_description IS
  'Descrição da próxima ação — SD-03';
COMMENT ON COLUMN public.leads.next_action_due_at IS
  'Prazo da próxima ação (timestamptz) — SD-03';
COMMENT ON COLUMN public.leads.next_action_responsavel_id IS
  'Usuário responsável pela próxima ação (padrão: closer do lead) — SD-03';
COMMENT ON COLUMN public.leads.altiora_motivo_perda IS
  'Motivo de perda específico Altiora (texto livre) — SD-03';
COMMENT ON COLUMN public.leads.company_id IS
  'FK solta para company (clients_companies ainda não existe) — SD-03';

CREATE INDEX IF NOT EXISTS idx_leads_next_action_due_at
  ON public.leads(next_action_due_at)
  WHERE next_action_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_altiora_motivo_perda
  ON public.leads(altiora_motivo_perda)
  WHERE altiora_motivo_perda IS NOT NULL;

-- ── 2. AI_AGENTS — colunas faltantes ─────────────────────────────────────────
-- Referenciadas em: useAgentesIAReal, useAgentEligibility, useAiAgents

-- 2a. Template system
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS is_template   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_type text;

-- 2b. Humanização e voice
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS humanizacao text
    CHECK (humanizacao IN ('alta', 'media', 'nenhuma')),
  ADD COLUMN IF NOT EXISTS voice_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_id      text;

-- 2c. Canal WhatsApp alternativo (wa_channel_id = alias de wa_phone_number_id
--     para canais múltiplos — mantemos como coluna independente)
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS wa_channel_id text;

-- 2d. ElevenLabs agent ID (distinto de voice_model_id)
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id text;

COMMENT ON COLUMN public.ai_agents.is_template IS
  'Se true, é um template de agente (não aparece na listagem normal) — SD-03';
COMMENT ON COLUMN public.ai_agents.template_type IS
  'Tipo do template (ex: vendas, suporte) — SD-03';
COMMENT ON COLUMN public.ai_agents.humanizacao IS
  'Nível de humanização das respostas: alta | media | nenhuma — SD-03';
COMMENT ON COLUMN public.ai_agents.voice_enabled IS
  'Liga/desliga o modo voz para este agente — SD-03';
COMMENT ON COLUMN public.ai_agents.voice_id IS
  'ID da voz ElevenLabs (distinto de voice_model_id) — SD-03';
COMMENT ON COLUMN public.ai_agents.wa_channel_id IS
  'ID do canal WhatsApp (canal alternativo ao wa_phone_number_id) — SD-03';
COMMENT ON COLUMN public.ai_agents.elevenlabs_agent_id IS
  'ID do agente conversacional na plataforma ElevenLabs — SD-03';

CREATE INDEX IF NOT EXISTS idx_ai_agents_is_template
  ON public.ai_agents(is_template);

-- ── 3. AI_AGENTS_STEPS — colunas faltantes ───────────────────────────────────
-- Referenciada em: useAgentSteps

ALTER TABLE public.ai_agents_steps
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.ai_agents_steps.current_version IS
  'Versão atual do step (espelha ai_agents.current_version para auditoria) — SD-03';

-- ── 4. MEETING_RECORDS — colunas faltantes ────────────────────────────────────
-- Referenciadas em: useMeetingRecords

ALTER TABLE public.meeting_records
  ADD COLUMN IF NOT EXISTS tldv_meeting_id  text,
  ADD COLUMN IF NOT EXISTS transcript_json  jsonb,
  ADD COLUMN IF NOT EXISTS highlights       jsonb;

COMMENT ON COLUMN public.meeting_records.tldv_meeting_id IS
  'ID da gravação no tl;dv (integração de transcrição) — SD-03';
COMMENT ON COLUMN public.meeting_records.transcript_json IS
  'Transcrição completa em formato JSON (segmentos com speaker + timestamp) — SD-03';
COMMENT ON COLUMN public.meeting_records.highlights IS
  'Momentos destacados da gravação (array de objetos) — SD-03';

-- ── 5. SETTINGS_TEAMS — colunas alias em inglês ───────────────────────────────
-- O banco foi criado a partir da migração crm_times (colunas em português: nome, ativo, tipo, prioridade).
-- O código novo usa os nomes em inglês (name, active, team_type, priority).
-- Solução: adicionar colunas geradas (generated columns) como aliases para retrocompatibilidade.
-- Isso permite que consultas antigas (portugues) e novas (inglês) funcionem sem alteração de código.
--
-- Nota: INSERT/UPDATE devem usar as colunas originais; os aliases são SOMENTE para leitura.
-- Para escrita, os hooks devem mapear inglês → português (useTeamsNew já faz isso via dbTeam).

-- Adiciona as colunas físicas em inglês para compatibilidade de escrita
-- (generated columns não permitem DEFAULT via INSERT direto em Postgres,
--  então usamos colunas reais com sincronização via trigger)

-- ABORDAGEM ADOTADA: adicionar colunas reais com valores copiados via trigger,
-- já que generated stored columns não aceitam DEFAULT e podem complicar INSERTs.
-- Trigger bidirecional: qualquer escrita em português OU inglês propaga para o outro.

ALTER TABLE public.settings_teams
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS team_type   text,
  ADD COLUMN IF NOT EXISTS priority    integer,
  ADD COLUMN IF NOT EXISTS active      boolean;

-- Backfill dos valores existentes (português → inglês)
-- tipo é enum tipo_time — cast para text
UPDATE public.settings_teams
SET
  name        = COALESCE(name, nome),
  description = COALESCE(description, descricao),
  team_type   = COALESCE(team_type, tipo::text),
  priority    = COALESCE(priority, prioridade),
  active      = COALESCE(active, ativo)
WHERE name IS NULL OR active IS NULL;

-- Trigger para manter sincronismo bidirecional
CREATE OR REPLACE FUNCTION public.sync_settings_teams_bilingual()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Se colunas inglesas foram escritas, propagar para português
  IF NEW.name IS DISTINCT FROM OLD.name AND NEW.name IS NOT NULL THEN
    NEW.nome := NEW.name;
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    NEW.descricao := NEW.description;
  END IF;
  IF NEW.team_type IS DISTINCT FROM OLD.team_type AND NEW.team_type IS NOT NULL THEN
    BEGIN
      NEW.tipo := NEW.team_type::tipo_time;
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    NEW.prioridade := NEW.priority;
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active AND NEW.active IS NOT NULL THEN
    NEW.ativo := NEW.active;
  END IF;
  -- Se colunas portuguesas foram escritas, propagar para inglês
  IF NEW.nome IS DISTINCT FROM OLD.nome AND NEW.nome IS NOT NULL THEN
    NEW.name := NEW.nome;
  END IF;
  IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    NEW.description := NEW.descricao;
  END IF;
  IF NEW.tipo IS DISTINCT FROM OLD.tipo AND NEW.tipo IS NOT NULL THEN
    NEW.team_type := NEW.tipo::text;
  END IF;
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    NEW.priority := NEW.prioridade;
  END IF;
  IF NEW.ativo IS DISTINCT FROM OLD.ativo AND NEW.ativo IS NOT NULL THEN
    NEW.active := NEW.ativo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_teams_bilingual ON public.settings_teams;
CREATE TRIGGER trg_sync_settings_teams_bilingual
  BEFORE INSERT OR UPDATE ON public.settings_teams
  FOR EACH ROW EXECUTE FUNCTION public.sync_settings_teams_bilingual();

-- INSERT trigger para garantir que INSERTs que usam inglês popule o português também
CREATE OR REPLACE FUNCTION public.sync_settings_teams_insert()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Propagar inglês → português se português não foi preenchido
  IF NEW.nome IS NULL AND NEW.name IS NOT NULL THEN NEW.nome := NEW.name; END IF;
  IF NEW.descricao IS NULL AND NEW.description IS NOT NULL THEN NEW.descricao := NEW.description; END IF;
  IF NEW.tipo IS NULL AND NEW.team_type IS NOT NULL THEN
    BEGIN NEW.tipo := NEW.team_type::tipo_time;
    EXCEPTION WHEN invalid_text_representation THEN NULL; END;
  END IF;
  IF NEW.prioridade IS NULL AND NEW.priority IS NOT NULL THEN NEW.prioridade := NEW.priority; END IF;
  IF NEW.ativo IS NULL AND NEW.active IS NOT NULL THEN NEW.ativo := NEW.active; END IF;
  -- Propagar português → inglês se inglês não foi preenchido
  IF NEW.name IS NULL AND NEW.nome IS NOT NULL THEN NEW.name := NEW.nome; END IF;
  IF NEW.description IS NULL AND NEW.descricao IS NOT NULL THEN NEW.description := NEW.descricao; END IF;
  IF NEW.team_type IS NULL AND NEW.tipo IS NOT NULL THEN NEW.team_type := NEW.tipo::text; END IF;
  IF NEW.priority IS NULL AND NEW.prioridade IS NOT NULL THEN NEW.priority := NEW.prioridade; END IF;
  IF NEW.active IS NULL AND NEW.ativo IS NOT NULL THEN NEW.active := NEW.ativo; END IF;
  RETURN NEW;
END;
$$;

-- (reutilizar o trigger de INSERT no trigger acima que já cobre INSERT OR UPDATE)

COMMENT ON COLUMN public.settings_teams.name IS
  'Alias em inglês de "nome" — mantido em sincronia via trigger SD-03';
COMMENT ON COLUMN public.settings_teams.active IS
  'Alias em inglês de "ativo" — mantido em sincronia via trigger SD-03';
COMMENT ON COLUMN public.settings_teams.team_type IS
  'Alias em inglês de "tipo" — mantido em sincronia via trigger SD-03';
COMMENT ON COLUMN public.settings_teams.priority IS
  'Alias em inglês de "prioridade" — mantido em sincronia via trigger SD-03';

-- ── 6. SETTINGS_USERS_TEAMS — colunas alias em inglês ────────────────────────
-- Banco: usuario_id, time_id
-- Código: user_id, team_id
-- Mesma estratégia de colunas reais + trigger bidirecional.

ALTER TABLE public.settings_users_teams
  ADD COLUMN IF NOT EXISTS user_id uuid
    REFERENCES public.settings_users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS team_id uuid
    REFERENCES public.settings_teams(id) ON DELETE CASCADE;

-- Backfill
UPDATE public.settings_users_teams
SET
  user_id = COALESCE(user_id, usuario_id),
  team_id = COALESCE(team_id, time_id)
WHERE user_id IS NULL OR team_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_settings_users_teams_bilingual()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- inglês → português
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    NEW.usuario_id := NEW.user_id;
  END IF;
  IF NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL THEN
    NEW.time_id := NEW.team_id;
  END IF;
  -- português → inglês
  IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id AND NEW.usuario_id IS NOT NULL THEN
    NEW.user_id := NEW.usuario_id;
  END IF;
  IF NEW.time_id IS DISTINCT FROM OLD.time_id AND NEW.time_id IS NOT NULL THEN
    NEW.team_id := NEW.time_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_users_teams_bilingual ON public.settings_users_teams;
CREATE TRIGGER trg_sync_settings_users_teams_bilingual
  BEFORE INSERT OR UPDATE ON public.settings_users_teams
  FOR EACH ROW EXECUTE FUNCTION public.sync_settings_users_teams_bilingual();

COMMENT ON COLUMN public.settings_users_teams.user_id IS
  'Alias em inglês de "usuario_id" — SD-03';
COMMENT ON COLUMN public.settings_users_teams.team_id IS
  'Alias em inglês de "time_id" — SD-03';

CREATE INDEX IF NOT EXISTS idx_settings_users_teams_user_id
  ON public.settings_users_teams(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settings_users_teams_team_id
  ON public.settings_users_teams(team_id)
  WHERE team_id IS NOT NULL;

-- ── 7. SETTINGS_USERS — colunas alias em inglês ──────────────────────────────
-- Banco: nome, ativo, super_adm
-- Código: name, active, super_admin
-- Mesma estratégia.

ALTER TABLE public.settings_users
  ADD COLUMN IF NOT EXISTS name       text,
  ADD COLUMN IF NOT EXISTS active     boolean,
  ADD COLUMN IF NOT EXISTS super_admin boolean;

-- Backfill
UPDATE public.settings_users
SET
  name        = COALESCE(name, nome),
  active      = COALESCE(active, ativo),
  super_admin = COALESCE(super_admin, super_adm)
WHERE name IS NULL OR active IS NULL;

CREATE OR REPLACE FUNCTION public.sync_settings_users_bilingual()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- inglês → português
  IF NEW.name IS DISTINCT FROM OLD.name AND NEW.name IS NOT NULL THEN
    NEW.nome := NEW.name;
  END IF;
  IF NEW.active IS DISTINCT FROM OLD.active AND NEW.active IS NOT NULL THEN
    NEW.ativo := NEW.active;
  END IF;
  IF NEW.super_admin IS DISTINCT FROM OLD.super_admin AND NEW.super_admin IS NOT NULL THEN
    NEW.super_adm := NEW.super_admin;
  END IF;
  -- português → inglês
  IF NEW.nome IS DISTINCT FROM OLD.nome AND NEW.nome IS NOT NULL THEN
    NEW.name := NEW.nome;
  END IF;
  IF NEW.ativo IS DISTINCT FROM OLD.ativo AND NEW.ativo IS NOT NULL THEN
    NEW.active := NEW.ativo;
  END IF;
  IF NEW.super_adm IS DISTINCT FROM OLD.super_adm AND NEW.super_adm IS NOT NULL THEN
    NEW.super_admin := NEW.super_adm;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_users_bilingual ON public.settings_users;
CREATE TRIGGER trg_sync_settings_users_bilingual
  BEFORE INSERT OR UPDATE ON public.settings_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_settings_users_bilingual();

COMMENT ON COLUMN public.settings_users.name IS
  'Alias em inglês de "nome" — SD-03';
COMMENT ON COLUMN public.settings_users.active IS
  'Alias em inglês de "ativo" — SD-03';
COMMENT ON COLUMN public.settings_users.super_admin IS
  'Alias em inglês de "super_adm" — SD-03';

CREATE INDEX IF NOT EXISTS idx_settings_users_name
  ON public.settings_users(name)
  WHERE name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settings_users_active
  ON public.settings_users(active)
  WHERE active IS NOT NULL;

COMMIT;
