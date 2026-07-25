-- =============================================================================
-- Migration: 20260725200000_altiora_notifications.sql
-- Tabela de notificações in-app Altiora
--
-- Usada para notificar Gestor Comercial (novo referral) e Closer (atribuição).
-- Lida via badge no sino e painel de notificações.
-- =============================================================================

BEGIN;

-- ── 1. Tabela principal ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.altiora_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Usuário destinatário
  user_id     uuid        NOT NULL REFERENCES public.settings_users(id) ON DELETE CASCADE,

  -- Tipo de notificação
  type        text        NOT NULL,

  -- Título curto da notificação
  title       text        NOT NULL,

  -- Mensagem completa
  message     text,

  -- Dados estruturados (ex: { lead_id, lead_title, closer_name })
  payload     jsonb,

  -- Lida ou não
  read        boolean     NOT NULL DEFAULT false,
  read_at     timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Constraints ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'altiora_notifications'
      AND constraint_name = 'altiora_notifications_type_check'
  ) THEN
    ALTER TABLE public.altiora_notifications
      ADD CONSTRAINT altiora_notifications_type_check
      CHECK (type IN (
        'new_referral',
        'closer_assigned',
        'meeting_scheduled',
        'meeting_reminder',
        'pending_validation'
      ));
  END IF;
END;
$$;

-- ── 3. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_altiora_notifications_user_id
  ON public.altiora_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_altiora_notifications_unread
  ON public.altiora_notifications(user_id, read)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_altiora_notifications_created_at
  ON public.altiora_notifications(created_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_notifications ENABLE ROW LEVEL SECURITY;

-- Service role: acesso total (edge functions)
CREATE POLICY "service_role_all" ON public.altiora_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuário autenticado: vê apenas suas notificações
CREATE POLICY "authenticated_own" ON public.altiora_notifications
  FOR ALL TO authenticated
  USING (
    user_id = (
      SELECT id FROM public.settings_users
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    user_id = (
      SELECT id FROM public.settings_users
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- ── 5. Comentários ───────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_notifications IS
  'Notificações in-app Altiora — novo referral, atribuição de Closer, etc.';

COMMENT ON COLUMN public.altiora_notifications.type IS
  'Tipo: new_referral | closer_assigned | meeting_scheduled | meeting_reminder | pending_validation';

COMMIT;
