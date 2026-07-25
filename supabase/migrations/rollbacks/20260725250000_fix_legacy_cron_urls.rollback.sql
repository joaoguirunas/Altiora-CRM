-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK: FIX-SENDS-CRON-LEGACY-URLS (20260725250000)
-- Restaura crons e funções ao estado anterior ao apply.
-- AVISO: restaura GUC current_setting() que estava quebrado.
-- Só usar em emergência — o forward fix é a correção correta.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Restaurar google-calendar-sync (secure_http_post com URL legacy) ──────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'google-calendar-sync';

SELECT cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/google-cal-sync-to-db',
    '{}'::jsonb,
    'google-calendar-sync-cron'
  );
  $$
);


-- ─── 2. Restaurar process-meeting-followups (secure_http_post com URL legacy) ─
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-meeting-followups';

SELECT cron.schedule(
  'process-meeting-followups',
  '*/5 * * * *',
  $$
  SELECT public.secure_http_post(
    'service_role_cron',
    'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/process-meeting-followups',
    '{}'::jsonb,
    'process-meeting-followups-cron'
  );
  $$
);


-- ─── 3. Restaurar conversion-send-retry (GUC pattern) ────────────────────────
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'conversion-send-retry';

SELECT cron.schedule(
  'conversion-send-retry',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ─── 4. Restaurar fn_queue_conversion_event (GUC pattern) ───────────────────
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
  SELECT su.auth_user_id INTO v_lead_user_id
  FROM public.settings_users su
  WHERE su.id = NEW.user_id;

  IF v_lead_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_ARGV[0] = 'stage_change' THEN
    v_event_type := 'stage_enter';
  ELSIF TG_ARGV[0] = 'lead_won' THEN
    v_event_type := 'lead_won';
  ELSIF TG_ARGV[0] = 'lead_lost' THEN
    v_event_type := 'lead_lost';
  ELSE
    v_event_type := 'stage_enter';
  END IF;

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

  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_queue_conversion_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ─── 5. Restaurar fn_queue_conversion_booking (GUC pattern) ──────────────────
CREATE OR REPLACE FUNCTION public.fn_queue_conversion_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead              record;
  v_person            record;
  v_email_hash        text;
  v_phone_hash        text;
  v_lead_user_id      uuid;
  v_rule              record;
  v_normalized_status text;
BEGIN
  v_normalized_status := CASE NEW.status
    WHEN 'agendada'  THEN 'agendado'
    WHEN 'cancelada' THEN 'cancelado'
    WHEN 'realizada' THEN 'compareceu'
    ELSE NEW.status
  END;

  SELECT l.*, su.auth_user_id AS owner_user_id INTO v_lead
  FROM public.leads l
  LEFT JOIN public.settings_users su ON su.id = l.user_id
  WHERE l.id = NEW.lead_id;

  IF v_lead IS NULL OR v_lead.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_lead_user_id := v_lead.owner_user_id;

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

  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/conversion-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_queue_conversion_booking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ─── 6. Drop helper fn_cron_http_call ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_cron_http_call(text, text);

COMMIT;
