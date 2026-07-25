---
title: "ADR-AUTH-04: Granularidade de hooks de auth — useAuth vs useCurrentUser vs useUserPermissions"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, auth, hooks, react, permissions, architecture]
related: ["[[ADR-AUTH-02-fallback-profile-timeout]]"]
---

# ADR-AUTH-04: Granularidade de hooks de auth

## Context

O módulo de auth expõe múltiplos hooks que retornam informações sobrepostas sobre o usuário:
- `useAuth()` — retorna `{ user, session, isLoading, signIn, signOut, ... }` do `SimpleAuthProvider`. `user` inclui profile embutido.
- `useCurrentUser()` — React Query que faz SELECT em `settings_users` por `auth_user_id`. Retorna apenas o profile, sem session.
- `useUserPermissions()` — cristaliza role-gates em booleanos memoizados. Consome `useAuth()` internamente.

Problema: sem clareza de quando usar qual hook, componentes acabam usando `useAuth()` para tudo, causando acoplamento ao provider stack completo quando só precisavam de um campo do profile; ou usando `useCurrentUser()` quando precisavam da session para fazer chamadas autenticadas.

## Decision

**Regra de uso por caso:**

| Caso de uso | Hook correto | Por quê |
|---|---|---|
| Verificar se usuário está logado | `useAuth()` | `user !== null` é a fonte de verdade de autenticação |
| Obter `user.id` para queries | `useAuth()` | `user.id` é o auth user ID — consistente com o profile |
| Acessar `session.access_token` para chamadas a edge fns | `useAuth()` | Session só existe no `SimpleAuthProvider` |
| Verificar role (gestor/consultor/super_adm) na UI | `useUserPermissions()` | Booleanos memoizados; não re-render desnecessário |
| Feature gating (pode criar usuário? pode deletar?) | `useUserPermissions()` | Lógica de permissão centralizada e testável. **Nota (ARCH-RBAC-02, 2026-07-25):** Os 8 gates granulares que liam `tenant_role_permissions` (`canExportCRM`, `canDeleteCRM`, `canViewScore`, `canViewCoach`, `canEditCoach`, `canCreateSends`, `canViewBI`, `canViewSettings`) foram removidos. O gating é feito exclusivamente via `user_type` (admin/manager/user). |
| Filtros de query por responsável/time | `useUserPermissions().getResponsavelFilter()` | Retorna sentinel `__INVALID_USER__` quando profile inválido |
| Componentes que precisam só do profile (nome, avatar) | `useCurrentUser()` | React Query com cache — não re-executa auth flow inteiro |
| Componentes fora do `SimpleAuthProvider` | `useCurrentUser()` | `useAuth()` throw se fora do provider |

**Regras derivadas:**
1. `useCurrentUser()` é um React Query — pode ser usado em componentes que não estão na árvore do `SimpleAuthProvider` (ex: componentes em portals, SSR futuros). `useAuth()` throw fora do provider.
2. `useUserPermissions()` deve ser o ponto único de decisão de permissão — nunca checar `user.profile.user_type === 'gestor'` inline em componentes.
3. `__INVALID_USER__` sentinel de `getResponsavelFilter()` / `getTeamFilter()` deve ser propagado sem modificação para hooks de query — eles checam e retornam array vazio se sentinel detectado.

## Consequences

**Positivo:**
- Lógica de permissão centralizada em `useUserPermissions` — mudança de regra de negócio (ex: "atendente agora pode acessar CRM") requer edição em um lugar.
- `useCurrentUser()` tem cache TanStack Query — múltiplos componentes que precisam do profile não disparam múltiplos fetches.
- Sentinel `__INVALID_USER__` previne vazamento de dados quando profile está em fallback (user vê lista vazia ao invés de todos os dados).

**Negativo / trade-offs:**
- **Duplicação de fetch**: `useAuth()` carrega profile no provider; `useCurrentUser()` faz outro SELECT. Em prática ambos acabam em cache (TanStack) e o segundo fetch é stale no segundo render. Mas inicialmente há dois fetches para o mesmo dado.
- **`useUserPermissions()` depende de `useUsuariosTimes()`**: cada componente que usa `useUserPermissions` também dispara fetch de times. Pode ser over-fetching para componentes que só precisam de `isGestor`. Mitigação: `staleTime` padrão do TanStack ameniza.
- **Nome `useSimpleAuthSingleTenant`**: sugere acoplamento ao modelo single-tenant. Alias `useAuth` é exportado mas o arquivo original mantém o nome — confuso para novos desenvolvedores. Renomear rastreado em AUTH-V2-05.

**Arquivos relevantes:**
- `src/hooks/useSimpleAuthSingleTenant.ts` — `useAuth`, `useSimpleAuth`
- `src/hooks/useCurrentUser.ts` — React Query do profile
- `src/hooks/useUserPermissions.ts` — role-gates, sentinels, `getResponsavelFilter()`
- `src/components/auth/SimpleAuthProvider.tsx` — context provider
