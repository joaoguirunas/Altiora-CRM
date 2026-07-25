---
title: "Story sim-6: Campanhas de marketing + investimentos + métricas"
type: story
status: backlog
epic: joao-guirunas-sim-dados-apresentacao
complexity: L
agent: dev-architect
created: 2026-05-02
updated: 2026-05-10
tags: [story, simulation, joao-guirunas-demo, seed, bi, marketing, ads]
related: ["[[../BACKLOG]]", "[[sim-2-leads-contacts]]", "[[sim-4-deals-vendas]]"]
---

# Story sim-6: Campanhas de marketing + investimentos + métricas

## Objetivo
Popular `bi_ad_accounts`, `bi_ad_campaigns`, `bi_ad_spend` (e `bi_tiktok_ad_spend` opcional) com **contas Meta e Google Ads simuladas**, campanhas ativas e gasto diário dos últimos 30 dias — alimentando dashboards BI PRO de attribution, ROAS, CPL e funil pago em uma apresentação comercial.

## Acceptance Criteria
- [ ] AC1: **2 contas de ads** em `bi_ad_accounts`: 1 Meta (`platform='meta'`) e 1 Google Ads (`platform='google'`), ambas com `tenant_id` João Guirunas.
- [ ] AC2: **Mínimo 6 campanhas** em `bi_ad_campaigns` (3 Meta + 3 Google) com nomes que casam com UTMs gerados em sim-2 (`lancamento_q2_2026`, `branded_search`, `retargeting_visitantes`, `prospecting_lookalike`, `instagram_stories`, `youtube_demo`).
- [ ] AC3: **Investimento diário** em `bi_ad_spend` para cada campanha, **mínimo 30 dias** de dados (de `2026-04-02` a `2026-05-02`), com `spend_cents` (ou `spend`) variando entre R$ 50 e R$ 800/dia por campanha.
- [ ] AC4: **Métricas atribuídas**: `impressions`, `clicks`, `conversions` (se a coluna existir) coerentes — CTR ~2%, CPL realista (R$ 25–R$ 120). Total gasto no mês: aprox **R$ 30.000–R$ 50.000**.
- [ ] AC5: **Coerência com sim-2/sim-4**: as UTMs dos leads em `leads` (`utm_campaign`) batem com `bi_ad_campaigns.name` ou `external_id`, permitindo o BI calcular custo-por-lead e ROAS via join.
- [ ] AC6: **ROAS realista**: receita atribuída (sum `leads.value` WHERE `status='won'` e `utm_source` em paid) / total gasto ≥ 3.0 e ≤ 8.0 (não absurdo).
- [ ] AC7: **Distribuição realista**: gasto sobe progressivamente nos últimos 7 dias (~+30%) simulando "scale up" — alimenta narrativa de apresentação.
- [ ] AC8: Opcional: **3 entries em `bi_tiktok_ad_spend`** para demonstrar TikTok integration (1 campanha × 3 dias seria suficiente).
- [ ] AC9: **`bi_settings`** verificado/configurado se vazio — não obrigatoriamente popular tokens reais (deixar nulo); só garantir que a row do tenant existe.
- [ ] AC10: Script idempotente; 100% no tenant `wotuyxscsfralqpoiyfv`.

## Escopo

**IN:**
- Arquivo SQL `supabase/seeds/sim-6-campanhas-investimentos.sql`.
- INSERT em `bi_ad_accounts` (1 Meta + 1 Google).
- INSERT em `bi_ad_campaigns` (6+).
- INSERT em `bi_ad_spend` (180+ linhas: 6 campanhas × 30 dias).
- Opcional INSERT em `bi_tiktok_ad_spend`.
- Opcional INSERT em `meta_lead_forms`/`meta_lead_form_pages` se for demonstrar lead ads no FORM PRO (1 form é suficiente).

**OUT:**
- Inserção em `bi_sdr_targets` — pode ir junto se trivial, mas separar se gerar complexidade (deixar opcional — registar 1 target/SDR/mês cobre).
- Conexão OAuth real (`meta_save_credentials`, `bi-google-oauth`) — não funcional sem credenciais.
- Conversion tracking (`conversion_platform_credentials`, `conversion_events_queue`) — fora do escopo.
- Atribuição multi-touch — usar last-click via UTM simples.
- Insights dashboard (BI PRO) — leitura, não escrita; stories anteriores garantem que dashboards se preencham via `get_insights_context()`.

## Contexto Técnico

**Tabelas afetadas:**

`bi_ad_accounts`
| Coluna | Notas |
|---|---|
| id | uuid |
| platform | 'meta' ou 'google' |
| account_external_id | string fake ('act_123456789' Meta, '111-222-3333' Google) |
| name | "João Guirunas Demo — Meta Ads" |
| tenant_id | `wotuyxscsfralqpoiyfv` |
| is_active | true |

`bi_ad_campaigns`
| Coluna | Notas |
|---|---|
| id | uuid |
| ad_account_id | FK → bi_ad_accounts |
| external_id | id da campanha na plataforma (fake) |
| name | bate com UTM |
| status | 'active' |
| tenant_id | mandatório |

`bi_ad_spend`
| Coluna | Notas |
|---|---|
| campaign_id | FK |
| date | DATE — 1 row por dia × campanha |
| spend ou spend_cents | numeric (verificar nome no schema) |
| impressions / clicks / conversions | bigint — derivar de spend |
| tenant_id | mandatório |

**Cálculos sugeridos:**
- CPM ~R$ 30 → impressions = (spend / 30) * 1000
- CTR ~2% → clicks = impressions * 0.02
- CPL ~R$ 60 → conversions = spend / 60

**Estratégia de implementação:**
```sql
DO $$
DECLARE
  v_tenant uuid := 'wotuyxscsfralqpoiyfv';
  v_meta_acc uuid;
  v_google_acc uuid;
  v_camp record;
  v_dia date;
BEGIN
  -- 1. Contas
  INSERT INTO bi_ad_accounts (...) VALUES ('meta', 'act_demo_001', 'João Guirunas Demo — Meta', v_tenant, true)
  RETURNING id INTO v_meta_acc;
  INSERT INTO bi_ad_accounts (...) VALUES ('google', 'demo-google-001', 'João Guirunas Demo — Google', v_tenant, true)
  RETURNING id INTO v_google_acc;

  -- 2. Campanhas
  INSERT INTO bi_ad_campaigns (ad_account_id, name, external_id, status, tenant_id)
  VALUES
    (v_meta_acc,   'lancamento_q2_2026',     'fb_camp_001', 'active', v_tenant),
    (v_meta_acc,   'retargeting_visitantes', 'fb_camp_002', 'active', v_tenant),
    (v_meta_acc,   'instagram_stories',      'fb_camp_003', 'active', v_tenant),
    (v_google_acc, 'branded_search',         'g_camp_001',  'active', v_tenant),
    (v_google_acc, 'prospecting_lookalike',  'g_camp_002',  'active', v_tenant),
    (v_google_acc, 'youtube_demo',           'g_camp_003',  'active', v_tenant);

  -- 3. Gasto diário (30 dias × 6 camps)
  FOR v_camp IN SELECT id, name FROM bi_ad_campaigns WHERE tenant_id = v_tenant LOOP
    FOR i IN 0..29 LOOP
      v_dia := CURRENT_DATE - i;
      INSERT INTO bi_ad_spend (campaign_id, date, spend, impressions, clicks, conversions, tenant_id)
      VALUES (
        v_camp.id, v_dia,
        (50 + random() * 750)::numeric * (1 + (29 - i) * 0.01),  -- scale up no fim
        ((50 + random() * 750) / 30 * 1000)::bigint,
        ((50 + random() * 750) / 30 * 1000 * 0.02)::bigint,
        ((50 + random() * 750) / 60)::bigint,
        v_tenant
      );
    END LOOP;
  END LOOP;
END $$;
```

**Dependências:**
- **Bloqueada por** sim-1 (tenant config); idealmente após sim-2 e sim-4 para que UTMs e wons já existam — facilita validar coerência de ROAS via SELECT.
- Não precisa estritamente esperar sim-3, sim-5 (BI marketing é independente de conversas/reuniões).

**Atenção:**
- Verificar nomes exatos de colunas em `bi_ad_spend` (pode ser `spend` ou `spend_cents` — confirmar no schema antes da implementação).
- `get_insights_context()` agrega `marketing` block — confirmar se ele filtra por `bi_ad_spend.date BETWEEN p_date_from AND p_date_to`.
- Se o BI PRO espera `bi_ad_accounts` com `external_id` no FE para mostrar dropdown, garantir que `account_external_id` está coerente.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
