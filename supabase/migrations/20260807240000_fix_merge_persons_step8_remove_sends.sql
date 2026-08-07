-- Correção do passo 8 de merge_persons: a migration anterior
-- (20260807230000) apontou o passo 8 para `sends_people`, assumindo que
-- fosse a renomeação/consolidação de `sends_contacts`. Investigação mais
-- profunda (dono do produto + análise de uso real no código) mostrou que a
-- suposição estava ERRADA — o quadro é o INVERSO:
--
--   - `sends_contacts` era a tabela VIVA de fato: usada pelo frontend
--     (useSendContacts.ts, useSendMutations.ts, useSendContactMutations.ts,
--     useResetSendStats.ts, TabelaContatos.tsx) e por 4 edge functions
--     (send-dispatch-worker, send-status-callback, sends-import-contacts,
--     atende-simples-webhook). Foi REMOVIDA INTENCIONALMENTE pelo dono do
--     produto ("não tem mais necessidade") — não é schema drift acidental,
--     é decisão de produto.
--   - `sends_people` é VESTIGIAL: criada em 20251108195513 e nunca
--     adotada — confirmado `SELECT count(*) FROM sends_people` = 0 e
--     nenhum código escreve nela (só um DELETE defensivo em
--     useDeletarPessoa.ts:180). Apontar o passo 8 para ela seria reparentar
--     uma tabela que ninguém alimenta — não corrige nada de verdade.
--
-- Fix: remove o passo 8 por completo (mesmo padrão do call_pro_calls e do
-- lp_form_submissions — funcionalidade descontinuada, sem tabela viva
-- equivalente para reparentar). Se `sends_contacts` for reintroduzida no
-- futuro por decisão de produto, este passo precisa ser recriado apontando
-- para a nova tabela.
--
-- Resto da function (passos 1-7, 9-14, já corrigidos em 210000/220000/230000)
-- permanece intocado.

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
  --    (updated_at removido em 20260807220000 — clients_people_companies não tem essa coluna)
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

  -- 6. Form Pro submissions (lp_submissions foi renomeada para
  -- form_pro_submissions em 20260310000000_form_pro_drop_lp_pages-ok.sql;
  -- coluna people_id preservada)
  UPDATE public.form_pro_submissions
  SET people_id = p_canonical_id
  WHERE people_id = p_duplicate_id;

  -- 7. lp_form_submissions: removido — dropada intencionalmente na mesma
  -- migration 20260310000000 (era tracking de página por session_id/
  -- visitor_id, nunca foi tabela de CRM ligada a pessoa).

  -- 8. sends_contacts: removido em 20260807240000 — tabela dropada
  -- intencionalmente pelo dono do produto ("não tem mais necessidade").
  -- sends_people (candidata inicial neste passo, corrigida por esta
  -- migration) é vestigial (0 rows, nada escreve nela) — reparentar nela
  -- não corrigiria nada de verdade. Sem tabela viva equivalente para
  -- reparentar.

  -- 9. Followup queue (column name: person_id)
  UPDATE public.followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

  -- 10. Meeting followup queue (coluna real é person_id, não people_id)
  UPDATE public.meeting_followup_queue
  SET person_id = p_canonical_id
  WHERE person_id = p_duplicate_id;

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
