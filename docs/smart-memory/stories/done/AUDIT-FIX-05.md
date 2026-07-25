---
title: "AUDIT-FIX-05: P0 Code Hygiene — Remover @ts-nocheck de hooks centrais"
type: story
status: done
epic: AUDIT-FIX
complexity: XL
agent: dev-analyst
created: 2026-04-26
updated: 2026-04-26
tags: [story, typescript, p0, sprint-3]
related: ["[[../../audit/inconsistencies]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-05: P0 Code Hygiene — Remover @ts-nocheck de hooks centrais

## Objetivo
Restaurar o safety net de TypeScript nos 18 arquivos com `@ts-nocheck`, priorizando hooks usados por toda a aplicação.

## Causa raiz
CR-6 (TypeScript safety net desligado em hooks centrais).

## Acceptance Criteria
- [ ] AC1: `useLeads.ts` sem `@ts-nocheck` — build passa
- [ ] AC2: `useSettings.ts` sem `@ts-nocheck` — build passa
- [ ] AC3: `useUsersNew.ts` sem `@ts-nocheck` — build passa
- [ ] AC4: `useTeamsNew.ts` sem `@ts-nocheck` — build passa
- [ ] AC5: `useAgendamentos.ts` sem `@ts-nocheck` — build passa
- [ ] AC6: Demais 13 arquivos auditados e `@ts-nocheck` removidos onde possível
- [ ] AC7: `bun run build` passa sem erros de tipo nos arquivos corrigidos

## Escopo

**IN:**
- Todos os 18 arquivos com `@ts-nocheck` — auditar, criar tipos faltantes, remover flag
- Prioridade: hooks centrais antes dos utilitários
- Criar tipos faltantes em `src/types/` conforme necessário

**OUT:**
- Ativar `strictNullChecks` global no tsconfig (scope separado, muito maior)
- Remover 399 `: any` e 222 `as any` (P1-22, scope separado)

## Ordem sugerida
1. `useUsersNew.ts` (já sendo refatorado em AUDIT-FIX-03)
2. `useSettings.ts`
3. `useLeads.ts`
4. `useTeamsNew.ts`
5. `useAgendamentos.ts`
6. Demais 13 em lote

## Status
⏳ Backlog — iniciar após AUDIT-FIX-01/02/03
