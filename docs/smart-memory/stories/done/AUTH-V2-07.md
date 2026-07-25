---
title: "AUTH-V2-07: Cleanup crm_tenants, useTenants e user_has_tenant_access"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, refactor, multi-tenant, P3]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-ADM-01-project-per-tenant]]"]
---

# AUTH-V2-07: Cleanup crm_tenants, useTenants e user_has_tenant_access

## Objetivo
Remover vestígios do modelo legado multi-tenant-in-database: stubs `useTenantContext`, `useTenants`, `TenantProvider`.

## Acceptance Criteria
- [x] AC1: `grep -r "useTenantContext\|useTenants\|TenantProvider" src/` retorna 0 nos arquivos de lógica (apenas nos stubs a serem mantidos como referência)
- [x] AC2: `useTenantContext.ts` e `useTenants.ts` desconectados de toda lógica de negócio; `TenantProvider` removido do App.tsx; todos os consumers migrados para `'single-tenant'` literal ou `useAuth().currentTenantId`
- [ ] AC3: Migration SQL `DROP TABLE IF EXISTS public.crm_tenants CASCADE` — PENDENTE: requer dev-data-engineer (25+ políticas RLS dependentes, incluindo migrations recentes da sprint)
- [ ] AC4: Migration SQL `DROP FUNCTION IF EXISTS user_has_tenant_access(uuid)` — PENDENTE: dev-data-engineer deve atualizar todas as policies antes do DROP
- [x] AC5: `useTenants` hook desconectado de todos os consumers em `src/`

## Notas para dev-data-engineer
`user_has_tenant_access` é referenciada em 25 migrations existentes + 4 migrations desta sprint (tenant_api_keys, lgpd_export, prospect_tenant_isolation, auth_events_log). O DROP seguro requer:
1. Para cada tabela: substituir policy que usa `user_has_tenant_access(tenant_id)` por `tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`
2. DROP FUNCTION após todas as policies atualizadas
3. DROP TABLE crm_tenants CASCADE

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 (src; DB pendente dev-data-engineer) |
| Branch     | main |

## File List
- `src/App.tsx` (TenantProvider removido)
- `src/components/layout/DashLayout.tsx` (useTenantContext → constantes inline)
- `src/components/conversas/ConversaDetalhes.tsx` (selectedTenantId → 'single-tenant')
- `src/components/agentes-ia/PipelineStageSelector.tsx` (currentTenantId → inline)
- `src/components/mobile/conversas/MobileConversasList.tsx` (selectedTenantId → 'single-tenant')
- `src/components/mobile/clientes/MobileClientesTabs.tsx` (currentTenantId → 'single-tenant')
- `src/components/negocios/NegociosToolbar.tsx` (selectedTenantId → 'single-tenant')
- `src/components/negocios/MotivoPerdasModal.tsx` (selectedTenantId → 'single-tenant')
- `src/components/debug/PerformanceMonitor.tsx` (currentTenantId → inline)
- `src/hooks/useUserPermissions.ts` (useTenantContext removido)
- `src/hooks/useCoachMeetingAssignment.ts` (useTenantContext → inline)
- `src/pages/Conversas.tsx` (useTenantContext + useTenants removidos)
- `src/pages/Clientes.tsx` (currentTenantId → 'single-tenant')

## QA Results
<!-- QA preenche ao revisar -->
