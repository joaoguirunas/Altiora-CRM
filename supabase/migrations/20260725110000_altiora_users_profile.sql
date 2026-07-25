-- =============================================================================
-- Migration: 20260725110000_altiora_users_profile.sql
-- Adiciona perfil Altiora a settings_users: user_type + fuso_horario
--
-- Contexto:
--   settings_users já possui: nome, email, ativo, gestor (bool), super_adm (bool)
--   O campo `gestor` é o controle interno do CRM genérico.
--   `user_type` adiciona o perfil específico Altiora sem remover o campo gestor.
--
-- Valores válidos de user_type:
--   'admin'            → Administrador/RevOps (Ivanderlei)
--   'gestor_comercial' → Gestor Comercial (André)
--   'closer'           → Closer (Marco, Ellen, Kayan)
--   NULL               → Usuário sem perfil Altiora atribuído
-- =============================================================================

BEGIN;

-- ── 1. Colunas novas ─────────────────────────────────────────────────────────

ALTER TABLE public.settings_users
  ADD COLUMN IF NOT EXISTS user_type    text,
  ADD COLUMN IF NOT EXISTS fuso_horario text DEFAULT 'America/Sao_Paulo';

-- ── 2. Check constraint de domínio ───────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'settings_users'
      AND constraint_name = 'settings_users_user_type_check'
  ) THEN
    ALTER TABLE public.settings_users
      ADD CONSTRAINT settings_users_user_type_check
      CHECK (user_type IS NULL OR user_type IN ('admin', 'gestor_comercial', 'closer'));
  END IF;
END;
$$;

-- ── 3. Índice para filtro por perfil ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_settings_users_user_type
  ON public.settings_users(user_type)
  WHERE user_type IS NOT NULL AND deleted_at IS NULL;

-- ── 4. Comentários ───────────────────────────────────────────────────────────

COMMENT ON COLUMN public.settings_users.user_type IS
  'Perfil Altiora: admin | gestor_comercial | closer. NULL = sem perfil Altiora.';

COMMENT ON COLUMN public.settings_users.fuso_horario IS
  'Fuso horário IANA do usuário (ex: America/Sao_Paulo). Usado em agendamento de R1/R2/R3.';

COMMIT;
