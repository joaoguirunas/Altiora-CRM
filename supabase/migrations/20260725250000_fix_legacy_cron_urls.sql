-- ══════════════════════════════════════════════════════════════════════════════
-- FIX-SENDS-CRON-LEGACY-URLS: Sanear 3 crons com URLs/config legados
-- Story: docs/smart-memory/stories/backlog/FIX-SENDS-CRON-LEGACY-URLS.md
--
-- Problema raiz:
--   1. google-calendar-sync e process-meeting-followups: URLs hardcoded para
--      ohzwetkaazgxafubzvop.supabase.co (banco desativado).
--   2. conversion-send-retry, fn_queue_conversion_event e fn_queue_conversion_booking:
--      usam current_setting('app.settings.supabase_url'/'service_role_key') — GUCs
--      nunca populados em ambiente single-tenant.
--
-- Fix: criar fn_cron_http_call() que lê supabase_url + service_role_key de
-- _app_config em runtime, e registrar todos os crons/funções afetados para
-- usá-la. Padrão já adotado por omni-delivery-engine e sends-dispatch-batch.
--
-- Rollback: supabase/migrations/rollbacks/20260725250000_fix_legacy_cron_urls.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- AC1 — Diagnóstico (evidência de falhas silenciosas antes do apply):
-- SELECT jobname, status, return_message, start_time
-- FROM cron.job_run_details
-- WHERE jobname IN ('google-calendar-sync', 'process-meeting-followups', 'conversion-send-retry')
--   AND start_time > now() - INTERVAL '24 hours'
-- ORDER BY start_time DESC;
-- Esperado: status='failed' ou return_message LIKE '%could not resolve host%' ou NULL

BEGIN;

-- ─── 1. Helper centralizado: fn_cron_http_call ────────────────────────────────
-- Lê supabase_url + service_role_key de _app_config em runtime.
-- Sem hardcode. Sem GUC. Sem JWT no código.
-- Usado pelos 3 crons e pelas 2 trigger functions de conversão.

CREATE OR REPLACE FUNCTION public.fn_cron_http_call(
  fn_path    text,
  caller_ctx text DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT value INTO v_url FROM public._app_config WHERE key = 'supabase_url';
  SELECT value INTO v_key FROM public._app_config WHERE key = 'service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'fn_cron_http_call: _app_config missing supabase_url or service_role_key (caller: %)', caller_ctx;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/' || fn_path,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_cron_http_call(%) failed: %', caller_ctx, SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.fn_cron_http_call(text, text) IS
  'Dispara POST para edge function lendo URL e chave de _app_config. '
  'Substitui hardcodes de URL e GUCs app.settings.* nos crons periféricos.';


-- ─── 2. AC2: Cron google-calendar-sync ───────────────────────────────────────
-- Era: secure_http_post com URL hardcoded para ohzwetkaazgxafubzvop.supabase.co
-- Agora: fn_cron_http_call lê URL de _app_config em runtime

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'google-calendar-sync';

SELECT cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $cron$
    SELECT public.fn_cron_http_call(
      'google-cal-sync-to-db',
      'google-calendar-sync'
    );
  $cron$
);


-- ─── 3. AC2: Cron process-meeting-followups ──────────────────────────────────
-- Era: secure_http_post com URL hardcoded para ohzwetkaazgxafubzvop.supabase.co
-- Agora: fn_cron_http_call lê URL de _app_config em runtime

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-meeting-followups';

SELECT cron.schedule(
  'process-meeting-followups',
  '*/5 * * * *',
  $cron$
    SELECT public.fn_cron_http_call(
      'process-meeting-followups',
      'process-meeting-followups-cron'
    );
  $cron$
);


-- ─── 4. AC3: Cron conversion-send-retry ──────────────────────────────────────
-- Era: net.http_post com current_setting('app.settings.supabase_url') → GUC NULL
-- Agora: fn_cron_http_call lê URL de _app_config em runtime

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'conversion-send-retry';

SELECT cron.schedule(
  'conversion-send-retry',
  '*/5 * * * *',
  $cron$
    SELECT public.fn_cron_http_call(
      'conversion-send',
      'conversion-send-retry-cron'
    );
  $cron$
);


-- ─── 5. AC3: fn_queue_conversion_event — trocar GUC por _app_config ──────────
-- Era: current_setting('app.settings.supabase_url', true) → sempre NULL
-- Agora: fn_cron_http_call('conversion-send', ...)

CREATE OR REPLACE FUNCTION public.fn_queue_conversion_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_person       record;
  v_email_hash   text;
  v_phone_hash   text;
  v_lead_user_id uuid;
  v_rule         record;
  v_event_type   text;
BEGIN
  -- Resolve the owner (user_id) of this lead via settings_users
  SELECT su.auth_user_id INTO v_lead_user_id
  FROM public.settings_users su
  WHERE su.id = NEW.user_id;

  IF v_lead_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine event type from trigger argument
  IF TG_ARGV[0] = 'stage_change' THEN
    v_event_type := 'stage_enter';
  ELSIF TG_ARGV[0] = 'lead_won' THEN
    v_event_type := 'lead_won';
  ELSIF TG_ARGV[0] = 'lead_lost' THEN
    v_event_type := 'lead_lost';
  ELSE
    v_event_type := 'stage_enter';
  END IF;

  -- Fetch + hash person data for CAPI / Enhanced Conversions
  IF NEW.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people
    WHERE id = NEW.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Queue one entry per matching rule
  FOR v_rule IN
    SELECT id, name, trigger_type, trigger_config,
           meta_enabled, meta_event_name, meta_send_value, meta_pixel_id,
           google_enabled, google_conversion_action_id, google_send_value,
           google_currency, google_account_id
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND (meta_enabled = true OR google_enabled = true)
      AND trigger_type = v_event_type
  LOOP
    IF v_event_type = 'stage_enter' AND (v_rule.trigger_config->>'stage_id') IS NOT NULL THEN
      IF (v_rule.trigger_config->>'stage_id') <> NEW.leads_stages_id::text THEN
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      NEW.id,
      NEW.leads_stages_id,
      COALESCE(NEW.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',                     v_rule.id::text,
        'rule_name',                   v_rule.name,
        'trigger_type',                v_rule.trigger_type,
        'gclid',                       NEW.gclid,
        'fbclid',                      NEW.fbclid,
        'fbc',                         NEW.fbc,
        'fbp',                         NEW.fbp,
        'fb_lead_id',                  NEW.fb_lead_id,
        'email_hash',                  v_email_hash,
        'phone_hash',                  v_phone_hash,
        'value',                       NEW.value,
        'timestamp',                   extract(epoch from now())::bigint,
        'meta_pixel_id',               v_rule.meta_pixel_id,
        'meta_event_name',             v_rule.meta_event_name,
        'meta_send_value',             v_rule.meta_send_value,
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled  THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- FIX: era current_setting('app.settings.supabase_url') — GUC não populado.
  -- Agora usa fn_cron_http_call que lê de _app_config em runtime.
  BEGIN
    PERFORM public.fn_cron_http_call('conversion-send', 'fn_queue_conversion_event');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block lead updates due to conversion tracking failure
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_queue_conversion_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ─── 6. AC3: fn_queue_conversion_booking — trocar GUC por _app_config ────────
-- Era: current_setting('app.settings.supabase_url', true) → sempre NULL
-- Agora: fn_cron_http_call('conversion-send', ...)

CREATE OR REPLACE FUNCTION public.fn_queue_conversion_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead             record;
  v_person           record;
  v_email_hash       text;
  v_phone_hash       text;
  v_lead_user_id     uuid;
  v_rule             record;
  v_normalized_status text;
BEGIN
  -- Normalize meeting status for matching
  v_normalized_status := CASE NEW.status
    WHEN 'agendada'  THEN 'agendado'
    WHEN 'cancelada' THEN 'cancelado'
    WHEN 'realizada' THEN 'compareceu'
    ELSE NEW.status
  END;

  -- Get the lead associated with this meeting
  SELECT l.*, su.auth_user_id AS owner_user_id INTO v_lead
  FROM public.leads l
  LEFT JOIN public.settings_users su ON su.id = l.user_id
  WHERE l.id = NEW.lead_id;

  IF v_lead IS NULL OR v_lead.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_lead_user_id := v_lead.owner_user_id;

  -- Hash person data
  IF v_lead.people_id IS NOT NULL THEN
    SELECT email, whatsapp INTO v_person
    FROM public.clients_people WHERE id = v_lead.people_id;

    IF v_person.email IS NOT NULL AND v_person.email <> '' THEN
      v_email_hash := encode(digest(lower(trim(v_person.email)), 'sha256'), 'hex');
    END IF;
    IF v_person.whatsapp IS NOT NULL AND v_person.whatsapp <> '' THEN
      v_phone_hash := encode(digest(regexp_replace(v_person.whatsapp, '[^0-9+]', '', 'g'), 'sha256'), 'hex');
    END IF;
  END IF;

  -- Queue one entry per matching booking_status rule
  FOR v_rule IN
    SELECT *
    FROM public.conversion_event_rules
    WHERE user_id = v_lead_user_id
      AND active = true
      AND trigger_type = 'booking_status'
      AND (meta_enabled = true OR google_enabled = true)
      AND (trigger_config->>'status') = v_normalized_status
  LOOP
    INSERT INTO public.conversion_events_queue (
      user_id, lead_id, stage_id, lead_source, event_data,
      meta_status, google_status
    ) VALUES (
      v_lead_user_id,
      v_lead.id,
      v_lead.leads_stages_id,
      COALESCE(v_lead.lead_source, 'unknown'),
      jsonb_build_object(
        'rule_id',                     v_rule.id::text,
        'rule_name',                   v_rule.name,
        'trigger_type',                'booking_status',
        'booking_status',              v_normalized_status,
        'meeting_id',                  NEW.id::text,
        'gclid',                       v_lead.gclid,
        'fbclid',                      v_lead.fbclid,
        'fbc',                         v_lead.fbc,
        'fbp',                         v_lead.fbp,
        'fb_lead_id',                  v_lead.fb_lead_id,
        'email_hash',                  v_email_hash,
        'phone_hash',                  v_phone_hash,
        'value',                       v_lead.value,
        'timestamp',                   extract(epoch from now())::bigint,
        'meta_pixel_id',               v_rule.meta_pixel_id,
        'meta_event_name',             v_rule.meta_event_name,
        'meta_send_value',             v_rule.meta_send_value,
        'google_account_id',           v_rule.google_account_id,
        'google_conversion_action_id', v_rule.google_conversion_action_id,
        'google_send_value',           v_rule.google_send_value,
        'google_currency',             v_rule.google_currency
      ),
      CASE WHEN v_rule.meta_enabled  THEN 'pending' ELSE 'skipped' END,
      CASE WHEN v_rule.google_enabled THEN 'pending' ELSE 'skipped' END
    );
  END LOOP;

  -- FIX: era current_setting('app.settings.supabase_url') — GUC não populado.
  -- Agora usa fn_cron_http_call que lê de _app_config em runtime.
  BEGIN
    PERFORM public.fn_cron_http_call('conversion-send', 'fn_queue_conversion_booking');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Never block meeting updates due to conversion tracking failure
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_queue_conversion_booking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMIT;

-- ─── AC5 Smoke-test (executar após apply e aguardar ~2 min) ──────────────────
-- SELECT jobname, status, return_message, start_time
-- FROM cron.job_run_details
-- WHERE jobname IN ('google-calendar-sync', 'process-meeting-followups', 'conversion-send-retry')
--   AND start_time > now() - INTERVAL '10 minutes'
-- ORDER BY start_time DESC;
-- Esperado: status='succeeded' (ou 'started' se ainda rodando)
-- Nota: se _app_config.supabase_url não estiver populado, status='succeeded' mas
--       fn_cron_http_call emite WARNING — não é falha de migration, é config gap.
