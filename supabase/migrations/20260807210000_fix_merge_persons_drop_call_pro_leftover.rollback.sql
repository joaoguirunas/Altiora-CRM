-- Rollback: 20260807210000_fix_merge_persons_drop_call_pro_leftover.sql
-- Restaura merge_persons e get_call_stats para o estado ANTERIOR (com
-- referência quebrada a call_pro_calls). Só usar se o smoke-test do fix
-- falhar de forma inesperada — restaurar este estado reintroduz o bug
-- original.

CREATE OR REPLACE FUNCTION public.merge_persons(p_canonical_id uuid, p_duplicate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_canonical  public.clients_people%ROWTYPE;
  v_duplicate  public.clients_people%ROWTYPE;
  v_msg_count      INT := 0;
  v_lead_count     INT := 0;
  v_meeting_count  INT := 0;
  v_call_count     INT := 0;
  v_merge_event    JSONB;
BEGIN
  SELECT * INTO v_canonical FROM public.clients_people WHERE id = p_canonical_id FOR UPDATE;
  SELECT * INTO v_duplicate FROM public.clients_people WHERE id = p_duplicate_id FOR UPDATE;

  IF v_canonical.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: canonical_id % not found', p_canonical_id;
  END IF;
  IF v_duplicate.id IS NULL THEN
    RAISE EXCEPTION 'merge_persons: duplicate_id % not found', p_duplicate_id;
  END IF;
  IF v_duplicate.status = 'merged' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already merged');
  END IF;

  -- 1. Messages
  UPDATE public.messages
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  -- 2. Leads (negócios)
  UPDATE public.leads
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_lead_count = ROW_COUNT;

  -- 3. Meetings (agendamentos)
  UPDATE public.meetings
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;
  GET DIAGNOSTICS v_meeting_count = ROW_COUNT;

  -- 4. Calls (column name: person_id)
  UPDATE public.call_pro_calls
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;
  GET DIAGNOSTICS v_call_count = ROW_COUNT;

  -- 5. Company associations — avoid (people_id, company_id) duplicates
  --    Insert rows that don't already exist for canonical, then remove duplicate's rows
  INSERT INTO public.clients_people_companies (people_id, company_id, role, is_primary, created_at, updated_at)
  SELECT p_canonical_id, company_id, role, is_primary, created_at, updated_at
  FROM   public.clients_people_companies
  WHERE  people_id = p_duplicate_id
    AND  company_id NOT IN (
           SELECT company_id FROM public.clients_people_companies
           WHERE  people_id = p_canonical_id
             AND  company_id IS NOT NULL
         );

  DELETE FROM public.clients_people_companies
  WHERE people_id = p_duplicate_id;

  -- 6. LP Submissions
  UPDATE public.lp_submissions
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 7. LP Form Submissions (column name: contact_id)
  UPDATE public.lp_form_submissions
  SET contact_id = p_canonical_id
  WHERE contact_id = p_duplicate_id;

  -- 8. Sends contacts
  UPDATE public.sends_contacts
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 9. Followup queue (column name: person_id)
  UPDATE public.followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 10. Meeting followup queue
  UPDATE public.meeting_followup_queue
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 11. Message buffer
  UPDATE public.message_buffer
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 12. AI agent execution log
  UPDATE public.ai_agents_execution_log
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 13. Merge identity fields to canonical (keep existing, fill from duplicate)
  UPDATE public.clients_people SET
    email              = COALESCE(email,              v_duplicate.email),
    document           = COALESCE(document,           v_duplicate.document),
    whatsapp           = COALESCE(whatsapp,           v_duplicate.whatsapp),
    telefone           = COALESCE(telefone,           v_duplicate.telefone),
    instagram_user_id  = COALESCE(instagram_user_id,  v_duplicate.instagram_user_id),
    instagram_id       = COALESCE(instagram_id,       v_duplicate.instagram_id),
    instagram_handle   = COALESCE(instagram_handle,   v_duplicate.instagram_handle),
    name = CASE
      WHEN name IN ('WhatsApp User', 'Instagram User', '') THEN COALESCE(NULLIF(v_duplicate.name, ''), name)
      ELSE name
    END,
    merge_history = merge_history || jsonb_build_array(
      jsonb_build_object(
        'merged_at',       NOW(),
        'duplicate_id',    p_duplicate_id,
        'duplicate_name',  v_duplicate.name,
        'messages_moved',  v_msg_count,
        'leads_moved',     v_lead_count,
        'meetings_moved',  v_meeting_count,
        'calls_moved',     v_call_count
      )
    ),
    updated_at = NOW()
  WHERE id = p_canonical_id;

  -- 14. Mark duplicate as merged
  UPDATE public.clients_people SET
    status         = 'merged',
    merged_into_id = p_canonical_id,
    updated_at     = NOW()
  WHERE id = p_duplicate_id;

  v_merge_event := jsonb_build_object(
    'canonical_id',   p_canonical_id,
    'duplicate_id',   p_duplicate_id,
    'messages_moved', v_msg_count,
    'leads_moved',    v_lead_count,
    'meetings_moved', v_meeting_count,
    'calls_moved',    v_call_count
  );

  RETURN v_merge_event;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_call_stats(date_from timestamp with time zone, date_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total         bigint;
  v_answered      bigint;
  v_missed        bigint;
  v_failed        bigint;
  v_outbound      bigint;
  v_inbound       bigint;
  v_answer_rate   numeric;
  v_avg_duration  bigint;
  v_total_cost    numeric;
  v_avg_cost      numeric;
  v_off_hours_rate numeric;
  v_by_operator   jsonb;
  v_evolution     jsonb;
  v_top_outcomes  jsonb;
begin
  -- KPIs (single aggregate scan)
  select
    count(*),
    count(*) filter (where status = 'answered'),
    count(*) filter (where status in ('missed','abandoned')),
    count(*) filter (where status in ('failed','no-answer')),
    count(*) filter (where direction = 'outbound'),
    count(*) filter (where direction = 'inbound'),
    round(
      case when count(*) > 0
        then count(*) filter (where status = 'answered') * 100.0 / count(*)
        else 0
      end, 2),
    coalesce(round(avg(duration) filter (where status = 'answered' and duration > 0))::bigint, 0),
    coalesce(sum(cost) filter (where cost > 0), 0),
    coalesce(avg(cost) filter (where cost > 0), 0),
    round(
      case when count(*) > 0
        then count(*) filter (where business_hours_call = false) * 100.0 / count(*)
        else 0
      end, 2)
  into
    v_total, v_answered, v_missed, v_failed,
    v_outbound, v_inbound, v_answer_rate, v_avg_duration,
    v_total_cost, v_avg_cost, v_off_hours_rate
  from call_pro_calls
  where started_at >= date_from
    and started_at <= date_to;

  -- By operator
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId',      coalesce(c.user_id, '__unknown__'),
        'name',        coalesce(u.name, 'Desconhecido'),
        'total',       count(*),
        'answered',    count(*) filter (where c.status = 'answered'),
        'missed',      count(*) filter (where c.status in ('missed','abandoned')),
        'answerRate',  round(
                         case when count(*) > 0
                           then count(*) filter (where c.status = 'answered') * 100.0 / count(*)
                           else 0
                         end, 2),
        'avgDuration', coalesce(
                         round(avg(c.duration) filter (where c.status = 'answered' and c.duration > 0))::bigint,
                         0)
      )
      order by count(*) desc
    ),
    '[]'::jsonb
  )
  into v_by_operator
  from call_pro_calls c
  left join settings_users u on u.id = c.user_id
  where c.started_at >= date_from
    and c.started_at <= date_to
  group by c.user_id, u.name;

  -- Evolution (daily)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date',     to_char(day, 'YYYY-MM-DD'),
        'total',    total,
        'answered', answered,
        'missed',   missed
      )
      order by day
    ),
    '[]'::jsonb
  )
  into v_evolution
  from (
    select
      (started_at at time zone 'UTC')::date                       as day,
      count(*)                                                     as total,
      count(*) filter (where status = 'answered')                 as answered,
      count(*) filter (where status in ('missed','abandoned'))    as missed
    from call_pro_calls
    where started_at >= date_from
      and started_at <= date_to
    group by (started_at at time zone 'UTC')::date
  ) daily;

  -- Top outcomes (up to 8)
  select coalesce(
    jsonb_agg(
      jsonb_build_object('outcome', outcome, 'count', cnt)
      order by cnt desc
    ),
    '[]'::jsonb
  )
  into v_top_outcomes
  from (
    select outcome, count(*) as cnt
    from call_pro_calls
    where started_at >= date_from
      and started_at <= date_to
      and outcome is not null
    group by outcome
    order by cnt desc
    limit 8
  ) outcomes;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'total',          v_total,
      'answered',       v_answered,
      'missed',         v_missed,
      'failed',         v_failed,
      'outbound',       v_outbound,
      'inbound',        v_inbound,
      'answerRate',     v_answer_rate,
      'avgDuration',    v_avg_duration,
      'totalCost',      v_total_cost,
      'avgCostPerCall', v_avg_cost,
      'offHoursRate',   v_off_hours_rate
    ),
    'byOperator',  v_by_operator,
    'evolution',   v_evolution,
    'topOutcomes', v_top_outcomes
  );
end;
$function$

