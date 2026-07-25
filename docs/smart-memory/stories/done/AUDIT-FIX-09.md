---
title: "AUDIT-FIX-09: P1 Code Hygiene — Limpeza geral de código morto e padrões"
type: story
status: done
epic: AUDIT-FIX
complexity: L
agent: dev-analyst + dev-alpha
created: 2026-04-26
updated: 2026-04-26
tags: [story, code-hygiene, p1]
related: ["[[../../audit/inconsistencies]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-09: P1 Code Hygiene — Limpeza geral de código morto e padrões

## Objetivo
Remover código morto, consolidar tipos duplicados e padronizar padrões de data fetching.

## Acceptance Criteria
- [ ] AC1: `getRestrictedSidebarItems` deletado (função morta)
- [ ] AC2: `<PerformanceMonitor />` movido para `import.meta.env.DEV`
- [ ] AC3: `MobileLpPro` import morto removido de App.tsx
- [ ] AC4: Tipo `Usuario` consolidado em único lugar
- [ ] AC5: `useStubsAll` re-export de `usePessoas` removido ou implementado
- [ ] AC6: 30 `eslint-disable-exhaustive-deps` auditados — `CallProActiveCallPopup` corrigido
- [ ] AC7: `useCompanyRelations` migrado para React Query (consistência)
- [ ] AC8: `useSettingsCompat` documentado com data de remoção ou removido

## Escopo

**IN:**
- `src/components/layout/DashLayout.tsx:149` — deletar `getRestrictedSidebarItems`
- `src/components/layout/DashLayout.tsx:755` — mover `PerformanceMonitor` para DEV guard
- `src/App.tsx` — remover import de `MobileLpPro` morto
- `src/types/usuarios.ts` — consolidar 4 definições divergentes
- `src/hooks/usePessoas.ts` — remover re-export de useStubsAll
- `src/components/call/CallProActiveCallPopup.tsx` — corrigir 5 exhaustive-deps
- `src/hooks/useCompanyRelations.ts` — migrar para React Query
- `src/hooks/useSettingsCompat.ts` — documentar ou remover

**OUT:**
- @ts-nocheck (AUDIT-FIX-05)
- tsconfig strict (P1-22, scope futuro)

## Status
⏳ Backlog
