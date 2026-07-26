-- =============================================================================
-- Migration: 20260726100000_closer_personal_booking.sql
-- Per-closer personal booking rule set provisioning
--
-- 1. Add owner_user_id to booking_rule_sets
-- 2. Fix get_booking_eligible_user_ids to handle specific_user before fallback
--    (also fixes live column name bugs: active->ativo, team_id->time_id, etc.)
-- 3. provision_closer_rule_set(uuid) — idempotent, creates personal rule set
-- 4. Trigger on settings_users to auto-provision on INSERT/UPDATE
-- 5. Backfill existing closer/comercial users
--
-- Live column reality (confirmed 2026-07-26):
--   settings_users      : nome, ativo, deleted_at
--   settings_teams      : ativo  (not active)
--   settings_users_teams: usuario_id, time_id  (not user_id/team_id)
--   settings_teams_pipelines: team_id, pipeline_id  (correct)
--   booking_rule_sets   : name, url_id, is_default, is_active  (no owner yet)
-- =============================================================================

BEGIN;

-- ── Step 0: Ensure 'comercial' is in the user_type constraint ────────────────
-- Live constraint: ('admin','gestor_comercial','closer') — comercial is missing.
-- The trigger needs to fire for both 'closer' and 'comercial'.

ALTER TABLE public.settings_users
  DROP CONSTRAINT IF EXISTS settings_users_user_type_check;

ALTER TABLE public.settings_users
  ADD CONSTRAINT settings_users_user_type_check
  CHECK (user_type IS NULL OR user_type = ANY (ARRAY[
    'admin'::text,
    'gestor_comercial'::text,
    'closer'::text,
    'comercial'::text
  ]));

-- ── Step 1: Add owner_user_id to booking_rule_sets ──────────────────────────

ALTER TABLE public.booking_rule_sets
  ADD COLUMN IF NOT EXISTS owner_user_id uuid
    REFERENCES public.settings_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_rule_sets_owner
  ON public.booking_rule_sets(owner_user_id);

-- ── Step 2: Fix get_booking_eligible_user_ids ────────────────────────────────
-- Rewrites with correct live column names and adds specific_user priority
-- between team_priority and the all-users fallback.
-- The 2-arg variant (with p_pipeline_id) is the one callers use.

CREATE OR REPLACE FUNCTION public.get_booking_eligible_user_ids(
  p_rule_set_id uuid DEFAULT NULL::uuid,
  p_pipeline_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rs_id           uuid;
  v_rule_team_ids   text[];
  v_found_team_rule boolean := false;
  v_team_user_ids   uuid[];
  v_result          uuid[];
  v_filtered        uuid[];
BEGIN
  -- Resolve rule set
  IF p_rule_set_id IS NOT NULL THEN
    v_rs_id := p_rule_set_id;
  ELSE
    SELECT id INTO v_rs_id
    FROM public.booking_rule_sets
    WHERE is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Priority 1: team_priority rule
  IF v_rs_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(br.config->'team_ids', '[]'::jsonb))
    )
    INTO v_rule_team_ids
    FROM public.booking_rules br
    WHERE br.rule_set_id = v_rs_id
      AND br.rule_type   = 'team_priority'
      AND br.is_active   = true
    ORDER BY br.order_index ASC
    LIMIT 1;

    v_found_team_rule := FOUND;

    IF v_found_team_rule THEN
      IF v_rule_team_ids IS NOT NULL AND array_length(v_rule_team_ids, 1) > 0 THEN
        -- Specific teams
        SELECT ARRAY(
          SELECT DISTINCT sut.usuario_id
          FROM public.settings_users_teams sut
          WHERE sut.time_id = ANY(v_rule_team_ids::uuid[])
        ) INTO v_team_user_ids;
      ELSE
        -- Any member of any active team
        SELECT ARRAY(
          SELECT DISTINCT sut.usuario_id
          FROM public.settings_users_teams sut
          INNER JOIN public.settings_teams st ON st.id = sut.time_id
          WHERE st.ativo = true
        ) INTO v_team_user_ids;
      END IF;

      -- If no members found, skip filter (defensive — never breaks booking)
      IF v_team_user_ids IS NOT NULL AND array_length(v_team_user_ids, 1) > 0 THEN
        SELECT ARRAY(
          SELECT su.id
          FROM public.settings_users su
          WHERE su.ativo = true
            AND su.deleted_at IS NULL
            AND su.id = ANY(v_team_user_ids)
        ) INTO v_result;
      END IF;
    END IF;
  END IF;

  -- Priority 2: specific_user rules (handles personal closer rule sets)
  IF v_result IS NULL OR array_length(v_result, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT DISTINCT su.id
      FROM public.booking_rules br
      INNER JOIN public.settings_users su ON su.id = (br.config->>'user_id')::uuid
      WHERE br.rule_set_id = v_rs_id
        AND br.rule_type   = 'specific_user'
        AND br.is_active   = true
        AND su.ativo       = true
        AND su.deleted_at  IS NULL
    ) INTO v_result;

    -- Only use if non-empty; otherwise reset so fallback triggers
    IF v_result IS NOT NULL AND array_length(v_result, 1) > 0 THEN
      NULL; -- keep v_result
    ELSE
      v_result := NULL;
    END IF;
  END IF;

  -- Priority 3 (fallback): all active users
  IF v_result IS NULL OR array_length(v_result, 1) IS NULL THEN
    SELECT ARRAY(
      SELECT su.id
      FROM public.settings_users su
      WHERE su.ativo = true
        AND su.deleted_at IS NULL
    ) INTO v_result;
  END IF;

  -- Pipeline filter: restrict to users in teams eligible for this pipeline.
  -- Teams with no rows in settings_teams_pipelines serve all pipelines (universal).
  -- Defensive: if filter zeroes the pool, ignore it.
  IF p_pipeline_id IS NOT NULL THEN
    SELECT ARRAY(
      SELECT DISTINCT su.id
      FROM public.settings_users su
      INNER JOIN public.settings_users_teams sut ON sut.usuario_id = su.id
      INNER JOIN public.settings_teams st ON st.id = sut.time_id
      WHERE su.id = ANY(v_result)
        AND (
          NOT EXISTS (SELECT 1 FROM public.settings_teams_pipelines stp WHERE stp.team_id = st.id)
          OR EXISTS (
            SELECT 1 FROM public.settings_teams_pipelines stp
            WHERE stp.team_id = st.id AND stp.pipeline_id = p_pipeline_id
          )
        )
    ) INTO v_filtered;

    IF v_filtered IS NOT NULL AND array_length(v_filtered, 1) > 0 THEN
      v_result := v_filtered;
    END IF;
  END IF;

  RETURN v_result;
END;
$function$;

-- Also update the 1-arg variant so it stays consistent
CREATE OR REPLACE FUNCTION public.get_booking_eligible_user_ids(
  p_rule_set_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.get_booking_eligible_user_ids(p_rule_set_id, NULL::uuid);
END;
$function$;

-- ── Step 3: provision_closer_rule_set ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.provision_closer_rule_set(p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule_set_id uuid;
  v_url_id      smallint;
  v_user_name   text;
BEGIN
  SELECT nome INTO v_user_name FROM public.settings_users WHERE id = p_user_id;

  SELECT COALESCE(MAX(url_id), 0) + 1 INTO v_url_id FROM public.booking_rule_sets;

  INSERT INTO public.booking_rule_sets (name, description, is_default, is_active, url_id, owner_user_id)
  VALUES (
    'Agenda de ' || COALESCE(v_user_name, 'Closer'),
    'Agenda pessoal de agendamento',
    false, true, v_url_id, p_user_id
  ) RETURNING id INTO v_rule_set_id;

  INSERT INTO public.booking_rules (rule_set_id, order_index, rule_type, config, is_active)
  VALUES (v_rule_set_id, 1, 'specific_user', jsonb_build_object('user_id', p_user_id), true);

  RETURN v_rule_set_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_closer_rule_set(uuid) TO authenticated;

-- ── Step 4: Trigger on settings_users ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_closer_booking_provision_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_type IN ('closer', 'comercial') AND NEW.ativo = true THEN
    IF NOT EXISTS (SELECT 1 FROM public.booking_rule_sets WHERE owner_user_id = NEW.id) THEN
      PERFORM public.provision_closer_rule_set(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_closer_booking_provision ON public.settings_users;
CREATE TRIGGER trg_closer_booking_provision
  AFTER INSERT OR UPDATE OF user_type, ativo ON public.settings_users
  FOR EACH ROW EXECUTE FUNCTION public.trg_closer_booking_provision_fn();

-- ── Step 5: Backfill existing closers/comerciais ─────────────────────────────

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.settings_users
    WHERE user_type IN ('closer', 'comercial') AND ativo = true AND deleted_at IS NULL
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.booking_rule_sets WHERE owner_user_id = r.id) THEN
      PERFORM public.provision_closer_rule_set(r.id);
    END IF;
  END LOOP;
END;
$$;

COMMIT;
