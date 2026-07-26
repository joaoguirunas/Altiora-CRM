---
title: "Story sim-4: Deals e vendas (mínimo 20 fechadas + pipeline ativo)"
type: story
status: cancelled
epic: joao-guirunas-sim-dados-apresentacao
complexity: M
agent: dev-architect
created: 2026-05-02
updated: 2026-07-25
tags: [story, simulation, joao-guirunas-demo, seed, crm, sales, cancelled]
related: ["[[../BACKLOG]]", "[[sim-1-dados-config-base]]", "[[sim-2-leads-contacts]]", "[[sim-6-campanhas-investimentos]]"]
---

# Story sim-4: Deals e vendas (mínimo 20 fechadas + pipeline ativo)

## Objetivo
Atualizar subset dos leads gerados em sim-2 para refletir um funil saudável: **mínimo 20 vendas fechadas (`won`)** com valores e datas, **mínimo 15 perdas (`lost`)** com motivo, e o restante distribuído como pipeline ativo (`in_progress`) — alimentando dashboards de BI PRO, gráfico de funil e métricas de conversão.

## Acceptance Criteria
- [ ] AC1: **Mínimo 20 leads** com `status = 'won'`, `won_at` distribuído entre `2026-04-01` e `2026-05-02`, e `value` realista (entre R$ 1.500 e R$ 50.000, mediana ~R$ 8.000).
- [ ] AC2: **Mínimo 15 leads** com `status = 'lost'`, `leads_loss_reasons_id` preenchido (distribuído entre os 5 motivos de sim-1) e `closed_at`/`updated_at` coerente.
- [ ] AC3: **Pipeline ativo**: o restante (~65 leads) permanece `in_progress`, distribuído nas 5 stages com pesos: 25% Novo Lead, 25% Qualificação, 20% Proposta, 15% Negociação, 15% Fechamento (perto de bater).
- [ ] AC4: **Distribuição temporal de fechamentos**: vendas fechadas espalhadas — pelo menos 5 nos últimos 7 dias, 10 entre 8 e 21 dias atrás, 5+ entre 22 e 30 dias atrás. Demonstra "tração crescente".
- [ ] AC5: **Atribuição realista**: vendas fechadas distribuídas entre os 3 usuários demo (Closer fecha 60%, SDR fecha 25%, Gestor fecha 15%) — alimenta ranking de vendedores.
- [ ] AC6: **Coerência com stages**: leads com `status='won'` movidos para a stage de fechamento (última stage do pipeline) ou estado final; leads `lost` permanecem na stage onde "morreram" (mais natural visualmente).
- [ ] AC7: **Receita total simulada** entre R$ 150.000 e R$ 350.000 (20+ vendas × ticket médio realista).
- [ ] AC8: Script idempotente — usar `UPDATE ... WHERE leads.id IN (subset deterministico) AND status = 'in_progress'` para evitar reprocessar.
- [ ] AC9: 100% dos UPDATEs no tenant `wotuyxscsfralqpoiyfv`.

## Escopo

**IN:**
- Arquivo SQL `supabase/seeds/sim-4-deals-vendas.sql` (apenas UPDATE — não cria novos leads, atualiza os de sim-2).
- UPDATE em `leads`: `status`, `value`, `won_at`, `leads_loss_reasons_id`, `leads_stages_id` (mover wons para stage de fechamento).
- Inserção em `leads_updates` (se a tabela existe e o app espera trilha de auditoria) com mudanças de stage e status — opcional mas recomendado para realismo.

**OUT:**
- Criação de novos leads — sim-2 já fez.
- Notas e arquivos por negócio (`leads_notes`, `leads_files`) — fora do MVP, opcional incluir 2-3 notas em vendas fechadas para realismo.
- Tarefas/follow-ups por lead — fora do escopo.
- Comissões / metas SDR (`bi_sdr_targets`) — opcional para sim-6.
- Histórico de score (`clients_people_updates`) — fora do escopo.

## Contexto Técnico

**Tabela principal:** `leads`
| Coluna | Update |
|---|---|
| status | `'won'` ou `'lost'` |
| value | numeric, R$ realista |
| won_at | timestamptz, só para wons |
| leads_loss_reasons_id | uuid, só para losts |
| leads_stages_id | mover wons para stage 5 ("Fechamento") |
| updated_at | now() ou timestamp coerente |

**Distribuição alvo (com base em 100 leads de sim-2):**
| Status | Qtd | % |
|---|---|---|
| won | 22 | 22% |
| lost | 18 | 18% |
| in_progress | 60 | 60% |

**Estratégia de implementação:**
```sql
-- 1. Selecionar 22 leads aleatórios (deterministicamente via ORDER BY id) e marcar como won
WITH wons AS (
  SELECT id, created_at, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM leads
  WHERE tenant_id = 'wotuyxscsfralqpoiyfv'
    AND status = 'in_progress'
  LIMIT 22
)
UPDATE leads l
SET
  status = 'won',
  won_at = wons.created_at + (random() * INTERVAL '20 days') + INTERVAL '3 days',
  value  = round((1500 + random() * 48500)::numeric, 2),
  leads_stages_id = (SELECT id FROM leads_stages WHERE order_index = 5 AND tenant_id = 'wotuyxscsfralqpoiyfv' LIMIT 1)
FROM wons
WHERE l.id = wons.id;

-- 2. Análogo para 18 losts com motivo aleatório
-- 3. Restante permanece in_progress (já está)
```

**Dependências:**
- **Bloqueada por** sim-1 (loss_reasons), sim-2 (leads).

**Bloqueia:**
- sim-6 indiretamente — campanhas de marketing usarão UTMs dos wons para calcular ROAS.

**Coerência com BI PRO:**
A função `get_insights_context()` agrega `funnel`, `leads_by_day`, `sales_by_day` lendo `leads`. Garantir que `won_at` esteja preenchido corretamente — é a coluna que o BI usa para atribuir vendas no dia.

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
