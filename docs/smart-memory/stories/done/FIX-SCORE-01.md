---
title: "FIX-SCORE-01: Atualizar types.ts do score-pro, remover as any, implementar re-avaliação assíncrona"
type: story
status: done
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-07-25
tags: [story, score-pro, debt, P2]
related: ["[[../../project/modules/score-pro]]"]
---

# FIX-SCORE-01: Atualizar types.ts do score-pro, remover as any, implementar re-avaliação assíncrona

## Objetivo
Regenerar tipos TypeScript do score-pro a partir do schema atual, eliminar todos os `as any` nos hooks, e implementar a re-avaliação assíncrona de scores (atualmente não implementada).

## Acceptance Criteria
- [x] AC1: `types.ts` do score-pro reflete schema atual (sem campos obsoletos, sem ausentes)
- [x] AC2: Zero ocorrências de `as any` nos hooks de score-pro
- [x] AC3: Re-avaliação assíncrona de score implementada (quando matrix muda, leads existentes são re-scored)
- [x] AC4: TypeScript compila sem erros relacionados a score-pro

## Escopo

**IN:**
- Regenerar ou reescrever `types.ts` conforme schema atual
- Corrigir tipagem nos hooks (`useScoreMatrix`, `useLeadScore`, etc.)
- Implementar worker/edge fn de re-avaliação em batch quando matrix muda

**OUT:**
- Mudanças no schema de score
- UI de configuração de matrix (já existente)

## Contexto Técnico
Score PRO usa uma JSONB matrix (categories × items → score_number). O `types.ts` foi identificado como desatualizado — todos os hooks usam `as any` como workaround. Re-avaliação assíncrona quando a matrix muda não está implementada (leads ficam com score stale). Ver `docs/smart-memory/project/modules/score-pro.md`.

### Detalhes da implementação

**AC1 — types.ts**
- `score_matrix` Row/Insert/Update: removidos campos legados (`framing_id: string[] | null`, `investment_id: string[] | null`, `objective_id: string[] | null`); adicionado `category_selections: Json`. Esses campos foram dropados em `20260312120000_db_cleanup_audit.sql`.
- Adicionadas definições completas (Row/Insert/Update/Relationships) para:
  - `score_categories` — id, name, slug, order_index, active, timestamps
  - `score_category_items` — id, category_id, name, description, active, order_index, timestamps + FK para score_categories
  - `score_settings` — key (PK), value, timestamps
- Marcadas com `// Manually added 2026-07-25 (FIX-SCORE-01) — pending supabase gen types`

**AC2 — Zero `as any`**
- `useScoreCategories.ts`: removidos todos `supabase as unknown as { from: (t: string) => any }` e `.from('score_categories' as 'score_objectives')`; substituídos por `supabase.from('score_categories')` e `supabase.from('score_category_items')` direto.
- `useScoreMatrix.ts`: removido `const db = () => supabase as any`; todas as chamadas usam `supabase.from(...)` com tipagem real. Strip de `resolved_categories` em `useUpdateScoreMatrix` feito com destructuring sem `as any` (campo existe na interface `ScoreMatrix`). Único cast residual: `data as unknown as ScoreMatrix` em `useScoreMatrixById`/`useFindScoreMatrix` — necessário porque o Supabase retorna `Json` para `category_selections` mas o tipo da interface usa `Record<string, string[]>` (shape correto em runtime).

**AC3 — Re-avaliação assíncrona**
- `useUpdateScoreMatrix.onSuccess`: chama `supabase.functions.invoke('score-re-evaluate', { body: { matrix_id: variables.id } })` — modo 2, re-sync score_number para todos os `clients_people` vinculados à matrix atualizada. Fire-and-forget (sem bloquear UI); erro logado no console.
- `useDeleteScoreMatrix.onSuccess`: chama `supabase.functions.invoke('score-re-evaluate', { body: { deleted_matrix_ids: [id] } })` — modo 1, limpa score para persons que tinham esta matrix. A edge fn `score-re-evaluate` (20+ versões testadas) já existia totalmente implementada mas nunca era invocada.

**AC4 — TypeScript**: `npx tsc --noEmit` → 0 erros. `eslint` nos dois hooks → 0 erros.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/integrations/supabase/types.ts` — AC1: updated score_matrix schema; added score_categories, score_category_items, score_settings
- `src/hooks/useScoreCategories.ts` — AC2: removed all `as any` / `as unknown as { from: ... }` casts
- `src/hooks/useScoreMatrix.ts` — AC2+AC3: removed `db = () => supabase as any`; added score-re-evaluate calls in onSuccess handlers

## QA Results
