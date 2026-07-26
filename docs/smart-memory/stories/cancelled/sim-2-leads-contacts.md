---
title: "Story sim-2: Leads e contatos (~100 leads, ~30 clientes)"
type: story
status: cancelled
epic: joao-guirunas-sim-dados-apresentacao
complexity: L
agent: dev-architect
created: 2026-05-02
updated: 2026-07-25
tags: [story, simulation, joao-guirunas-demo, seed, crm, cancelled]
related: ["[[../BACKLOG]]", "[[sim-1-dados-config-base]]", "[[sim-3-conversas]]", "[[sim-4-deals-vendas]]"]
---

# Story sim-2: Leads e contatos (~100 leads, ~30 clientes)

## Objetivo
Popular `clients_people`, `clients_companies` e `leads` com volume realista de pessoas, empresas e oportunidades distribuídas nos últimos 30+ dias, prontas para serem usadas pelas demais stories (conversas, vendas, reuniões).

## Acceptance Criteria
- [ ] AC1: **Mínimo 100 pessoas** em `clients_people` com nome PT-BR realista, email, whatsapp BR (+55 11 9...), score variado (10–100), source distribuído entre `whatsapp`, `instagram`, `lp`, `meta_ads`, `google_ads`, `prospect`, `manual`.
- [ ] AC2: **Mínimo 30 empresas** em `clients_companies` com razão social, segmento variado, tamanho (small/medium/enterprise) e ao menos 60 das 100 pessoas vinculadas a alguma empresa.
- [ ] AC3: **Mínimo 100 leads** em `leads` (1 lead por pessoa em média, algumas pessoas sem lead, algumas com 2+ leads) distribuídos em todas as 5 stages do pipeline criado em sim-1.
- [ ] AC4: **Distribuição temporal**: `created_at` dos leads/pessoas espalhado entre `2026-04-01` e `2026-05-02` (mínimo 30 dias de histórico), com pico realista nos últimos 7 dias (~30% do volume) e cauda decrescente.
- [ ] AC5: **UTMs preenchidas em ao menos 60% dos leads** com combinações realistas (`utm_source=meta_ads&utm_campaign=lancamento_q2_2026&utm_medium=cpc`, `google_ads/search/branded`, `instagram/organic/bio_link`, etc.).
- [ ] AC6: Atribuição de `user_id` (responsável) distribuída entre os 3 usuários demo de sim-1 (gestor 10%, SDR 60%, Closer 30%).
- [ ] AC7: Script idempotente — usar emails únicos previsíveis (ex.: `lead_demo_001@example.com` ... `lead_demo_100@example.com`) com `ON CONFLICT (email, tenant_id) DO NOTHING`.
- [ ] AC8: 100% dos registros com `tenant_id = 'wotuyxscsfralqpoiyfv'`.

## Escopo

**IN:**
- Arquivo SQL `supabase/seeds/sim-2-leads-contacts.sql` (apenas INSERT — sem ALTER).
- Lista hardcoded ou gerada via `generate_series` + arrays de nomes/segmentos/sources.
- Distribuição de stages: 30% Novo Lead, 25% Qualificação, 20% Proposta, 15% Negociação, 10% Fechamento (Fechamento alimenta sim-4 que vai marcar como `won`).
- Status inicial: todos `in_progress` (sim-4 muda subset para `won`/`lost`).
- Pessoas com whatsapp único e válido — formato `+5511XXXXXXXXX`.

**OUT:**
- Atualização de leads para status=won/lost — fica em sim-4.
- Mensagens vinculadas a leads — fica em sim-3.
- Reuniões agendadas — fica em sim-5.
- Campos personalizados (`crm_field_values`) — fora do MVP.
- Tags em `clients_people` — fora do MVP, opcional.

## Contexto Técnico

**Tabelas afetadas:**
- `clients_people` (id, name, email, whatsapp, score, source, status, tenant_id, created_at)
- `clients_companies` (id, name, segment, size, tenant_id, created_at)
- `leads` (id, status, value, leads_stages_id, leads_pipelines_id, person_id, user_id, utm_*, won_at, created_at, tenant_id)

**Geração de dados (estratégia recomendada):**
Usar `generate_series(1, 100)` com `random()` para distribuição:
```sql
WITH nomes AS (SELECT unnest(ARRAY['Ana','Bruno','Carla','Daniel','Eduarda','Fábio','Gabi','Hugo','Isabela','João','Karen','Lucas','Mariana','Nicolas','Olívia','Paulo','Queila','Rafael','Sofia','Thiago']) AS first),
     sobrenomes AS (SELECT unnest(ARRAY['Silva','Santos','Oliveira','Souza','Lima','Costa','Pereira','Almeida','Ferreira','Rodrigues']) AS last),
     segmentos AS (SELECT unnest(ARRAY['SaaS','E-commerce','Educação','Saúde','Indústria','Varejo','Serviços B2B','Imobiliário','Financeiro','Marketing']) AS seg)
INSERT INTO clients_people (...)
SELECT
  first || ' ' || last,
  'lead_demo_' || lpad(n::text, 3, '0') || '@example.com',
  '+5511' || (90000000 + n)::text,
  ...
FROM generate_series(1, 100) n
CROSS JOIN LATERAL (SELECT first FROM nomes ORDER BY random() LIMIT 1) f
CROSS JOIN LATERAL (SELECT last FROM sobrenomes ORDER BY random() LIMIT 1) s;
```

**Dependências:**
- **Bloqueada por** sim-1 (precisa de pipeline_id, stage_ids, user_ids).

**Bloqueia:**
- sim-3 (mensagens precisam de `lead_id`/`person_id`)
- sim-4 (vendas atualizam `leads` existentes)
- sim-5 (reuniões precisam de `lead_id`)

**Atenção:**
- `leads.status` é text com valores `in_progress` / `won` / `lost`.
- `leads.value` em centavos ou reais? Verificar no schema; padrão é `numeric` com valor em reais (ex.: 5000.00 = R$ 5.000).
- `leads.won_at` deve ser NULL nesta story; sim-4 preenche.

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

## Cancelamento

**Data:** 2026-07-25
**Motivo:** Tenant de demonstração `wotuyxscsfralqpoiyfv` está desconectado do projeto. Dados de demo não serão inseridos no tenant de produção ativo (`dtsmbqrzyxhjjjvpjfjd`) para evitar contaminação de dados reais.
**Decisão:** usuário (confirmado em 2026-07-25)
