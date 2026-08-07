-- Fix get_insights_context: 4 gaps de schema drift acumulados na mesma function
-- (auditoria completa dos 8 blocos contra information_schema.columns em
-- 2026-08-07 confirmou apenas estes 4; BLOCK 7/prospect já é guardado por
-- pg_class e continua correto sem alteração).
--
-- Gap 1 (BLOCK 2 — PEOPLE): a migration 20251026025557_...-ok.sql removeu
-- clients_people.score (junto com moment/goal/income/disc_profile) e substituiu
-- por clients_people.score_matrix_id -> score_matrix.id. O valor numérico do
-- score agora vive em score_matrix.score_number (conforme comentário de
-- 20260726290000_fix_auto_link_score_matrix_trigger.sql). get_insights_context
-- nunca foi atualizada e ainda faz `WHERE score BETWEEN ...` direto em
-- clients_people, quebrando a function com "column \"score\" does not exist"
-- antes mesmo de chegar no BLOCK 5.
-- Fix: LEFT JOIN score_matrix sm ON sm.id = clients_people.score_matrix_id,
-- e troca as referências de score por sm.score_number. top_sources e
-- company_stats não usam score, então ficam intocados.
--
-- Gap 2 (BLOCK 5 — CALLS): migration 20260609000000_drop_coach_pro_and_call_pro.sql
-- dropou call_pro_calls (Call Pro™ foi descontinuado), mas a última atualização de
-- get_insights_context (20260511110000, anterior ao drop) nunca foi ajustada.
-- BLOCK 5 ainda faz `FROM call_pro_calls`, então toda chamada à function — usada
-- pelo BI Insights Chat via voice/biTools.ts — falha com
-- "relation \"public.call_pro_calls\" does not exist".
-- Fix: Call Pro não volta (decisão irreversível do squad-a-removal-plan), então
-- BLOCK 5 passa a devolver um payload zerado em vez de reconsultar a tabela, em
-- vez de um guard condicional (padrão do BLOCK 7/Prospect, que é opcional por
-- tenant — este caso é diferente: o módulo foi removido do produto).
--
-- Gap 3 (BLOCK 3 — MESSAGES): a function usa `messages.lead_id`, mas a coluna
-- real é `messages.leads_id` (mesmo padrão de FK-naming não migrado já
-- documentado para `meetings`). Fix: `leads_id AS lead_id` no SELECT do
-- msg_base — mínima mudança, resto do bloco (abandoned/daily_trend) intocado.
--
-- Gap 4 (BLOCK 4 — MEETINGS): mesma causa do Gap 3 — `meetings.user_id` e
-- `meetings.lead_id` não existem; as colunas reais são `users_id`/`leads_id`.
-- Fix: aliases no SELECT do mtg_base (`users_id AS user_id`, `leads_id AS
-- lead_id`) + correção direta nos dois JOINs que referenciam a tabela
-- `meetings` fora da CTE (mtg_base.LEFT JOIN leads, meetings_by_campaign.LEFT
-- JOIN meetings m2), que não se beneficiam do alias por não passarem pela CTE.
--
-- Gaps descartados após auditoria: BLOCK 6 (MARKETING) referencia
-- `sends.channel`, `sends.delivered_count`, `sends.read_count` — nenhuma
-- existe mais. O tracking granular hoje vive em `sends_people`
-- (send_id/status/sent_at/delivered_at/read_at), sem coluna de canal
-- equivalente clara (`sends.type` existe mas a tabela está vazia em produção
-- e sem comentário, não dá para confirmar semântica). Isso não é rename
-- simples — requer decisão de produto, então BLOCK 6 NÃO foi alterado nesta
-- migration (fora do escopo autorizado).

CREATE OR REPLACE FUNCTION public.get_insights_context(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result      jsonb := '{}'::jsonb;
  v_funnel    jsonb;
  v_people    jsonb;
  v_messages  jsonb;
  v_meetings  jsonb;
  v_calls     jsonb;
  v_marketing jsonb;
  v_prospect  jsonb;
  v_pipelines jsonb;
  v_has_prospect boolean;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 0: AVAILABLE PIPELINES (for LLM context)
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]'::jsonb)
  INTO v_pipelines
  FROM leads_pipelines
  WHERE active = true;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 1: FUNNEL
  -- ═══════════════════════════════════════════════════════════════════════
  WITH lead_base AS (
    SELECT l.id, l.status, l.value, l.leads_stages_id, l.leads_pipelines_id,
           l.leads_loss_reasons_id, l.created_at, l.won_at
    FROM leads l
    WHERE (p_date_from  IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to    IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
  ),
  stages_agg AS (
    SELECT
      ls.name AS stage_name,
      ls.order_index,
      COUNT(lb.id) AS lead_count,
      COALESCE(SUM(lb.value), 0) AS total_value,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - lb.created_at)) / 86400)::numeric, 1) AS avg_days
    FROM lead_base lb
    JOIN leads_stages ls ON ls.id = lb.leads_stages_id
    WHERE lb.status = 'in_progress'
    GROUP BY ls.name, ls.order_index
    ORDER BY ls.order_index
  ),
  loss_reasons AS (
    SELECT
      COALESCE(lr.name, 'Sem motivo') AS reason,
      COUNT(*) AS cnt
    FROM lead_base lb
    LEFT JOIN leads_loss_reasons lr ON lr.id = lb.leads_loss_reasons_id
    WHERE lb.status = 'lost'
    GROUP BY lr.name
    ORDER BY cnt DESC
    LIMIT 5
  ),
  funnel_totals AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'won')         AS won,
      COUNT(*) FILTER (WHERE status = 'lost')        AS lost,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS active,
      COALESCE(SUM(value) FILTER (WHERE status = 'won'), 0) AS revenue,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - created_at)) / 86400)
             FILTER (WHERE status = 'won' AND won_at IS NOT NULL))::numeric, 1) AS avg_cycle_days
    FROM lead_base
  )
  SELECT jsonb_build_object(
    'total',           ft.total,
    'won',             ft.won,
    'lost',            ft.lost,
    'active',          ft.active,
    'revenue',         ft.revenue,
    'avg_deal',        CASE WHEN ft.won > 0 THEN ROUND((ft.revenue / ft.won)::numeric, 2) ELSE 0 END,
    'conversion_pct',  CASE WHEN ft.total > 0 THEN ROUND((ft.won::numeric / ft.total * 100), 1) ELSE 0 END,
    'avg_cycle_days',  COALESCE(ft.avg_cycle_days, 0),
    'stages',          COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'name', s.stage_name, 'leads', s.lead_count,
                         'value', s.total_value, 'avg_days', s.avg_days
                       ) ORDER BY s.order_index) FROM stages_agg s), '[]'::jsonb),
    'loss_reasons',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                         'reason', r.reason, 'count', r.cnt
                       )) FROM loss_reasons r), '[]'::jsonb)
  ) INTO v_funnel
  FROM funnel_totals ft;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 2: PEOPLE & COMPANIES — score agora vive em score_matrix.score_number
  -- (clients_people.score foi removida por 20251026025557; substituída por
  -- clients_people.score_matrix_id -> score_matrix.id).
  -- ═══════════════════════════════════════════════════════════════════════
  WITH people_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE cp.status = 'ativo')  AS active,
      COUNT(*) FILTER (WHERE cp.status != 'ativo') AS inactive,
      COUNT(*) FILTER (WHERE sm.score_number BETWEEN 0  AND 25)  AS score_0_25,
      COUNT(*) FILTER (WHERE sm.score_number BETWEEN 26 AND 50)  AS score_26_50,
      COUNT(*) FILTER (WHERE sm.score_number BETWEEN 51 AND 75)  AS score_51_75,
      COUNT(*) FILTER (WHERE sm.score_number BETWEEN 76 AND 100) AS score_76_100
    FROM clients_people cp
    LEFT JOIN score_matrix sm ON sm.id = cp.score_matrix_id
    WHERE (p_date_from IS NULL OR cp.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR cp.created_at <= p_date_to)
  ),
  top_sources AS (
    SELECT source, COUNT(*) AS cnt
    FROM clients_people
    WHERE source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
    GROUP BY source
    ORDER BY cnt DESC
    LIMIT 5
  ),
  company_stats AS (
    SELECT COUNT(*) AS total, COUNT(*) AS active FROM clients_companies
  )
  SELECT jsonb_build_object(
    'people_total',    ps.total,
    'people_active',   ps.active,
    'people_inactive', ps.inactive,
    'score_distribution', jsonb_build_object(
      '0_25', ps.score_0_25, '26_50', ps.score_26_50,
      '51_75', ps.score_51_75, '76_100', ps.score_76_100
    ),
    'top_sources',      COALESCE((SELECT jsonb_agg(jsonb_build_object('source', ts.source, 'count', ts.cnt)) FROM top_sources ts), '[]'::jsonb),
    'companies_total',  cs.total,
    'companies_active', cs.active
  ) INTO v_people
  FROM people_stats ps, company_stats cs;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 3: MESSAGES — messages usa leads_id (não lead_id); alias mantém o
  -- restante do bloco (abandoned/daily_trend) sem alterações.
  -- ═══════════════════════════════════════════════════════════════════════
  WITH msg_base AS (
    SELECT id, channel, from_contact, created_at, leads_id AS lead_id
    FROM messages
    WHERE (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  by_channel AS (
    SELECT channel, COUNT(*) AS cnt FROM msg_base GROUP BY channel ORDER BY cnt DESC
  ),
  by_sender AS (
    SELECT from_contact, COUNT(*) AS cnt FROM msg_base GROUP BY from_contact
  ),
  daily_trend AS (
    SELECT created_at::date AS day, COUNT(*) AS cnt
    FROM msg_base
    WHERE created_at >= (COALESCE(p_date_to, now()) - interval '7 days')
    GROUP BY day ORDER BY day
  ),
  abandoned AS (
    SELECT COUNT(DISTINCT lead_id) AS cnt
    FROM (
      SELECT lead_id, from_contact, created_at,
             LEAD(from_contact) OVER (PARTITION BY lead_id ORDER BY created_at) AS next_sender,
             LEAD(created_at)   OVER (PARTITION BY lead_id ORDER BY created_at) AS next_at
      FROM msg_base
    ) sub
    WHERE from_contact = 'cliente'
      AND (next_sender IS NULL OR (next_sender != 'cliente' AND next_at - created_at > interval '24 hours'))
  )
  SELECT jsonb_build_object(
    'total',                   (SELECT COUNT(*) FROM msg_base),
    'by_channel',              COALESCE((SELECT jsonb_agg(jsonb_build_object('channel', c.channel, 'count', c.cnt)) FROM by_channel c), '[]'::jsonb),
    'by_sender',               COALESCE((SELECT jsonb_agg(jsonb_build_object('sender', s.from_contact, 'count', s.cnt)) FROM by_sender s), '[]'::jsonb),
    'daily_trend',             COALESCE((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt)) FROM daily_trend d), '[]'::jsonb),
    'abandoned_conversations', ab.cnt
  ) INTO v_messages
  FROM abandoned ab;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 4: MEETINGS — meetings usa leads_id/users_id (não lead_id/user_id);
  -- alias mantém o restante do bloco sem alterações.
  -- ═══════════════════════════════════════════════════════════════════════
  WITH mtg_base AS (
    SELECT m.id, m.status, m.start_time, m.users_id AS user_id, m.leads_id AS lead_id,
           l.created_at AS lead_created, l.won_at,
           l.utm_campaign, l.utm_source
    FROM meetings m
    LEFT JOIN leads l ON l.id = m.leads_id
    WHERE (p_date_from IS NULL OR m.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR m.created_at <= p_date_to)
      AND (m.source IS NULL OR m.source != 'google')
  ),
  by_status AS (
    SELECT status, COUNT(*) AS cnt FROM mtg_base GROUP BY status
  ),
  show_rate_by_user AS (
    SELECT
      COALESCE(su.name, 'Sem responsável') AS closer_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE mb.status IN ('compareceu', 'realizado')) AS attended,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE mb.status IN ('compareceu', 'realizado')))::numeric / COUNT(*) * 100, 1)
        ELSE 0 END AS show_rate
    FROM mtg_base mb
    LEFT JOIN settings_users su ON su.id = mb.user_id
    GROUP BY su.name
    ORDER BY total DESC
    LIMIT 5
  ),
  time_metrics AS (
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (start_time - lead_created)) / 86400)::numeric, 1) AS avg_lead_to_meeting,
      ROUND((AVG(EXTRACT(EPOCH FROM (won_at - start_time)) / 86400) FILTER (WHERE won_at IS NOT NULL))::numeric, 1) AS avg_meeting_to_close
    FROM mtg_base
    WHERE lead_created IS NOT NULL
  ),
  meetings_by_campaign AS (
    SELECT
      COALESCE(l.utm_campaign, l.utm_source, 'Sem campanha') AS campaign,
      COUNT(DISTINCT l.id) AS leads,
      COUNT(DISTINCT m2.id) AS meetings,
      COUNT(DISTINCT m2.id) FILTER (WHERE m2.status IN ('compareceu', 'realizado')) AS attended,
      COUNT(DISTINCT m2.id) FILTER (WHERE m2.status IN ('nao_compareceu', 'não compareceu', 'cancelado', 'cancelada')) AS no_show,
      COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') AS won
    FROM leads l
    LEFT JOIN meetings m2 ON m2.leads_id = l.id AND (m2.source IS NULL OR m2.source != 'google')
    WHERE (l.utm_source IS NOT NULL OR l.utm_campaign IS NOT NULL)
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR l.leads_pipelines_id = p_pipeline_id)
    GROUP BY COALESCE(l.utm_campaign, l.utm_source, 'Sem campanha')
    ORDER BY leads DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total',                    (SELECT COUNT(*) FROM mtg_base),
    'by_status',                COALESCE((SELECT jsonb_agg(jsonb_build_object('status', bs.status, 'count', bs.cnt)) FROM by_status bs), '[]'::jsonb),
    'show_rate_by_closer',      COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                  'name', sr.closer_name, 'total', sr.total,
                                  'attended', sr.attended, 'show_rate', sr.show_rate
                                )) FROM show_rate_by_user sr), '[]'::jsonb),
    'avg_lead_to_meeting_days', COALESCE(tm.avg_lead_to_meeting, 0),
    'avg_meeting_to_close_days',COALESCE(tm.avg_meeting_to_close, 0),
    'by_campaign',              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                  'campaign', mc.campaign, 'leads', mc.leads, 'meetings', mc.meetings,
                                  'attended', mc.attended, 'no_show', mc.no_show, 'won', mc.won
                                )) FROM meetings_by_campaign mc), '[]'::jsonb)
  ) INTO v_meetings
  FROM time_metrics tm;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 5: CALLS — Call Pro™ foi removido do produto (20260609000000).
  -- Sem tabela de origem: devolve payload zerado em vez de reconsultar.
  -- ═══════════════════════════════════════════════════════════════════════
  v_calls := jsonb_build_object(
    'total', 0, 'inbound', 0, 'outbound', 0, 'answered', 0,
    'answer_rate', 0, 'avg_duration_sec', 0,
    'top_operators', '[]'::jsonb, 'top_outcomes', '[]'::jsonb,
    'installed', false
  );

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 6: MARKETING — sends.delivered_count/read_count/channel não existem
  -- mais (tracking granular hoje vive em sends_people: send_id/status/sent_at/
  -- delivered_at/read_at, sem coluna de canal equivalente confirmada).
  -- total_sends/total_contacts/total_sent continuam reais (sent_count e
  -- total_contacts existem em sends); apenas entrega/leitura/by_channel são
  -- zerados e marcados com 'data_unavailable', true dentro de 'sends' para o
  -- consumidor da RPC (BI Insights Chat) não confundir com "zero campanhas
  -- rodaram". Reconstrução correta via sends_people fica para story separada,
  -- pois depende de confirmar com o dono do produto se sends.type equivale a
  -- channel — não assumido aqui. landing_pages/utm_attribution/meta_forms não
  -- dependem dessas colunas e permanecem intocados.
  -- ═══════════════════════════════════════════════════════════════════════
  WITH sends_summary AS (
    SELECT
      COUNT(*) AS total_sends,
      SUM(total_contacts)  AS total_contacts,
      SUM(sent_count)      AS total_sent
    FROM sends
    WHERE status IN ('completed', 'running')
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
  ),
  lp_stats AS (
    SELECT f.name AS page_name, COUNT(s.id) AS submissions
    FROM form_pro_forms f
    LEFT JOIN form_pro_submissions s ON s.form_id = f.id
      AND (p_date_from IS NULL OR s.submitted_at >= p_date_from)
      AND (p_date_to   IS NULL OR s.submitted_at <= p_date_to)
    GROUP BY f.name
    ORDER BY submissions DESC
    LIMIT 5
  ),
  utm_stats AS (
    SELECT
      COALESCE(utm_source, 'direto') AS source,
      COALESCE(utm_medium, 'none')   AS medium,
      COUNT(*) AS leads,
      COUNT(*) FILTER (WHERE status = 'won') AS won
    FROM leads
    WHERE utm_source IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_pipeline_id IS NULL OR leads_pipelines_id = p_pipeline_id)
    GROUP BY utm_source, utm_medium
    ORDER BY leads DESC
    LIMIT 5
  ),
  meta_forms_stats AS (
    SELECT mf.name AS form_name, COUNT(DISTINCT l.id) AS leads_count
    FROM meta_lead_forms mf
    LEFT JOIN form_pro_submissions fps ON fps.meta_form_id = mf.id
      AND (p_date_from IS NULL OR fps.submitted_at >= p_date_from)
      AND (p_date_to   IS NULL OR fps.submitted_at <= p_date_to)
    LEFT JOIN leads l ON l.id = fps.lead_id
    WHERE mf.status = 'active'
    GROUP BY mf.name
    ORDER BY leads_count DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'sends', jsonb_build_object(
      'total_campaigns',  ss.total_sends,
      'total_sent',       COALESCE(ss.total_sent, 0),
      'total_delivered',  0,
      'total_read',       0,
      'delivery_rate',    0,
      'read_rate',        0,
      'by_channel',       '[]'::jsonb,
      'data_unavailable', true
    ),
    'landing_pages',    COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'form', lps.page_name, 'submissions', lps.submissions
                        )) FROM lp_stats lps WHERE lps.submissions > 0), '[]'::jsonb),
    'utm_attribution',  COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'source', u.source, 'medium', u.medium, 'leads', u.leads, 'won', u.won
                        )) FROM utm_stats u), '[]'::jsonb),
    'meta_forms',       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                          'form', mfs.form_name, 'leads', mfs.leads_count
                        )) FROM meta_forms_stats mfs), '[]'::jsonb)
  ) INTO v_marketing
  FROM sends_summary ss;

  -- ═══════════════════════════════════════════════════════════════════════
  -- BLOCK 7: PROSPECT PRO (guarded — table may not exist)
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'prospect_campaigns' AND n.nspname = 'public'
  ) INTO v_has_prospect;

  IF v_has_prospect THEN
    EXECUTE $prospect$
      WITH prospect_campaigns_agg AS (
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'running')   AS running,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed
        FROM prospect_campaigns
        WHERE ($1 IS NULL OR created_at >= $1)
          AND ($2 IS NULL OR created_at <= $2)
      ),
      prospect_contacts_agg AS (
        SELECT 0 AS total, 0 AS raw_cnt, 0 AS filtered_cnt,
               0 AS enriched_cnt, 0 AS approved_cnt, 0 AS rejected_cnt,
               0 AS avg_ai_score
      )
      SELECT jsonb_build_object(
        'campaigns_total',     pca.total,
        'campaigns_running',   pca.running,
        'campaigns_completed', pca.completed,
        'contacts_total',      pcta.total,
        'contacts_by_status',  jsonb_build_object(
          'raw', pcta.raw_cnt, 'filtered', pcta.filtered_cnt,
          'enriched', pcta.enriched_cnt, 'approved', pcta.approved_cnt, 'rejected', pcta.rejected_cnt
        ),
        'avg_ai_score',  COALESCE(pcta.avg_ai_score, 0),
        'approval_rate', 0
      ) FROM prospect_campaigns_agg pca, prospect_contacts_agg pcta
    $prospect$ INTO v_prospect USING p_date_from, p_date_to;
  ELSE
    v_prospect := jsonb_build_object(
      'campaigns_total', 0, 'campaigns_running', 0, 'campaigns_completed', 0,
      'contacts_total', 0, 'avg_ai_score', 0, 'approval_rate', 0,
      'installed', false
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ASSEMBLE
  -- ═══════════════════════════════════════════════════════════════════════
  result := jsonb_build_object(
    'pipelines', COALESCE(v_pipelines, '[]'::jsonb),
    'funnel',    COALESCE(v_funnel,    '{}'::jsonb),
    'people',    COALESCE(v_people,    '{}'::jsonb),
    'messages',  COALESCE(v_messages,  '{}'::jsonb),
    'meetings',  COALESCE(v_meetings,  '{}'::jsonb),
    'calls',     COALESCE(v_calls,     '{}'::jsonb),
    'marketing', COALESCE(v_marketing, '{}'::jsonb),
    'prospect',  COALESCE(v_prospect,  '{}'::jsonb)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_insights_context(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_insights_context(timestamptz, timestamptz, uuid) TO service_role;
