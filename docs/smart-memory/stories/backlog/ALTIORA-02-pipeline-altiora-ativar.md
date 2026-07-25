---
title: "ALTIORA-02: Pipeline Altiora — ativar e exibir 13 etapas no Kanban"
type: story
status: backlog
epic: ALTIORA-A
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, pipeline, kanban, frontend]
related: ["[[ALTIORA-01]]", "[[ALTIORA-03]]", "[[ALTIORA-04]]"]
---

# ALTIORA-02: Pipeline Altiora — ativar e exibir 13 etapas no Kanban

## Objetivo
Garantir que o pipeline "Altiora Referrals" com as 13 etapas seja selecionável e exibido corretamente no KanbanBoard existente, sem regressões nos outros pipelines.

## Acceptance Criteria
- [ ] AC1: O pipeline "Altiora Referrals" aparece no seletor de pipeline em `Negocios.tsx` após seed do ALTIORA-01; ao selecioná-lo, o KanbanBoard exibe exatamente as 13 colunas na ordem correta.
- [ ] AC2: Referrals arrastados entre colunas do pipeline Altiora disparam `useUpdateNegocioStage` e persistem a nova etapa no banco — confirmado via Supabase dashboard.
- [ ] AC3: Pipeline persiste no `localStorage` (`negocios_pipeline_filter`) entre reloads do navegador (comportamento já existente, não deve regredir).
- [ ] AC4: Os outros pipelines ativos continuam funcionando sem alteração de comportamento.
- [ ] AC5: Em mobile (viewport < 768px), as colunas do pipeline Altiora ficam horizontalmente scrolláveis sem overflow oculto.

## Escopo

**IN:**
- Verificar e corrigir qualquer hardcode que impeça a exibição de 13+ colunas no KanbanBoard
- Garantir que `StageColumn` renderize para todas as 13 etapas Altiora
- Ajuste de scroll horizontal se necessário

**OUT:**
- Criação do pipeline/etapas no banco (cobre ALTIORA-01)
- Alteração no card do Kanban (cobre ALTIORA-03)
- Renomear terminologia (cobre ALTIORA-04)

## Contexto Técnico
- `src/pages/Negocios.tsx` — seletor de pipeline e passagem de `stages` filtradas para `KanbanBoard`
- `src/components/negocios/KanbanBoard.tsx` — renderiza `StageColumn` por stage
- `src/components/negocios/StageColumn.tsx` — coluna individual com drag-and-drop
- `src/hooks/useNegociosOptimized.ts` — queries por estágio
- Dependência: ALTIORA-01 deve estar merged para teste real

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
