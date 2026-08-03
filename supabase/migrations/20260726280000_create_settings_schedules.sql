-- =============================================================================
-- Migration: 20260726280000_create_settings_schedules.sql
--
-- settings_schedules (horários de trabalho por consultor) nunca chegou a ser
-- aplicada no banco remoto — só existia como CREATE TABLE dentro da migração
-- de baseline (20260312150001_ensure_full_tenant_baseline.sql), que ficou sem
-- efeito neste projeto. Sem a tabela, useSchedules/useHorarios sempre retorna
-- vazio, então a página Horários e a checagem de disponibilidade (reagendar e
-- nova reunião) nunca encontram nenhum horário configurado.
--
-- A linhagem antiga (crm_horarios → settings_users_schedules) segue existindo
-- e populada eventualmente por fluxos legados, mas nenhum hook do app aponta
-- mais para ela — o código atual (useSchedules.ts) já espera exatamente as
-- colunas abaixo (user_id, day_of_week, start_time, end_time, is_available).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.settings_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.settings_users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settings_schedules_user_id
  ON public.settings_schedules(user_id);

CREATE INDEX IF NOT EXISTS idx_settings_schedules_user_day
  ON public.settings_schedules(user_id, day_of_week)
  WHERE is_available = true;

DROP TRIGGER IF EXISTS trg_settings_schedules_updated_at ON public.settings_schedules;
CREATE TRIGGER trg_settings_schedules_updated_at
  BEFORE UPDATE ON public.settings_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.settings_schedules ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de user_calendar_connections: o próprio consultor gerencia seu
-- horário; gestores e super admins gerenciam o de qualquer consultor ativo.
DROP POLICY IF EXISTS "schedules_self_or_manager" ON public.settings_schedules;
CREATE POLICY "schedules_self_or_manager" ON public.settings_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND su.ativo = true
        AND (su.id = settings_schedules.user_id OR su.super_adm = true OR su.gestor = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND su.ativo = true
        AND (su.id = settings_schedules.user_id OR su.super_adm = true OR su.gestor = true)
    )
  );

COMMENT ON TABLE public.settings_schedules IS
  'Horários de disponibilidade semanal por consultor (usado por useSchedules/useHorarios e pela checagem de disponibilidade em agendar/reagendar).';

COMMIT;
