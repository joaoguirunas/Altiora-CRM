---
title: "AUTH-V2-12: RestrictedRoute requireSuperAdmin — validar via fetch ao control plane"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, security, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-AUTH-03-restricted-route-control-plane]]"]
---

# AUTH-V2-12: RestrictedRoute requireSuperAdmin — validar via fetch ao control plane

## Objetivo
Fortalecer a guarda do `/adm` substituindo a verificação de `sessionStorage._supabase_client_config` por um fetch autenticado ao control plane que confirma se o JWT atual tem `super_admin = true` na tabela `settings_users` do control plane DB.

## Acceptance Criteria
- [x] AC1: `RestrictedRoute requireSuperAdmin` chama `adm-verify-super-admin` edge fn com Bearer JWT — a fn faz `auth.getUser(token)` no control plane e verifica `settings_users.super_admin = true`
- [x] AC2: Resultado cacheado em `sessionStorage._adm_verified_{userId}` por 5 minutos — evita fetch em cada navigate dentro do `/adm`
- [x] AC3: Durante fetch, `RestrictedRoute` mostra spinner "Verificando acesso..." — timeout de 3s via AbortController; se AbortError, `verifyState` fica 'denied'
- [x] AC4: Se `adm-verify-super-admin` retorna 401/403, limpa `sessionStorage._supabase_client_config` e chama `signOut()`
- [x] AC5: Check de `isControlPlane` via `sessionStorage._supabase_client_config` mantido como pré-condição — acesso só concedido se `isControlPlane && verifyState === 'granted'`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/functions/adm-verify-super-admin/index.ts` (novo)
- `src/components/auth/RestrictedRoute.tsx` — async verify flow + cache + spinner + signOut on 401/403

## QA Results
<!-- QA preenche ao revisar -->
