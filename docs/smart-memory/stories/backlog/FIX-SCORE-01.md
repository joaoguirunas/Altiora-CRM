---
title: "FIX-SCORE-01: Atualizar types.ts do score-pro, remover as any, implementar re-avaliação assíncrona"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-analyst
created: 2026-04-22
updated: 2026-04-22
tags: [story, score-pro, debt, P2]
related: ["[[../../project/modules/score-pro]]"]
---

# FIX-SCORE-01: Atualizar types.ts do score-pro, remover as any, implementar re-avaliação assíncrona

## Objetivo
Regenerar tipos TypeScript do score-pro a partir do schema atual, eliminar todos os `as any` nos hooks, e implementar a re-avaliação assíncrona de scores (atualmente não implementada).

## Acceptance Criteria
- [ ] AC1: `types.ts` do score-pro reflete schema atual (sem campos obsoletos, sem ausentes)
- [ ] AC2: Zero ocorrências de `as any` nos hooks de score-pro
- [ ] AC3: Re-avaliação assíncrona de score implementada (quando matrix muda, leads existentes são re-scored)
- [ ] AC4: TypeScript compila sem erros relacionados a score-pro

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

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-analyst (lyra) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/score-types-async-reeval |

## File List

## QA Results
