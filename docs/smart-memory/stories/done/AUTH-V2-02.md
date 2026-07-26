---
title: "AUTH-V2-02: fallbackProfile com isProvisional — bloquear mutations e exibir warning"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, ux, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-AUTH-02-fallback-profile-timeout]]"]
---

# AUTH-V2-02: fallbackProfile com isProvisional — bloquear mutations e exibir warning

## Objetivo
Quando o perfil do usuário é carregado via `fallbackProfile` (timeout de 2s ou fetch error), sinalizar explicitamente via `isProvisional: true` para que hooks de mutation sejam bloqueados e o usuário veja um aviso.

## Acceptance Criteria
- [x] AC1: `fallbackProfile` em `useAuthLogic.fetchUserProfile` inclui `isProvisional: true` — campo adicionado ao tipo `AuthUser.profile` em `useAuth.ts`; profile real tem `isProvisional` ausente (falsy)
- [x] AC2: `useUserPermissions` expõe `isProvisional: boolean` derivado de `user.profile?.isProvisional ?? false`
- [x] AC3: Toast `toast.warning('Perfil carregando...')` com `duration: Infinity` em `DashLayout` quando `isProvisional === true` — dismissido pelo `useEffect` cleanup quando `isProvisional` vira `false`
- [x] AC4: Todos os `can*` flags de mutation críticos retornam `false` quando `isProvisional === true` — `canCreateUser`, `canEditUser`, `canDeleteUser`, `canCreateClient`, `canEditClient`, `canDeleteClient`, `canBlockSchedule`, `canBlockOwnSchedule`, `canChangeFilters`; feature gates também retornam `false`
- [x] AC5: `getResponsavelFilter()` e `getTeamFilter()` retornam `"__INVALID_USER__"` quando `isProvisional === true`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `src/hooks/useAuth.ts` — `AuthUser.profile.isProvisional?: boolean` + `isProvisional: true` nos dois fallback paths (timeout + catch)
- `src/hooks/useUserPermissions.ts` — `isProvisional` propagado; todos os `can*` gates bloqueados quando provisional; filtros retornam `__INVALID_USER__`
- `src/components/layout/DashLayout.tsx` — `useEffect` com toast warning `duration: Infinity`, dismissido quando `isProvisional` vira `false`

## QA Results
<!-- QA preenche ao revisar -->
