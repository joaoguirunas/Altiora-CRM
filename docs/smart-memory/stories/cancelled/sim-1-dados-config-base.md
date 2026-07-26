---
title: "Story sim-1: Dados de configuração base (pipelines, stages, tags, usuários demo)"
type: story
status: cancelled
epic: joao-guirunas-sim-dados-apresentacao
complexity: M
agent: dev-architect
created: 2026-05-02
updated: 2026-07-25
tags: [story, simulation, joao-guirunas-demo, seed, cancelled]
related: ["[[../BACKLOG]]", "[[sim-2-leads-contacts]]", "[[sim-3-conversas]]", "[[sim-4-deals-vendas]]", "[[sim-5-reunioes]]", "[[sim-6-campanhas-investimentos]]"]
---

# Story sim-1: Dados de configuração base (pipelines, stages, tags, usuários demo)

## Objetivo
Garantir que o tenant João Guirunas (`wotuyxscsfralqpoiyfv`) tenha pipeline comercial, stages, motivos de perda, campos personalizados, times e ao menos 3 usuários de demonstração configurados — base obrigatória para todas as demais stories `sim-*`.

## Acceptance Criteria
- [ ] AC1: Existe ao menos **1 pipeline ativo** em `leads_pipelines` (e espelho em `crm_pipelines` se necessário) no tenant `wotuyxscsfralqpoiyfv`, nome ex.: "Comercial — Demo".
- [ ] AC2: O pipeline tem **mínimo 5 stages** em `leads_stages` (ex.: `Novo Lead`, `Qualificação`, `Proposta`, `Negociação`, `Fechamento`) com `order_index` 1..5 e cores distintas; estados terminais virtuais `won` e `lost` mapeados via coluna `status` em `leads`.
- [ ] AC3: Existem **mínimo 5 motivos de perda** em `leads_loss_reasons` (ex.: "Sem orçamento", "Concorrente", "Timing ruim", "Não respondeu", "Não é decisor").
- [ ] AC4: Existem **3 usuários demo** em `settings_users` (1 gestor + 2 SDR/Closers) com nomes/emails realistas tipo `gestor@ora-demo.com`, `sdr.ana@ora-demo.com`, `closer.bruno@ora-demo.com`. Se já existirem usuários reais, criar como adicionais com sufixo `(demo)`.
- [ ] AC5: Pelo menos **1 time de vendas** em `settings_teams` com os 3 usuários demo associados via `settings_users_teams`.
- [ ] AC6: Script é **idempotente** — se rodado 2x não duplica registros (uso de `INSERT ... ON CONFLICT DO NOTHING` ou `WHERE NOT EXISTS`).
- [ ] AC7: Todos os registros têm `tenant_id = 'wotuyxscsfralqpoiyfv'` corretamente.

## Escopo

**IN:**
- Arquivo SQL `supabase/seeds/sim-1-config-base.sql` (apenas INSERT/UPDATE — nunca ALTER/CREATE/DROP).
- Pipeline + stages no schema moderno (`leads_pipelines`, `leads_stages`).
- Motivos de perda em `leads_loss_reasons`.
- Usuários demo em `settings_users` (sem criar `auth.users` — esses precisam de fluxo separado se necessário, ou usar `auth_user_id` NULL com flag de demo).
- Times em `settings_teams` + junction.
- Documentação inline no SQL com comentários explicativos.

**OUT:**
- Criação de `auth.users` (não é possível via SQL puro sem credenciais; usuários demo terão `auth_user_id` nullable ou existente).
- Stages customizadas além das 5 base (deixar simples).
- Configuração de canais WhatsApp (`settings_whatsapp_channels`) — fora do escopo desta story; se necessário, será sim-3.
- Campos personalizados (`crm_field_definitions`) — opcional, fora do MVP.

## Contexto Técnico

**Tabelas afetadas:**
- `leads_pipelines` (id uuid, name, active, order_index, tenant_id)
- `leads_stages` (id uuid, name, order_index, pipeline_id, color, active)
- `leads_loss_reasons`
- `settings_users` (lembrar: `auth_user_id` pode ser NULL se for usuário demo sem login real; checar se RLS permite)
- `settings_teams`, `settings_users_teams`

**Constraints críticas:**
- `tenant_id` obrigatório em todas as tabelas — usar literal `'wotuyxscsfralqpoiyfv'::uuid`.
- RLS: scripts SQL rodam via service_role (bypass), portanto policies não bloqueiam.
- `leads_stages.pipeline_id` FK → `leads_pipelines.id`: usar CTE ou variáveis para reusar UUIDs entre INSERTs.

**Dependências:**
- Nenhuma — esta é a story raiz que desbloqueia todas as outras.

**Bloqueia:**
- sim-2 (leads precisam de `pipeline_id`/`stage_id`/`user_id`/`person_id`)
- sim-3, sim-4, sim-5, sim-6

**Padrão de execução:**
Script roda via Supabase SQL Editor ou via `supabase db execute --file`. Nunca via migration regular (não é mudança de schema). Marcar arquivo como `seeds/` para diferenciar.

**Sugestão de estrutura:**
```sql
-- =========================================
-- sim-1: Configuração base do tenant João Guirunas demo
-- =========================================
DO $$
DECLARE
  v_tenant_id uuid := 'wotuyxscsfralqpoiyfv';
  v_pipeline_id uuid;
BEGIN
  -- 1. Pipeline
  INSERT INTO leads_pipelines (name, active, order_index, tenant_id)
  VALUES ('Comercial — Demo', true, 1, v_tenant_id)
  ON CONFLICT (...) DO UPDATE SET active = true
  RETURNING id INTO v_pipeline_id;

  -- 2. Stages (5)
  INSERT INTO leads_stages (name, order_index, pipeline_id, color, active, tenant_id)
  VALUES
    ('Novo Lead',     1, v_pipeline_id, '#3B82F6', true, v_tenant_id),
    ('Qualificação',  2, v_pipeline_id, '#8B5CF6', true, v_tenant_id),
    ('Proposta',      3, v_pipeline_id, '#F59E0B', true, v_tenant_id),
    ('Negociação',    4, v_pipeline_id, '#EF4444', true, v_tenant_id),
    ('Fechamento',    5, v_pipeline_id, '#10B981', true, v_tenant_id)
  ON CONFLICT (...) DO NOTHING;

  -- 3. Motivos de perda, usuários, times...
END $$;
```

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
