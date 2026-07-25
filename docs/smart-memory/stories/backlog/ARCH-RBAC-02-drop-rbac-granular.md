---
title: "ARCH-RBAC-02: Drop completo do sistema RBAC granular (tenant_roles)"
type: story
status: backlog
epic: architecture
complexity: S
agent: dev-data-engineer
created: 2026-05-07
updated: 2026-05-07
tags: [story, architecture, rbac, cleanup]
related: ["[[../done/ARCH-RBAC-01]]", "[[../../decisions/ADR-AUTH-09-rbac-granular-decision]]", "[[../../decisions/ADR-AUTH-04-auth-hooks-granularity]]"]
---

# ARCH-RBAC-02: Drop completo do sistema RBAC granular (tenant_roles)

## Objetivo

Executar a decisão de [[../../decisions/ADR-AUTH-09-rbac-granular-decision]]: remover do código + DB todo o sistema granular `tenant_roles` + `tenant_role_permissions` + `feature_key` + `settings_users.role_id`, junto com hooks/UI/rota correspondentes. Sistema canônico (`user_type`) permanece como única fonte de autorização.

## Acceptance Criteria

- [x] **AC1: Frontend — deletar arquivos** _(Novik, 2026-07-25)_
  - Remover `src/components/config/PermissoesConfig.tsx` (286 LOC). ✅
  - Remover `src/hooks/usePermissions.ts` (162 LOC). ✅
  - Remover entry `permissoes` em `src/pages/settings/registry.ts`. ✅
  - Remover import `ShieldCheck` (só usado pelo entry removido). ✅
  - Remover alias `/settings/general/permissoes` da entry `usuarios-equipes`. ✅
  - Remover tab Permissões de `UsuariosEquipesConfig.tsx`. ✅

- [x] **AC2: Frontend — refatorar `src/hooks/useUserPermissions.ts`** _(Novik, 2026-07-25)_
  - Remover `import type { FeatureKey } from '@/hooks/usePermissions';`. ✅
  - Remover hook interno `useCurrentUserFeaturePermissions`. ✅
  - Remover `const { data: featurePerms } = useCurrentUserFeaturePermissions(...)`. ✅
  - Remover função `canFeature`. ✅
  - Remover 6 gates granulares presentes: `canExportCRM`, `canDeleteCRM`, `canViewScore`, `canCreateSends`, `canViewBI`, `canViewSettings`. ✅
  - Remover `roleId` de todos os objetos retornados. ✅
  - TypeScript: `npx tsc --noEmit` — 0 erros. Zero callers afetados (verificado). ✅

- [ ] **AC3: Migration de drop**
  - Criar `supabase/migrations/{novo_timestamp}_drop_rbac_granular.sql`:
    ```sql
    ALTER TABLE public.settings_users DROP COLUMN IF EXISTS role_id;
    DROP TABLE IF EXISTS public.tenant_role_permissions;
    DROP TABLE IF EXISTS public.tenant_roles;
    DROP TYPE IF EXISTS public.feature_key;
    DROP FUNCTION IF EXISTS public.seed_default_tenant_roles(uuid);
    ```
  - Adicionar em `supabase/client-migrations.json` (registrar para tenants existentes).
  - Idempotência garantida via `IF EXISTS` em todos os DROPs.

- [ ] **AC4: TypeScript types regenerados**
  - Após migration aplicada, regenerar `src/integrations/supabase/types.ts` para refletir schema sem `tenant_roles`/`tenant_role_permissions`.
  - Verificar build TypeScript passa sem erros.

- [ ] **AC5: Smart-memory atualizada**
  - Atualizar `docs/smart-memory/agents/research/user-types-mapping.md` removendo seção sobre `tenant_role_permissions` (manter histórico em git, mas o doc atual deve refletir estado pós-drop).
  - Atualizar [[../../decisions/ADR-AUTH-04-auth-hooks-granularity]] removendo as linhas que descrevem os 8 gates `can*` granulares (preservar contexto histórico em "Notes" se relevante).

- [ ] **AC6: QA verifica**
  - Build passa sem warnings/erros novos.
  - Smoke test em João Guirunas: login como user/manager/admin — todas as 7 páginas afetadas (`Negocios`, `Conversas`, `Reunioes`, `Clientes`, `CoachDashboard`, `CoachTeamBoard`, `Horarios`) renderizam sem regressão.
  - Tela `/settings/general/permissoes` retorna 404 ou redireciona — não acessível.
  - Confirmar via SQL que tabelas/coluna/enum/função foram dropados em João Guirunas.

## Escopo

**IN:**
- Drop de DB: 2 tabelas, 1 coluna FK, 1 enum, 1 função.
- Remoção de 2 arquivos frontend + 1 entry de rota.
- Refactor de 1 hook (apenas remoção de exports não-consumidos).
- Migration registrada em `client-migrations.json`.
- Atualização de smart-memory.

**OUT:**
- Mudança em qualquer um dos 17 callers de `useUserPermissions` — eles devem continuar funcionando idênticos (verificado: nenhum consome o que será removido).
- Alteração no sistema canônico `user_type` (admin/manager/user) — fora de escopo.
- Re-design do RLS de outras tabelas — esta story só toca `settings_users.role_id` (drop) e as 2 tabelas dropadas.
- Edge functions — nenhuma usa `tenant_roles`/`feature_key` (verificado).

## Contexto Técnico

### Pré-condições verificadas (2026-05-07)

```bash
# Zero callers dos 8 gates granulares fora do hook que os define:
grep -rEnw "canExportCRM|canDeleteCRM|canViewScore|canViewCoach|canEditCoach|canCreateSends|canViewBI|canViewSettings" src/
  → apenas useUserPermissions.ts:162-169 (definições)

# DB do tenant João Guirunas:
tenant_roles: 0 rows
tenant_role_permissions: 0 rows
settings_users.role_id: NULL em todos os registros
```

### Bug latente que será removido (bônus)

A migration `20260423009000_tenant_role_permissions.sql` linhas 41-52 e 77-93 define RLS de write filtrando por `user_type='gestor' OR super_admin=true`. Mas `gestor` **não é valor canônico** de `user_type` (canônico: `admin/manager/user`). Resultado: nenhum write em `tenant_roles` ou `tenant_role_permissions` é possível em produção via UI — RLS sempre rejeita. Isso confirma que o sistema nunca foi exercido. O drop elimina o bug junto.

### Caminho seguro de execução

1. Criar branch: `arch/drop-rbac-granular`.
2. Ordem: migration primeiro (drop DB), depois código (drop hooks/UI/rota), depois regen types, depois refactor de `useUserPermissions.ts`.
3. Verificar build local antes de push.
4. Push → Grav cuida do PR.

### Reversão (se necessário)

`git revert` da migration restore as tabelas (vazias). `git revert` do PR de código restaura UI/hooks. Como tabelas estavam vazias em produção, **zero perda de dados**.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente (AC1+AC2) | Novik (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Branch AC1+AC2 | feature/fix-sends-ui-rbac-cleanup |
| Agente (AC3+AC4) | data-engineer (pendente) |
| Concluído  | — (aguarda AC3+AC4+AC5+AC6) |

## File List
- `src/components/config/PermissoesConfig.tsx` — deletado (AC1)
- `src/hooks/usePermissions.ts` — deletado (AC1)
- `src/pages/settings/registry.ts` — removida entry permissoes + import ShieldCheck + alias (AC1)
- `src/components/config/UsuariosEquipesConfig.tsx` — removido tab Permissões (AC1)
- `src/hooks/useUserPermissions.ts` — removido RBAC granular completo (AC2)

## QA Results
<!-- QA preenche ao revisar -->
