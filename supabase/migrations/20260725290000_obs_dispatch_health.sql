-- ══════════════════════════════════════════════════════════════════════════════
-- OBS-DISPATCH-HEALTH-01 — AC1 + AC2 + AC3 + AC7 (DB part)
-- View v_dispatch_health + RPC get_send_health
--
-- Contexto (RCA 2026-05-01): diagnóstico de bugs de disparo exigia 6 SQLs
-- distintos + acesso MCP. Esta migration cria infra nativa de observabilidade
-- que torna o estado do pipeline de disparo visível via UI/RPC.
--
-- Componentes criados:
--   1. _get_cron_health_metrics()  — SECURITY DEFINER, acessa cron.* schema
--   2. v_dispatch_health           — view com RLS via WHERE clause
--   3. get_send_health(send_id)    — RPC SECURITY DEFINER retornando JSONB
--
-- Crons monitorados:
--   'omni-delivery-engine'   — delivery de mensagens OMNI
--   'sends-dispatch-batch'   — batches de campanhas Sends PRO
--   'process-message-buffer' — processamento de buffer de mensagens
--
-- Pré-condições verificadas (schema audit 2026-07-25):
--   cron.job, cron.job_run_details — existem (pg_cron extension)
--   sends.last_batch_at            — existe (20260423010000 + fwup31)
--   sends.wa_channel_id            — existe, FK → settings_whatsapp_channels
--   sends.template_id              — existe, uuid FK → whatsapp_templates (20260423015000)
--   messages.source_type           — existe, 'campaign' é valor válido
--   messages.module_ref_id         — existe, uuid (send_id para campanhas)
--   messages.metadata              — existe, jsonb (delivery_error gravado pelo bridge)
--   settings_whatsapp_channels     — access_token, is_default, active existem
--   whatsapp_templates             — name, status existem
--
-- AC4 (componente DispatchHealthCard) → dev-dev-alpha (Aria) — fora de escopo DB
-- AC5 (integração Disparos.tsx) → dev-dev-alpha — fora de escopo DB
-- AC6 (smoke-test E2E) → dev-qa (Axikar) — fora de escopo DB
--
-- Rollback: supabase/migrations/rollbacks/20260725290000_obs_dispatch_health.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;


-- ─── 1. Helper: acessa cron.* schema (requires elevated privilege) ───────────
-- SECURITY DEFINER necessário porque o role 'authenticated' não tem acesso ao
-- schema 'cron' em Supabase. A função expõe apenas as colunas necessárias.
-- SET search_path inclui 'cron' para acesso explícito sem alias.

CREATE OR REPLACE FUNCTION public._get_cron_health_metrics()
RETURNS TABLE (
  jobname         text,
  schedule        text,
  active          boolean,
  runs_5min       bigint,
  failures_30min  bigint,
  last_run_at     timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    j.jobname,
    j.schedule,
    j.active,
    -- Execuções bem-sucedidas nos últimos 5 minutos (threshold para LED verde)
    COUNT(CASE
      WHEN r.start_time > now() - interval '5 minutes'
        AND r.status = 'succeeded'
      THEN 1
    END)::bigint AS runs_5min,
    -- Falhas nos últimos 30 minutos (threshold para LED amarelo)
    COUNT(CASE
      WHEN r.start_time > now() - interval '30 minutes'
        AND r.status = 'failed'
      THEN 1
    END)::bigint AS failures_30min,
    -- Último run (qualquer status)
    MAX(r.start_time) AS last_run_at
  FROM cron.job j
  LEFT JOIN cron.job_run_details r
    ON r.jobid = j.jobid
    -- Limita o scan ao período máximo necessário (30 min)
    AND r.start_time > now() - interval '30 minutes'
  WHERE j.jobname IN (
    'omni-delivery-engine',
    'sends-dispatch-batch',
    'process-message-buffer'
  )
  GROUP BY j.jobid, j.jobname, j.schedule, j.active
  ORDER BY j.jobname;
$$;

COMMENT ON FUNCTION public._get_cron_health_metrics() IS
  'OBS-DISPATCH-HEALTH-01: Acessa cron.job + cron.job_run_details via SECURITY DEFINER. '
  'Retorna métricas dos 3 crons críticos de disparo. Uso interno por v_dispatch_health.';


-- ─── 2. View v_dispatch_health (AC1 + AC2) ───────────────────────────────────
-- Uma row por cron monitorado (3 rows total).
-- Métricas globais (pending_5min, error_30min, etc.) são iguais para todas as rows.
--
-- AC2 (RLS): view não suporta RLS diretamente. Proteção via WHERE clause que
-- verifica se o caller é super_admin, gestor, ou service_role. Authenticated
-- users sem role adequado recebem 0 rows (sem erro — padrão Supabase).

DROP VIEW IF EXISTS public.v_dispatch_health;

CREATE OR REPLACE VIEW public.v_dispatch_health AS
SELECT
  -- ── Métricas por cron (uma row por job) ──────────────────────────────────
  c.jobname,
  c.schedule,
  c.active           AS cron_active,
  c.runs_5min,
  c.failures_30min,
  c.last_run_at,

  -- ── Métricas globais de fila (iguais em todas as rows) ────────────────────
  -- pending_5min: msgs outbound travadas há mais de 5 min (sintoma de cron parado)
  (SELECT COUNT(*)
     FROM public.messages m
    WHERE m.status       = 'pending'
      AND m.created_at   < now() - interval '5 minutes'
      AND m.from_contact <> 'cliente'
  )::bigint AS pending_5min,

  -- error_30min: msgs outbound com erro nos últimos 30 min
  (SELECT COUNT(*)
     FROM public.messages m
    WHERE m.status       = 'error'
      AND m.created_at   > now() - interval '30 minutes'
      AND m.from_contact <> 'cliente'
  )::bigint AS error_30min,

  -- expired_24h: msgs outbound em pending há mais de 24h (gap A1 beta — MAX_AGE)
  (SELECT COUNT(*)
     FROM public.messages m
    WHERE m.status       = 'pending'
      AND m.created_at   < now() - interval '24 hours'
      AND m.from_contact <> 'cliente'
  )::bigint AS expired_24h,

  -- running_stuck: campanhas em status 'running' sem batch recente há > 1h (gap A16 beta)
  (SELECT COUNT(*)
     FROM public.sends s
    WHERE s.status         = 'running'
      AND (
        s.last_batch_at IS NULL
        OR s.last_batch_at < now() - interval '1 hour'
      )
  )::bigint AS running_stuck

FROM public._get_cron_health_metrics() c
-- ── AC2 — Restrição de acesso: super_admin, gestor/manager, ou service_role ──
WHERE (
  -- Usuário autenticado com role adequado
  EXISTS (
    SELECT 1 FROM public.settings_users su
    WHERE su.auth_user_id = auth.uid()
      AND (
        su.super_admin = true
        OR su.user_type IN ('gestor', 'admin')
      )
      AND su.active     = true
      AND su.deleted_at IS NULL
  )
  -- Ou chamada interna via service_role (CI, edge fns internas)
  OR current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
);

COMMENT ON VIEW public.v_dispatch_health IS
  'OBS-DISPATCH-HEALTH-01: Visão consolidada do estado dos crons de disparo. '
  'Acesso restrito a super_admin / gestor / service_role. '
  'Atualizada a cada query (stateless — não materializada). '
  'Fonte para DispatchHealthCard LEDs (AC4 — dev-alpha).';

-- Grant mínimo: autenticados podem tentar SELECT (WHERE clause filtra internamente)
REVOKE ALL ON public.v_dispatch_health FROM PUBLIC;
GRANT SELECT ON public.v_dispatch_health TO authenticated, service_role;


-- ─── 3. RPC get_send_health(send_id uuid) (AC3) ──────────────────────────────
-- Retorna JSONB com métricas de saúde de uma campanha específica.
-- SECURITY DEFINER necessário para:
--   a) acessar cron.job_run_details (schema cron)
--   b) ler _app_config sem expor a tabela diretamente ao frontend
--
-- Output schema:
-- {
--   "pg_cron_alive": bool,          -- algum dos 3 crons rodou OK nos últimos 5 min
--   "last_dispatch_at": timestamp,  -- sends.last_batch_at
--   "channel_status": {
--     "has_token": bool,            -- settings_whatsapp_channels.access_token IS NOT NULL
--     "is_default": bool,           -- channel.is_default
--     "active": bool                -- channel.active
--   },
--   "template_status": {
--     "meta_template_name_present": bool,  -- sends.template_id IS NOT NULL
--     "meta_template_status": text         -- whatsapp_templates.status (e.g. 'ativo')
--   },
--   "pending_count": int,           -- msgs campaign pending para este send
--   "error_count_by_reason": {      -- msgs campaign error agrupadas por delivery_error.title
--     "Marketing opt out": 3, ...
--   }
-- }

CREATE OR REPLACE FUNCTION public.get_send_health(send_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_send              record;
  v_channel           record;
  v_template          record;
  v_pg_cron_alive     boolean;
  v_pending_count     bigint;
  v_error_by_reason   jsonb;
  v_result            jsonb;
BEGIN
  -- ── Validação de acesso ───────────────────────────────────────────────────
  -- Caller deve ser super_admin, gestor, ou service_role.
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.settings_users su
      WHERE su.auth_user_id = auth.uid()
        AND (su.super_admin = true OR su.user_type IN ('gestor', 'admin'))
        AND su.active = true AND su.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Insufficient permissions to call get_send_health'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- ── Dados do send ─────────────────────────────────────────────────────────
  SELECT s.last_batch_at, s.wa_channel_id, s.template_id, s.status
    INTO v_send
    FROM public.sends s
   WHERE s.id = send_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'send_id % not found', send_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- ── Channel status ────────────────────────────────────────────────────────
  IF v_send.wa_channel_id IS NOT NULL THEN
    SELECT ch.access_token IS NOT NULL AS has_token,
           ch.is_default,
           ch.active
      INTO v_channel
      FROM public.settings_whatsapp_channels ch
     WHERE ch.id = v_send.wa_channel_id;
  END IF;

  -- ── Template status ───────────────────────────────────────────────────────
  IF v_send.template_id IS NOT NULL THEN
    SELECT wt.status
      INTO v_template
      FROM public.whatsapp_templates wt
     WHERE wt.id = v_send.template_id;
  END IF;

  -- ── pg_cron alive: algum dos 3 crons rodou com sucesso nos últimos 5 min ──
  SELECT EXISTS (
    SELECT 1
      FROM cron.job j
      JOIN cron.job_run_details r ON r.jobid = j.jobid
     WHERE j.jobname IN (
       'omni-delivery-engine',
       'sends-dispatch-batch',
       'process-message-buffer'
     )
       AND r.status     = 'succeeded'
       AND r.start_time > now() - interval '5 minutes'
  ) INTO v_pg_cron_alive;

  -- ── Pending messages count para este send ─────────────────────────────────
  SELECT COUNT(*)
    INTO v_pending_count
    FROM public.messages m
   WHERE m.source_type    = 'campaign'
     AND m.module_ref_id  = send_id
     AND m.status         = 'pending';

  -- ── Error count agrupado por reason (metadata.delivery_error.title) ───────
  SELECT COALESCE(
    jsonb_object_agg(
      COALESCE(m.metadata -> 'delivery_error' ->> 'title', 'unknown'),
      count_val
    ),
    '{}'::jsonb
  )
    INTO v_error_by_reason
    FROM (
      SELECT
        COALESCE(m2.metadata -> 'delivery_error' ->> 'title', 'unknown') AS reason,
        COUNT(*) AS count_val
      FROM public.messages m2
      WHERE m2.source_type   = 'campaign'
        AND m2.module_ref_id = send_id
        AND m2.status        = 'error'
      GROUP BY reason
    ) m;

  -- ── Montar resultado ─────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'pg_cron_alive',    v_pg_cron_alive,
    'last_dispatch_at', v_send.last_batch_at,
    'channel_status',   CASE
      WHEN v_channel IS NULL THEN
        jsonb_build_object('has_token', false, 'is_default', false, 'active', false)
      ELSE
        jsonb_build_object(
          'has_token',  v_channel.has_token,
          'is_default', v_channel.is_default,
          'active',     v_channel.active
        )
    END,
    'template_status',  jsonb_build_object(
      'meta_template_name_present', v_send.template_id IS NOT NULL,
      'meta_template_status',       v_template.status
    ),
    'pending_count',        v_pending_count,
    'error_count_by_reason', v_error_by_reason
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Re-raise erros de permissão/not_found como está; wrapa outros erros
  IF SQLSTATE IN ('42501', 'P0001', 'insufficient_privilege', 'no_data_found') THEN
    RAISE;
  END IF;
  RAISE EXCEPTION 'get_send_health(%) failed: %', send_id, SQLERRM
    USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.get_send_health(uuid) IS
  'OBS-DISPATCH-HEALTH-01: RPC que retorna JSONB com estado de saúde de uma campanha '
  '(send_id). Cruza sends, settings_whatsapp_channels, whatsapp_templates, messages '
  'e cron.job_run_details. Acesso restrito a super_admin / gestor / service_role. '
  'Consumido pelo componente DispatchHealthCard (dev-alpha AC4+AC5).';

REVOKE ALL ON FUNCTION public.get_send_health(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_send_health(uuid) TO authenticated, service_role;

COMMIT;


-- ─── Smoke-test pós-apply ────────────────────────────────────────────────────
-- 1. Confirmar função _get_cron_health_metrics criada:
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_schema = 'public' AND routine_name = '_get_cron_health_metrics';
-- -- Esperado: 1 row
--
-- 2. Confirmar view v_dispatch_health criada:
-- SELECT table_name FROM information_schema.views
--  WHERE table_schema = 'public' AND table_name = 'v_dispatch_health';
-- -- Esperado: 1 row
--
-- 3. Confirmar RPC get_send_health criada:
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_schema = 'public' AND routine_name = 'get_send_health';
-- -- Esperado: 1 row
--
-- 4. Teste de acesso (como service_role):
-- SELECT * FROM public.v_dispatch_health;
-- -- Esperado: até 3 rows (uma por cron monitorado)
--
-- 5. Teste de RPC (substituir {uuid_valido} por send_id existente):
-- SELECT public.get_send_health('{uuid_valido}'::uuid);
-- -- Esperado: JSONB com todas as chaves acima
