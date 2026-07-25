---
title: "ALTIORA-03: Kanban card — exibir Closer, tempo na etapa, última atividade e próxima ação"
type: story
status: backlog
epic: ALTIORA-A
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, kanban, card, frontend]
related: ["[[ALTIORA-02]]", "[[ALTIORA-08]]", "[[ALTIORA-11]]"]
---

# ALTIORA-03: Kanban card — exibir Closer, tempo na etapa, última atividade e próxima ação

## Objetivo
Adaptar o card do KanbanBoard para o pipeline Altiora exibindo as quatro informações operacionais críticas: nome do Closer responsável, tempo decorrido na etapa atual, data/descrição da última atividade e descrição + prazo da próxima ação.

## Acceptance Criteria
- [ ] AC1: Card do Kanban exibe avatar/iniciais e nome do Closer responsável (campo `closer_id` → nome via `useUsuarios`). Se não atribuído, exibe badge "Sem Closer".
- [ ] AC2: Card exibe tempo na etapa atual em formato legível ("2d", "5h", "3sem") calculado a partir de `stage_entered_at` — campo a ser adicionado em `leads` ou derivado do histórico de transições.
- [ ] AC3: Card exibe label + data da última atividade registrada (último registro em `lead_interactions` ou `lead_stage_history`).
- [ ] AC4: Card exibe próxima ação com tipo + prazo, com destaque visual (badge vermelho) quando prazo está vencido (data < hoje).
- [ ] AC5: Cards de outros pipelines (não Altiora) **não** são afetados — o layout adicional é condicional ao `pipeline_id` Altiora ou via feature flag de configuração de pipeline.

## Escopo

**IN:**
- Modificar `StageColumn.tsx` (ou componente de card extraído) para exibir os 4 campos
- Adicionar coluna `stage_entered_at` em `leads` via migration (nullable, sem DEFAULT para não quebrar existentes) ou calcular via última entrada no histórico
- Adicionar `next_action_type`, `next_action_description`, `next_action_due_at` em `leads` (ou tabela auxiliar) — migration nullable

**OUT:**
- Criação completa da ficha (cobre ALTIORA-08)
- Lógica de alertas de SLA (cobre ALTIORA-25)
- Funcionalidade de atribuição de Closer (cobre ALTIORA-07)

## Contexto Técnico
- `src/components/negocios/StageColumn.tsx` — local do card atual; preferir extrair `ReferralCard.tsx` para isolar mudanças
- `src/hooks/useNegociosOptimized.ts` — query do negócio; verificar se retorna `closer_id`
- `src/hooks/useUsuarios.ts` — para resolver nome do Closer pelo id
- Schema: `leads` table — verificar colunas existentes antes de adicionar
- Migration: seguir padrão `YYYYMMDDHHMMSS_altiora_card_fields.sql`

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
