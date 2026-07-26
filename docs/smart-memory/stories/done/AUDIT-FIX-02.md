---
title: "AUDIT-FIX-02: P0 Auth — Race conditions e profile provisional"
type: story
status: done
epic: AUDIT-FIX
complexity: L
agent: dev-beta
created: 2026-04-26
updated: 2026-04-27
tags: [story, auth, p0, sprint-2]
related: ["[[../../audit/resilience]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-02: P0 Auth — Race conditions e profile provisional

## Objetivo
Eliminar race conditions no init de auth e garantir que profile provisional não silenciosamente remove acesso de super-admin.

## Causa raiz
CR-7 (auth init com timeouts não-coordenados).

## Dev Agent Record
| Agente | Rex (dev-dev-beta) |
| Iniciado | 2026-04-27 |
| Concluído | 2026-04-27 |
| Commit | fix(auth): DashLayout isControlPlane reativo + super-admin pre-warm + provisional banner |

## Acceptance Criteria
- [x] AC1: UI não é liberada antes do listener `onAuthStateChange` subscrever
- [x] AC2: Quando profile é provisional (`isProvisional:true`), rotas restritas bloqueiam com banner de aviso
- [x] AC3: Banner de provisional inclui botão "Recarregar" que faz retry de fetchUserProfile
- [x] AC4: Super-admin não perde acesso à sidebar ADM por profile provisional (pre-warm adm-verify após login)
- [x] AC5: `isControlPlane` reavalia quando `user.profile.id` muda (deps `[user?.profile?.id]`)

## Escopo

**IN:**
- `src/hooks/useAuth.ts` — onAuthStateChange subscrito ANTES de getSession(); retry automático 3x/2s; pre-warm adm-verify para super_adm
- `src/components/auth/RestrictedRoute.tsx` — banner quando `isProvisional:true`; fallback erro após 5s/retries esgotados
- `src/components/layout/DashLayout.tsx` — `isControlPlane` useMemo deps `[user?.profile?.id]`

**OUT:**
- MFA flow (AUDIT-FIX-07) — concluído em commit separado
- CONTROL_PLANE credentials (AUDIT-FIX-03) — concluído em commit separado

## File List
- `src/hooks/useAuth.ts`
- `src/components/auth/RestrictedRoute.tsx`
- `src/components/layout/DashLayout.tsx`

## Status
✅ Concluído — pronto para QA
