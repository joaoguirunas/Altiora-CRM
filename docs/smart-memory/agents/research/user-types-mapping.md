---
title: "Research: Mapeamento de Tipos de Usuário"
type: research
agent: dev-analyst
created: 2026-05-07
updated: 2026-05-10
tags: [research, auth, rbac, user-types]
related: ["[[../../project/tech-stack]]"]
---

# Mapeamento de Tipos de Usuário

**Decisão que informa:** alinhamento sobre quais roles existem hoje, onde cada um é verificado e quais inconsistências precisam ser tratadas antes de novas features de autorização.
**Solicitado por:** team-lead (joao-guirunas-validate-user-types)

## Resumo executivo

O sistema possui **3 tipos canônicos** (`admin` | `manager` | `user`) na tabela `settings_users.user_type`, mais uma flag legada `super_admin`/`super_adm` ainda lida em vários pontos. O modelo coexiste com **roles customizáveis** por tenant (`tenant_roles` + `tenant_role_permissions`) que adicionam feature flags granulares para usuários `user`. Há ainda um conceito de **control plane** acessado em `/adm` em projeto Supabase separado (não roteado dentro deste SPA). Foram identificadas **6 inconsistências** relevantes — a mais crítica é o uso paralelo de campos legados (`gestor`, `super_adm`, `consultor`) e canônicos (`user_type`) misturados em frontend, RPCs, RLS e edge functions.

---

## Roles identificados

| Role | Onde definido | Como verificado |
|------|---------------|-----------------|
| `admin` | `settings_users.user_type='admin'` (com `super_admin=true` para backward compat) | `useUserPermissions.isAdmin`, `useUserPermissions.isSuperAdmin`, `user.profile.super_adm`, edge functions checam `user_type === 'admin' || super_admin === true`, função SQL `is_admin_or_manager()` |
| `manager` (alias `gestor` / `gerente` legado) | `settings_users.user_type='manager'` | `useUserPermissions.isManagerStrict`/`.isManager` (este último também aceita admin), `user.profile.gestor` (derivado: `user_type === 'manager' \|\| 'admin'`), `RestrictedRoute requireGestor` |
| `user` (alias `consultor` / `atendente` / `cliente` legados) | `settings_users.user_type='user'` (default) | `useUserPermissions.isUser`, fallback profile quando perfil não carrega |
| Tenant role customizado | `tenant_roles` (id, tenant_id, name) + FK `settings_users.role_id` | `useTenantRoles`, `useTenantRolePermissions`, hook `useUserPermissions` lê `tenant_role_permissions` e gera flags `canExportCRM`, `canDeleteCRM`, `canViewScore`, `canViewCoach`, `canEditCoach`, `canCreateSends`, `canViewBI`, `canViewSettings` |
| Provisional (fallback) | flag em runtime: `user.profile.isProvisional=true` quando perfil falha em carregar | `useUserPermissions.isProvisional`; bloqueia mutations e mostra banner laranja em `RestrictedRoute` |
| Super admin do control plane (`/adm`) | Projeto Supabase separado (não `wotuyxscsfralqpoiyfv`); rota `/adm` é externa, fora deste SPA | apenas referenciado em texto de doc (`SystemDocConfig.tsx:492`) e em fluxos `useUsersNew.ts` (call para control plane gateway) |

### Onde os campos vivem (settings_users)

A migration `20260502120000_user_types_canonical_refactor.sql` consolidou:

- `user_type text NOT NULL DEFAULT 'user' CHECK (user_type IN ('admin','manager','user'))`
- `super_admin boolean` — **mantida para backward compat**, mas semanticamente redundante com `user_type='admin'`
- `role_id uuid REFERENCES tenant_roles(id) ON DELETE SET NULL` — feature-level perms para usuários `user`
- `active boolean`, `deleted_at timestamptz` — soft delete

### Atribuição de roles

- **Backend authoritative:** RPC `create_tenant_user(p_user_type, p_super_admin)` insere em `settings_users` (migration linha 154–156). Edge function `create-tenant-user` é o caller normal a partir do frontend.
- **Sem JWT claim de role:** o claim `app_metadata.tenant_id` é usado para isolamento de tenant em RLS, mas o role NÃO é encodado no JWT — toda checagem busca em `settings_users` via `auth_user_id = auth.uid()`. A função `is_admin_or_manager()` (`STABLE SECURITY DEFINER`) é o ponto canônico server-side.
- **Frontend lê profile:** `useAuth.fetchUserProfile()` (`src/hooks/useAuth.ts:171`) faz `SELECT id, name, email, phone, user_type, active, super_admin, avatar_url, created_at, updated_at FROM settings_users WHERE auth_user_id=$1 AND active=true` e mapeia para o tipo `AuthUser.profile`.

---

## Guards de rota

| Componente | Arquivo | O que verifica | Rotas que protege |
|------------|---------|----------------|-------------------|
| `ProtectedRoute` | `src/components/auth/ProtectedRoute.tsx` | (1) `user` autenticado, redireciona `/login`. (2) `isPasswordRecovery` → `/reset-password`. (3) Usuário em `/login` autenticado → `/bipro`. (4) **MFA guard:** se `user.profile.gestor \|\| user.profile.super_adm` E `settings.require_mfa_for_gestores`, força `/settings/mfa-setup` ou `/settings/mfa-verify` (AAL2). (5) Renderiza UI de "Perfil incompleto" se `user.profile` ausente. | Wrapper de praticamente toda rota autenticada (`/bipro`, `/crm/*`, `/send`, `/schedule`, `/omni`, `/lp`, `/call`, `/settings/*`, `/profile`, `/schedules`, `/followups`, `/coach`, `/brandbook`) |
| `ModuleProtectedRoute` | `src/components/auth/ModuleProtectedRoute.tsx` | Lê `useSystemModules().activeModules`; se `module_key` da prop NÃO está ativo, redireciona para a primeira rota do primeiro módulo ativo (mapa em `redirectMap`). Ignora roles. | Granularidade de módulo — `dashboard`, `conversas`, `negocios`, `clientes`, `agendamentos`, `agentes-ia`, `disparos`, `call`, `lp`, `coach` |
| `RestrictedRoute` | `src/components/auth/RestrictedRoute.tsx` | (1) Espera `user.profile` (timeout 5s → tela de erro). (2) Se `user.profile.isProvisional`, renderiza children mas com banner laranja. (3) Se `requireGestor=true` E NÃO (`profile.gestor \|\| profile.super_adm`), bloqueia com tela "Acesso Restrito". | `/omni/demo` (App.tsx:391), `/schedules` (App.tsx:564) |

### Composição típica observada em `App.tsx`
```tsx
<ProtectedRoute>
  <DashLayout>  {/* monta sidebar + header */}
    <ModuleProtectedRoute moduleKey="conversas">
      <RestrictedRoute requireGestor>
        <ConversasDemo />
      </RestrictedRoute>
    </ModuleProtectedRoute>
  </DashLayout>
</ProtectedRoute>
```

---

## Hook de autenticação

### `useAuth` (`src/hooks/useAuth.ts`)

Centraliza login/logout/session. `useSimpleAuthSingleTenant.ts` é apenas re-export.

**Expõe (`AuthContextType`):**

- `user: AuthUser | null` — `User` do Supabase + campo `profile` opcional
- `session: Session | null`
- `isLoading`, `initError`, `isPasswordRecovery`, `profileRetryExhausted`
- `signIn(email,password)`, `signUp`, `signInWithGoogle`, `signOut`, `resetPassword`
- `refreshProfile`, `refreshSession`, `emergencyReset`
- `currentTenantId` — sempre string `'single-tenant'` (NOTE: hardcoded; não é o UUID real `wotuyxscsfralqpoiyfv`)

**Campos de `user.profile` relevantes:**

```ts
{
  id: string;                                  // settings_users.id (UUID interno)
  auth_user_id: string;                        // settings_users.auth_user_id == auth.users.id
  nome: string;                                // mapeado de settings_users.name
  email: string;
  whatsapp?: string | null;                    // mapeado de settings_users.phone
  avatar_url?: string | null;
  gestor: boolean;                             // DERIVADO: user_type IN ('manager','admin')
  consultor: boolean;                          // DERIVADO: sempre false (legado dead)
  ativo: boolean;                              // mapeado de settings_users.active
  super_adm: boolean;                          // DERIVADO: user_type === 'admin'
  user_type: 'admin' | 'manager' | 'user';     // canônico
  created_at: string; updated_at: string;
  deleted_at?, deleted_by?: string | null;
  isProvisional?: boolean;                     // só presente em fallback profile
}
```

**Pontos de atenção:**
- `gestor`/`super_adm` no profile são **derivados em runtime** a partir de `user_type` (não vêm do banco como boolean). Apesar disso, o banco AINDA tem coluna `super_admin` (que o frontend lê e usa como input para o derive — `useAuth.ts:196`).
- `consultor: false` é hardcoded (`useAuth.ts:194`). É campo morto.
- Fallback profile (`makeFallbackProfile`) sempre cria `user_type:'user'`, `gestor:false`, `super_adm:false`, `isProvisional:true` — usuário virá com permissões mínimas até que o profile real carregue.

### `useUserPermissions` (`src/hooks/useUserPermissions.ts`)

Camada de permissões consumida pelas telas:
- Booleans: `isAdmin`, `isManagerStrict`, `isManager` (= admin OR manager), `isUser`, `isGestor` (alias de `isManager`), `isSuperAdmin` (alias de `isAdmin`), `isConsultor` (sempre false), `isCliente` (sempre false), `isProvisional`
- Identidade: `currentUserId`, `currentUserName`, `roleId`, `isValid`
- Filtros para listagens: `getResponsavelFilter`, `getTeamFilter` (consultor só vê os próprios; manager/admin vê todos)
- Capability flags: `canChangeFilters`, `canBlockSchedule`, `canBlockOwnSchedule`, `canCreateUser`, `canEditUser`, `canDeleteUser`, `canCreateClient`, `canEditClient`, `canDeleteClient`, `canAccessCRM` (true), `canAccessFullProjects` (true), `canAccessSettings` (true)
- **Feature gates granulares** (US-CFG-06, lê `tenant_role_permissions` quando `roleId` presente e usuário NÃO é admin/manager): `canExportCRM`, `canDeleteCRM`, `canViewScore`, `canViewCoach`, `canEditCoach`, `canCreateSends`, `canViewBI`, `canViewSettings`

---

## Permissões por módulo

### Módulos do sistema (`settings_system_modules`)

`ModuleProtectedRoute` apenas verifica `is_active`; **NÃO há restrição de role no nível de módulo**, exceto via composição com `RestrictedRoute requireGestor` em rotas individuais.

Module keys: `dashboard`, `conversas`, `negocios`, `clientes`, `agendamentos`, `agentes-ia`, `disparos`, `call`, `lp`, `coach`.

### Sidebar (`DashLayout.tsx:296-`)

Sidebar dinâmica filtra itens por:
1. `item.requireGestor && !isGestorOrAdmin` → escondido
2. `item.module` ativo em `activeModules`

### Restrições role-based observadas (rotas e telas)

| Local | Restrição |
|-------|-----------|
| `/omni/demo` | `requireGestor` |
| `/schedules` (Horários) | `requireGestor` |
| Settings — `OutrosConfig.tsx:135` | botões/sections só para `super_adm` |
| Settings — `ConfiguracoesShell.tsx:30` | `isSuperAdmin` derivado de `super_adm`; protege seção via `requireGestor` na linha 126 |
| `Reunioes.tsx:125,478` | `isSuperAdmin || isGestor` para selecionar consultor/visualizar todos |
| `useUserPermissions.canManage` | gates de criar/editar/deletar usuário, cliente, scheduler |

### Edge functions com checagem de role

| Função | Checagem |
|--------|----------|
| `admin-unenroll-mfa/index.ts:53` | `callerProfile.user_type === 'admin' \|\| 'manager'` |
| `create-tenant-user/index.ts:111-124` | Lê `settings_users` do caller; permite se `super_admin=true \|\| user_type='admin' \|\| 'manager'` |
| `delete-user/index.ts:50-51` | `currentUser.super_admin === true \|\| user_type === 'admin'` (admin) ou `user_type === 'manager'` (manager) |

### RLS (server-side)

A função canônica é `is_admin_or_manager()` (migration `20260502120000`):
```sql
SELECT EXISTS (
  SELECT 1 FROM public.settings_users
  WHERE auth_user_id = auth.uid()
    AND (super_admin = true OR user_type IN ('admin','manager'))
    AND active = true AND deleted_at IS NULL
)
```
A migration ainda regenera ~40 policies inline que comparavam `user_type = 'gestor'` para usar `user_type = ANY(ARRAY['admin','manager'])`. **A coluna `super_admin` continua sendo verificada como OR** em paralelo ao `user_type` em todas as policies, perpetuando o caminho dual.

---

## Inconsistências / gaps encontrados

1. **Flag legada `super_admin` redundante** — A migration `20260502120000` mantém `super_admin` "por backward compat", mas `user_type='admin'` já é semanticamente equivalente. RLS e edge functions checam **ambos via OR** (`super_admin = true OR user_type IN (...)`), o que é inconsistente: nada impede que um usuário seja persistido como `super_admin=true` com `user_type='user'` (ou vice-versa). O frontend (`useAuth.ts:196`) deriva `super_adm = user_type === 'admin'` ignorando a coluna real do DB. **Fonte de verdade ambígua.**

2. **Campo `consultor` morto no profile** — `AuthUser.profile.consultor` é tipado como `boolean` mas o `useAuth.ts:194` sempre seta `false`, e `useUserPermissions.isConsultor` também é hardcoded `false`. Apenas `DashLayout.tsx:238` ainda lê `user?.profile?.consultor === true`, que nunca será true. Restos do modelo legado pré-refactor.

3. **`requireGestor` checa `profile.gestor || profile.super_adm`, ignorando `user_type`** — `RestrictedRoute.tsx:89` usa as flags derivadas. Isso *funciona* hoje porque o derive em `useAuth.ts` mantém ambas em sync com `user_type`, mas se alguém futuramente adicionar lógica que setasse `gestor` direto, o derive seria sobrescrito. Mais robusto seria checar `user_type` direto.

4. **Cliente/control plane vs tenant** — Campo `is_super_admin` aparece em `useUsers*` (`UsuariosConfig.tsx:61`, `EditarUsuarioModal.tsx:54`, `NegociosToolbar.tsx:141`) ao lado de `super_adm`. Não fica claro se `is_super_admin` representa o super admin do **control plane** (Supabase project externo `/adm`) ou alias do `super_admin` local. Investigar `useUsersNew.ts` (referencia `control plane gateway` — linha 102).

5. **`currentTenantId` hardcoded como `'single-tenant'`** — `useAuth.ts:527`. Mas `logAuthEvent` usa o UUID real `'wotuyxscsfralqpoiyfv'` (linha 32). Rotinas que dependam de `currentTenantId` para queries vão receber a string literal, não o UUID. Vestígio incompleto da refatoração single-tenant.

6. **Tipo `Usuario` em `src/types/usuarios.ts` ainda expõe `tenant_id?: string`** — projeto é declaradamente single-tenant; campo deveria ter sido removido junto com o refactor.

7. **`UsuarioBasico.gestor` (legado) vs canônico `user_type`** — `src/types/usuarios.ts:25` mantém `gestor?: boolean` em interface usada por hooks legacy (`useTimes`, `useAtribuicaoNegocio`). Co-existência de modelos boolean e enum aumenta a chance de drift.

8. **MFA guard em `ProtectedRoute` checa flag derivada (`gestor || super_adm`), não `user_type`** — Tudo bem hoje pelo mesmo motivo do item 3, mas mesmo padrão frágil.

---

## O que os dados sugerem

- O modelo de role já está **consolidado em `user_type`** server-side (constraint + função `is_admin_or_manager` + ~40 RLS atualizadas).
- A camada client ainda **espalha aliases derivados** (`gestor`, `super_adm`, `consultor`) em vários hooks/componentes que poderiam ler `user_type` direto.
- A próxima etapa natural seria **remover `super_admin` da tabela** (ou marcá-la como deprecated em todos os reads) para fechar o loop, e auditar os usos de `is_super_admin` para distinguir control-plane vs tenant-admin.

---

## Limitações

- Não foi possível inspecionar o esquema do projeto control-plane (`/adm`) — apenas referências externas do SPA.
- Não foi feita análise de edge functions além de `auth-login`, `admin-unenroll-mfa`, `create-tenant-user`, `delete-user` (existem ~40 functions; outras podem ter checagens próprias).
- O campo `role_id` em `settings_users` foi visto na migration mas não foi inspecionado quem o atribui (UI de gerenciamento de roles).

## Fontes

- `src/hooks/useAuth.ts` (lógica auth + tipos)
- `src/hooks/useUserPermissions.ts` (camada de permissões)
- `src/hooks/usePermissions.ts` (FeatureKey + tenant_roles queries)
- `src/hooks/useSystemModules.ts` (módulos)
- `src/components/auth/ProtectedRoute.tsx`, `ModuleProtectedRoute.tsx`, `RestrictedRoute.tsx`
- `src/components/auth/AuthProvider.tsx` (`SimpleAuthProvider` re-export)
- `src/components/layout/DashLayout.tsx` (sidebar dinâmica)
- `src/types/usuarios.ts`
- `src/App.tsx` (composição de rotas)
- `supabase/migrations/20260502120000_user_types_canonical_refactor.sql`
- `supabase/migrations/20260423009000_tenant_role_permissions.sql`
- `supabase/migrations/20260426003000_settings_bi_voice_beta_role_guard.sql`
- `supabase/functions/admin-unenroll-mfa/index.ts`
- `supabase/functions/create-tenant-user/index.ts`
- `supabase/functions/delete-user/index.ts`
