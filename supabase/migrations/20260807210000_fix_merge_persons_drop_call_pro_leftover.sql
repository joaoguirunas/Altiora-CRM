-- Fix schema drift leftover: call_pro_calls ainda referenciada em merge_persons()
-- e em get_call_stats() (segunda ocorrência do mesmo drift já corrigido em
-- get_insights_context via 20260807200000_fix_insights_context_drop_call_pro.sql).
--
-- Cadeia de disparo confirmada (2026-08-07): trigger trg_identity_auto_merge
-- (AFTER INSERT OR UPDATE OF email/document/whatsapp/instagram_user_id/
-- instagram_handle ON clients_people) -> trg_auto_merge_on_identity() ->
-- find_duplicate_person() acha duplicata de identidade -> PERFORM
-- merge_persons(canonical, duplicate) -> UPDATE public.call_pro_calls falha
-- com "relation \"public.call_pro_calls\" does not exist". Dispara em
-- qualquer INSERT/UPDATE em clients_people que colida em identidade com um
-- registro já existente (não é exclusivo do modal "Novo Referral Manual").
--
-- Gap 1 (merge_persons): remove o bloco "4. Calls (column name: person_id)"
-- que fazia UPDATE call_pro_calls, e remove 'calls_moved' do merge_history/
-- retorno correspondente. Resto da function (messages, leads, meetings,
-- clients_people_companies, lp_submissions, lp_form_submissions,
-- sends_contacts, followup_queue, meeting_followup_queue, message_buffer,
-- ai_agents_execution_log, merge de campos de identidade) fica intocado.
--
-- Gap 2 (get_call_stats): function inteira é baseada em call_pro_calls
-- (KPIs do dashboard Call Pro™ — descontinuado por 20260609000000). Confirmado
-- que nenhum lugar do frontend chama esta RPC (só aparece em
-- src/integrations/supabase/types.ts, que são tipos gerados por introspecção
-- do schema, não uma chamada real) -> function órfã, drop definitivo.

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

  -- 4. Calls: removido — call_pro_calls foi dropada em 20260609000000
  -- (Call Pro™ descontinuado). Bloco antigo fazia UPDATE call_pro_calls
  -- SET person_id = p_canonical_id WHERE person_id = p_duplicate_id.

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
        'meetings_moved',  v_meeting_count
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
    'meetings_moved', v_meeting_count
  );

  RETURN v_merge_event;
END;
$function$;

-- get_call_stats: órfã (Call Pro™ descontinuado, nenhuma chamada real no
-- frontend — confirmado, só aparece em tipos gerados por introspecção).
DROP FUNCTION IF EXISTS public.get_call_stats(timestamp with time zone, timestamp with time zone);
