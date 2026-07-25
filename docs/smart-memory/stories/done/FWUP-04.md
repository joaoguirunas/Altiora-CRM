---
title: "Story FWUP-04: Migrar componentes ScoreMatrix para category_selections"
type: story
status: backlog
epic: FWUP
complexity: M
priority: P1
agent: dev-dev-alpha
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, components, score, p1]
related: ["[[../../project/audit-followups-diagnostico]]", "[[../../agents/ux/audit-followups-componentes]]"]
---

# Story FWUP-04: Migrar componentes ScoreMatrix para category_selections

## Objetivo
Restaurar a renderização correta de badges informacionais (objetivo/investimento/segmento) em `MultiSelectScoreMatrix` e `ScoreMatrixSelector`, que hoje acessam campos legados (`objective_id`, `investment_id`, `framing_id`) inexistentes no tipo `ScoreMatrix` atual — migrado para `category_selections: Record<string, string[]>`.

## Acceptance Criteria
- [x] **AC1:** `MultiSelectScoreMatrix` lê labels via `matrix.resolved_categories` (pre-computed em `useScoreMatrix` queryFn) em vez de `matrix.objective_id` etc.
- [x] **AC2:** `ScoreMatrixSelector` segue o mesmo padrão; badges renderizam labels reais em vez de `undefined`/`'N/A'`.
- [x] **AC3:** Novo hook utilitário `useScoreMatrixLabels(matrix)` retorna `{ [categoryName: string]: string[] }` com labels já resolvidas — exportado de `src/hooks/useScoreMatrixLabels.ts`.
- [x] **AC4:** Hooks legados `useScoreObjectives`, `useScoreInvestments`, `useScoreFramings` mantidos (têm 7 outros consumidores externos confirmados: ScoreObjectivesCard, ScoreInvestmentsCard, ScoreFramingsCard, FiltroContatosVisual, PessoaFiltersStep, LpFormTest, PersonScoreSection).
- [ ] **AC5:** Storybook ou screenshot manual demonstra badges renderizando corretamente para uma matrix com 3 categorias diferentes.
- [x] **AC6:** `tsc --noEmit` limpo nos dois arquivos — sem `as any` pra contornar tipo.
- [x] **AC7:** `MultiSelectScoreMatrix` e `ScoreMatrixSelector` deixam de aparecer como QUEBRADOS na próxima auditoria de componentes.

## Escopo

**IN:**
- Refatorar `MultiSelectScoreMatrix.tsx` (linhas 65-67, 109-111)
- Refatorar `ScoreMatrixSelector.tsx` (linhas 72-75, 89-97)
- Criar hook `useScoreMatrixLabels` em `src/hooks/`
- Validar com Lyra (dev-analyst) o status atual de `useScoreObjectives` / `useScoreInvestments` / `useScoreFramings`

**OUT:**
- Migrar outras superfícies que possam ler campos legados (varrer codebase é responsabilidade de FWUP-10)
- Mudanças no schema `score_matrix` no DB
- Reformular UX dos badges (escopo de design system, não desta story)

## Contexto Técnico

**Arquivos afetados:**
- `src/components/followups/MultiSelectScoreMatrix.tsx`
- `src/components/followups/ScoreMatrixSelector.tsx`
- `src/hooks/useScoreMatrix.ts` (linhas 16-29 — interface canônica)
- `src/hooks/useScoreMatrixLabels.ts` — novo

**Causa raiz:** Migração para schema `category_selections: Record<string, string[]>` (formato dinâmico) não foi propagada para esses dois componentes. UI degradada — toda a seleção e remoção funciona, mas badges informacionais ficam vazios.

**Independente:** Pode rodar em paralelo com FWUP-03. Não bloqueia nem é bloqueado por nenhuma outra FWUP.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main (commit 00f75133) |

## File List
- `src/hooks/useScoreMatrixLabels.ts` — criado
- `src/components/followups/MultiSelectScoreMatrix.tsx` — reescrito
- `src/components/followups/ScoreMatrixSelector.tsx` — reescrito

## QA Results

```
VEREDICTO: CONCERNS
Story: FWUP-04 | Data: 2026-04-27 | Auditor: Axikar
Aprovado com observações:
- [LOW] AC5 (Storybook ou screenshot manual demonstrando badges renderizando para matrix com 3 categorias) declaradamente pendente. Sem evidência visual confirmada — recomendar capturar screenshot em deploy.
Verificações:
- MultiSelectScoreMatrix.tsx:21,39 usa `matrix.resolved_categories ?? []`.
- ScoreMatrixSelector.tsx:61 usa `matrix.resolved_categories ?? []`.
- Hook src/hooks/useScoreMatrixLabels.ts existe.
- Zero referências a `objective_id`/`investment_id`/`framing_id` nos componentes.
- Hooks legados (useScoreObjectives etc) preservados — têm 7 outros consumers confirmados.
Próximo passo: @dev-devops push (capturar screenshot em staging para fechar AC5)
```
