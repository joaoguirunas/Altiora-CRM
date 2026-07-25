---
title: "FIX-PP-01: Corrigir edge fns prospect-scorer e prospect-commit (schema v1 quebrado)"
type: story
status: backlog
priority: P0
complexity: M
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-04-22
tags: [story, prospect-pro, bug, P0]
related: ["[[../../project/modules/prospect-pro]]"]
---

# FIX-PP-01: Corrigir edge fns prospect-scorer e prospect-commit (schema v1 quebrado)

## Objetivo
Corrigir as edge functions `prospect-scorer` e `prospect-commit` que referenciam `prospect_people.establishment_id` (coluna do schema v1, renomeada/removida), quebrando todas as campanhas com `version=1`.

## Acceptance Criteria
- [ ] AC1: `prospect-scorer` não faz mais referência a `establishment_id` — usa `tenant_id` (schema v2)
- [ ] AC2: `prospect-commit` idem — sem referência a `establishment_id`
- [ ] AC3: Campanhas com `version=1` completam sem erro 500 no Supabase logs
- [ ] AC4: Campanhas com `version=2` não regridem
- [ ] AC5: Deploy das edge fns realizado e smoke-tested em staging

## Escopo

**IN:**
- `supabase/functions/prospect-scorer/index.ts` — corrigir query/coluna
- `supabase/functions/prospect-commit/index.ts` — corrigir query/coluna
- Deploy via `supabase functions deploy`

**OUT:**
- Migrações de schema (coluna já foi renomeada em migration anterior)
- Refactor de outras edge fns prospect não relacionadas ao bug

## Contexto Técnico
Schema v1 usava `prospect_people.establishment_id`; schema v2 renomeou para `tenant_id` (migration em algum ponto de 2025). As edge fns não foram atualizadas. Campanhas `version=1` chamam `prospect-scorer` que falha com "column prospect_people.establishment_id does not exist". Ver deep-dive: `docs/smart-memory/project/modules/prospect-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer (byte) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/prospect-v1-edge-fns |

## File List

## QA Results
