---
title: "FIX-COACH-01: Corrigir mismatch de nome de view (coach_meeting_evaluations vs meeting_evaluations)"
type: story
status: backlog
priority: P1
complexity: S
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-04-22
tags: [story, coach-pro, bug, P1]
related: ["[[../../project/modules/coach-pro]]"]
---

# FIX-COACH-01: Corrigir mismatch de nome de view (coach_meeting_evaluations vs meeting_evaluations)

## Objetivo
Unificar o nome da view/tabela de avaliações de reunião usada pelos hooks do Coach PRO — eliminar o risco de crash no Dashboard em produção.

## Acceptance Criteria
- [ ] AC1: Todos os hooks do coach-pro referenciam o mesmo nome de objeto (`meeting_evaluations` ou `coach_meeting_evaluations` — decidir qual é canônico)
- [ ] AC2: View/tabela canônica existe no schema Supabase (verificar migrations)
- [ ] AC3: Dashboard de avaliações carrega sem erro 400/500 em staging
- [ ] AC4: Se view foi renomeada, migration de rename criada e aplicada

## Escopo

**IN:**
- Auditar todos os hooks em `src/` que referenciam `coach_meeting_evaluations` ou `meeting_evaluations`
- Decidir nome canônico (preferir o que tem migration mais recente)
- Corrigir todos os usos inconsistentes
- Criar migration se necessário para alinhar schema

**OUT:**
- Refactor do modelo de dados de avaliações
- Novas features de coach

## Contexto Técnico
Descoberto no deep-dive: parte dos hooks usa `coach_meeting_evaluations` (view) e parte usa `meeting_evaluations` (tabela). Se a view não existe em algum tenant, o Dashboard crasha em runtime. Ver `docs/smart-memory/project/modules/coach-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer (byte) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/coach-view-name |

## File List

## QA Results
