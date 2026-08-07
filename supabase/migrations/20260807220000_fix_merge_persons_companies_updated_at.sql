-- Fix merge_persons() passo 5 (company associations): a function referenciava
-- clients_people_companies.updated_at, coluna que NUNCA existiu nessa tabela
-- (confirmado via information_schema.columns: id, people_id, company_id,
-- role, is_primary, created_at — sem updated_at). Isso quebrava QUALQUER
-- merge real que chegasse ao passo 5 — bug pré-existente e independente do
-- gap de call_pro_calls corrigido em 20260807210000, exposto pela simulação
-- de smoke-test dessa migration anterior (o merge nunca tinha chegado tão
-- longe antes, sempre falhava primeiro no passo 4/call_pro_calls).
--
-- Mesmo fluxo que bloqueia o usuário hoje: criar referral manual -> INSERT em
-- clients_people -> trigger trg_identity_auto_merge -> merge_persons. Corrigir
-- só o passo 4 sem corrigir o passo 5 não desbloqueia nada na prática — o
-- merge continuaria falhando, só que com mensagem diferente.
--
-- Fix: remove `updated_at` da lista de colunas do INSERT e do SELECT,
-- mantendo `created_at` (que existe de fato). Resto do bloco (INSERT +
-- DELETE de duplicatas) intocado.
--
-- Auditoria adicional (2026-08-07): simulação completa do merge_persons até
-- o passo 14 (via função de diagnóstico temporária, trigger desabilitada
-- para evitar recursão via nested UPDATE, nunca commitada) revelou MAIS 4
-- gaps não relacionados, NÃO corrigidos nesta migration (fora do escopo
-- autorizado — aguardando decisão do coordenador):
--   - Passo 6: tabela lp_submissions não existe
--   - Passo 7: tabela lp_form_submissions não existe
--   - Passo 8: tabela sends_contacts não existe
--   - Passo 10: meeting_followup_queue não tem coluna people_id (coluna real
--     é person_id)
-- Passos 1, 2, 3, 9, 11, 12, 13, 14 confirmados limpos na simulação.

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

  -- 4. Calls: removido em 20260807210000 — call_pro_calls foi dropada
  -- (módulo de telefonia legado descontinuado em 20260609000000).

  -- 5. Company associations — avoid (people_id, company_id) duplicates
  --    Insert rows that don't already exist for canonical, then remove duplicate's rows
  --    (updated_at removido — clients_people_companies não tem essa coluna)
  INSERT INTO public.clients_people_companies (people_id, company_id, role, is_primary, created_at)
  SELECT p_canonical_id, company_id, role, is_primary, created_at
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
