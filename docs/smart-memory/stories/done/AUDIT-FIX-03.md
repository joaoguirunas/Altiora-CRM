---
title: "AUDIT-FIX-03: P0 Security — Centralizar CONTROL_PLANE credentials"
type: story
status: done
epic: AUDIT-FIX
complexity: M
agent: dev-dev-delta
created: 2026-04-26
updated: 2026-04-26
tags: [story, security, p0, sprint-2]
related: ["[[../../audit/resilience]]", "[[../../audit/inconsistencies]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-03: P0 Security — Centralizar CONTROL_PLANE credentials e validar config

## Objetivo
Eliminar CONTROL_PLANE anon key hardcoded em 4 arquivos (com 2 valores diferentes) e adicionar validação de config corrompida no bootstrap.

## Causa raiz
CR-4 (CONTROL_PLANE credentials hardcoded em múltiplos lugares divergentes).

## Acceptance Criteria
- [ ] AC1: `CONTROL_PLANE_URL` e anon key definidos em único lugar (`src/lib/client.ts` ou `src/lib/constants.ts`)
- [ ] AC2: `useUsersNew.ts`, `PublicFormPage.tsx`, `DataDeletionPage.tsx` importam do local centralizado
- [ ] AC3: Apenas 1 valor de anon key em toda a codebase (sem divergência)
- [ ] AC4: `client.ts:resolveConfig()` valida formato de URL e comprimento mínimo de key antes de usar
- [ ] AC5: Config corrompida em sessionStorage exibe erro claro ao usuário (não falha silenciosa)

## Escopo

**IN:**
- `src/lib/client.ts` (ou `src/lib/constants.ts`) — criar `CONTROL_PLANE_URL` e `CONTROL_PLANE_ANON_KEY` como constantes exportadas
- `src/hooks/useUsersNew.ts` — remover hardcode, importar constantes
- `src/pages/PublicFormPage.tsx` — remover hardcode, importar constantes
- `src/pages/DataDeletionPage.tsx` — remover hardcode, importar constantes
- `src/lib/client.ts:resolveConfig()` — adicionar validação de URL e key

**OUT:**
- Rotação de credenciais (operacional, fora do código)
- `adm-client-config` CORS (AUDIT-FIX-08)

## Status
🔄 Em execução — dev-dev-delta
