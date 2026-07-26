---
title: "US-CFG-06: Módulo de Permissões granulares por role"
type: story
status: done
epic: settings
complexity: L
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, settings, permissions, auth, P2]
related: ["[[../../project/modules/settings]]", "[[../../decisions/ADR-AUTH-03-restricted-route-control-plane]]", "[[../../decisions/ADR-AUTH-04-auth-hooks-granularity]]"]
---

# US-CFG-06: Módulo de Permissões granulares por role

## Objetivo
Permitir que gestores definam permissões por role customizadas além do binário `gestor / atendente` atual, controlando acesso a seções específicas do produto.

## Acceptance Criteria
- [x] AC1: Nova seção Settings > Permissões exibe matriz role × feature: linhas = features, colunas = roles (gestor, atendente + custom)
- [x] AC2: Gestor pode criar role customizada (nome livre, descrição opcional) — salva em `tenant_roles` com `is_system = false`; seeded com todos os features disabled
- [x] AC3: Permissões salvas em `tenant_role_permissions` (role_id, feature_key, enabled) — role `gestor` mostra badge "Sempre" (não editável), `atendente` é system com defaults restritivos
- [x] AC4: `useUserPermissions()` lê `tenant_role_permissions` para o `role_id` do usuário via `useCurrentUserFeaturePermissions` — expõe `canExportCRM`, `canDeleteCRM`, `canViewScore`, `canViewCoach`, `canEditCoach`, `canCreateSends`, `canViewBI`, `canViewSettings`; fallback hardcoded quando sem configuração (backward compat)
- [x] AC5: Mudança de permissão invalida cache `['user-permissions']` imediatamente via `queryClient.invalidateQueries`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations/20260423009000_tenant_role_permissions.sql` — `feature_key` enum, `tenant_roles`, `tenant_role_permissions`, FK `settings_users.role_id`, função `seed_default_tenant_roles`
- `src/hooks/usePermissions.ts` (novo) — `useTenantRoles`, `useAllRolePermissions`, `useCreateTenantRole`, `useDeleteTenantRole`, `useUpdateRolePermission`
- `src/hooks/useUserPermissions.ts` — adiciona `useCurrentUserFeaturePermissions` + 8 granular feature gates
- `src/components/config/PermissoesConfig.tsx` (novo) — matriz visual com switches por role × feature
- `src/pages/Configuracoes.tsx` — seção "permissoes" no grupo "geral" + lazy import

## QA Results
<!-- QA preenche ao revisar -->
