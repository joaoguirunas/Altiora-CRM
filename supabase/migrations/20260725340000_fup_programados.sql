-- ══════════════════════════════════════════════════════════════════════════════
-- FUP-AUTO-01 — Fila de FUPs programados pelo agente IA
--
-- Cria tabela `fup_programados` para agendamentos automáticos criados
-- pelo agente IA via tool `agendar_fup`.
--
-- 3 tipos suportados:
--   etapa_crm  — mover lead para etapa específica do kanban em data futura
--   agendamento — criar reunião/encontro em data específica
--   programado  — enviar template WhatsApp em data/hora específica
--
-- Padrão de cron: fn_cron_http_call() lendo de _app_config (igual ao
-- process-meeting-followups, conversion-send-retry, google-calendar-sync).
-- Edge fn `fup-programados-worker` (futura) processa a fila a cada 5min.
--
-- Rollback: supabase/migrations/rollbacks/20260725340000_fup_programados.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Tabela fup_programados ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fup_programados (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Referências ──────────────────────────────────────────────────────────
  lead_id         uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  people_id       uuid        REFERENCES public.clients_people(id) ON DELETE SET NULL,
  agent_id        uuid        REFERENCES public.ai_agents(id) ON DELETE SET NULL,

  -- ── Tipo de FUP ──────────────────────────────────────────────────────────
  -- etapa_crm  → move lead para etapa_id em scheduled_at
  -- agendamento → cria reunião/agendamento em scheduled_at
  -- programado  → envia WhatsApp template_id (ou mensagem livre) em scheduled_at
  tipo            text        NOT NULL
                              CHECK (tipo IN ('etapa_crm', 'agendamento', 'programado')),

  -- ── Payload por tipo ─────────────────────────────────────────────────────
  etapa_id        uuid        REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  -- ^ para tipo=etapa_crm: etapa de destino no kanban

  template_id     text,
  -- ^ para tipo=programado: meta_template_name do WhatsApp template

  mensagem        text,
  -- ^ para tipo=programado: mensagem livre (alternativa ao template)
  --   para tipo=agendamento: notas / pauta do agendamento

  agendamento_titulo text,
  -- ^ para tipo=agendamento: título da reunião

  -- ── Contexto IA ──────────────────────────────────────────────────────────
  motivo          text,
  -- ^ snippet do contexto: ex "lead disse 'fale em 3 meses'"

  -- ── Agendamento ──────────────────────────────────────────────────────────
  scheduled_at    timestamptz NOT NULL,
  fired_at        timestamptz,

  -- ── Status ───────────────────────────────────────────────────────────────
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'done', 'failed', 'cancelled')),

  -- ── Resultado ────────────────────────────────────────────────────────────
  error_message   text,
  retry_count     integer     NOT NULL DEFAULT 0,

  -- ── Cancelamento ─────────────────────────────────────────────────────────
  cancelado_por   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelado_em    timestamptz,

  -- ── Auditoria ────────────────────────────────────────────────────────────
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
  -- ^ soft delete: deleted_at IS NOT NULL = cancelado/arquivado
);

COMMENT ON TABLE public.fup_programados IS
  'FUP-AUTO-01: Fila de follow-ups programados pelo agente IA. '
  '3 tipos: etapa_crm (move kanban), agendamento (cria reunião), programado (envia WhatsApp). '
  'Processada a cada 5min pelo worker fup-programados-worker via pg_cron.';

COMMENT ON COLUMN public.fup_programados.tipo IS
  'etapa_crm=mover lead de etapa | agendamento=criar reunião | programado=enviar WhatsApp';
COMMENT ON COLUMN public.fup_programados.motivo IS
  'Trecho do contexto da conversa que originou o FUP (ex: "lead disse: fale em 3 meses")';
COMMENT ON COLUMN public.fup_programados.status IS
  'pending=aguardando | processing=worker executando | done=concluído | failed=erro | cancelled=cancelado';

-- ── Trigger updated_at ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_fup_programados_updated_at ON public.fup_programados;
CREATE TRIGGER update_fup_programados_updated_at
  BEFORE UPDATE ON public.fup_programados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Índices ───────────────────────────────────────────────────────────────────

-- Índice principal do worker: FUPs prontos para processar
CREATE INDEX IF NOT EXISTS idx_fup_programados_pending
  ON public.fup_programados (scheduled_at)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- Índice por lead (listagem no painel)
CREATE INDEX IF NOT EXISTS idx_fup_programados_lead_id
  ON public.fup_programados (lead_id)
  WHERE deleted_at IS NULL;

-- Índice por status (UI + worker)
CREATE INDEX IF NOT EXISTS idx_fup_programados_status
  ON public.fup_programados (status, scheduled_at)
  WHERE deleted_at IS NULL;

-- Índice por agente (auditoria de FUPs por IA)
CREATE INDEX IF NOT EXISTS idx_fup_programados_agent_id
  ON public.fup_programados (agent_id)
  WHERE agent_id IS NOT NULL AND deleted_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.fup_programados ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários autenticados ativos veem FUPs dos seus leads
CREATE POLICY "fup_programados_select_authenticated"
  ON public.fup_programados
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND su.active = true
        AND su.deleted_at IS NULL
    )
  );

-- INSERT: apenas service_role (tool do agente via edge fn) ou super_admin
CREATE POLICY "fup_programados_insert_agent_or_admin"
  ON public.fup_programados
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND (su.super_admin = true OR su.user_type IN ('admin', 'manager'))
        AND su.active = true
        AND su.deleted_at IS NULL
    )
  );

-- UPDATE: service_role (worker) ou admin (cancelamento manual)
CREATE POLICY "fup_programados_update_admin"
  ON public.fup_programados
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND (su.super_admin = true OR su.user_type IN ('admin', 'manager'))
        AND su.active = true
        AND su.deleted_at IS NULL
    )
  );

-- service_role bypass (edge fn worker precisa ler + atualizar sem JWT de usuário)
CREATE POLICY "fup_programados_service_role"
  ON public.fup_programados
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.fup_programados TO authenticated;
GRANT ALL ON public.fup_programados TO service_role;

-- ─── 2. RPC agendar_fup() — tool do agente IA ────────────────────────────────
-- SECURITY DEFINER: o agente IA chama via authenticated/service_role;
-- a função valida permissões e insere na fila.
-- Retorna o UUID do FUP criado.

CREATE OR REPLACE FUNCTION public.agendar_fup(
  p_lead_id           uuid,
  p_tipo              text,
  p_scheduled_at      timestamptz,
  p_etapa_id          uuid        DEFAULT NULL,
  p_template_id       text        DEFAULT NULL,
  p_mensagem          text        DEFAULT NULL,
  p_agendamento_titulo text       DEFAULT NULL,
  p_motivo            text        DEFAULT NULL,
  p_agent_id          uuid        DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fup_id uuid;
  v_lead_exists boolean;
BEGIN
  -- ── Validações ──────────────────────────────────────────────────────────
  IF p_tipo NOT IN ('etapa_crm', 'agendamento', 'programado') THEN
    RAISE EXCEPTION 'agendar_fup: tipo inválido "%". Use: etapa_crm | agendamento | programado', p_tipo
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'agendar_fup: scheduled_at deve ser no futuro (recebido: %)', p_scheduled_at
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Verifica que o lead existe
  SELECT EXISTS (
    SELECT 1 FROM public.leads WHERE id = p_lead_id AND deleted_at IS NULL
  ) INTO v_lead_exists;

  IF NOT v_lead_exists THEN
    RAISE EXCEPTION 'agendar_fup: lead % não encontrado ou deletado', p_lead_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Validações por tipo
  IF p_tipo = 'etapa_crm' AND p_etapa_id IS NULL THEN
    RAISE EXCEPTION 'agendar_fup: tipo etapa_crm requer etapa_id'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_tipo = 'programado' AND p_template_id IS NULL AND p_mensagem IS NULL THEN
    RAISE EXCEPTION 'agendar_fup: tipo programado requer template_id ou mensagem'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── Resolução de people_id a partir do lead ────────────────────────────
  -- INSERT retornando o id
  INSERT INTO public.fup_programados (
    lead_id,
    people_id,
    agent_id,
    tipo,
    etapa_id,
    template_id,
    mensagem,
    agendamento_titulo,
    motivo,
    scheduled_at,
    status
  )
  SELECT
    p_lead_id,
    l.people_id,    -- propaga do lead automaticamente
    p_agent_id,
    p_tipo,
    p_etapa_id,
    p_template_id,
    p_mensagem,
    p_agendamento_titulo,
    p_motivo,
    p_scheduled_at,
    'pending'
  FROM public.leads l
  WHERE l.id = p_lead_id
  RETURNING id INTO v_fup_id;

  RETURN v_fup_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;  -- propaga exceção ao caller
END;
$$;

COMMENT ON FUNCTION public.agendar_fup IS
  'FUP-AUTO-01: Tool do agente IA para agendar FUPs programados. '
  'Valida tipo (etapa_crm|agendamento|programado), lead_id e scheduled_at futuro. '
  'SECURITY DEFINER — chamado pelo ai-agent-execute via edge fn. '
  'Retorna uuid do FUP criado.';

-- Grants: service_role (edge fn ai-agent-execute) + authenticated (super_admin via painel)
REVOKE ALL ON FUNCTION public.agendar_fup FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agendar_fup TO service_role, authenticated;

COMMIT;

-- ─── 3. Cron fup-programados-worker ──────────────────────────────────────────
-- FORA da transação: pg_cron no Supabase não pode estar em BEGIN..COMMIT
-- Padrão: fn_cron_http_call() lendo supabase_url + service_role_key de _app_config
-- Edge fn `fup-programados-worker` a ser criada por dev-beta/gamma.
-- Idempotente: cron.unschedule antes de cron.schedule.

SELECT cron.unschedule('fup-programados-worker');

SELECT cron.schedule(
  'fup-programados-worker',
  '*/5 * * * *',   -- a cada 5 minutos (mesmo intervalo do process-meeting-followups)
  $cron$
    SELECT public.fn_cron_http_call(
      'fup-programados-worker',
      'fup-programados-cron'
    );
  $cron$
);

-- ─── Smoke-test pós-apply ─────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'fup_programados' ORDER BY ordinal_position;
-- -- Esperado: ~17 colunas
--
-- SELECT proname FROM pg_proc WHERE proname = 'agendar_fup';
-- -- Esperado: 1 row
--
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'fup-programados-worker';
-- -- Esperado: 1 row, active=true, schedule='*/5 * * * *'
--
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'fup_programados';
-- -- Esperado: true
