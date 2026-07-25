---
title: Auditoria de Schema — Tipos de Usuário e RLS
type: audit
agent: dev-data-engineer
team: joao-guirunas-validate-user-types
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
tags: [database, schema, rls, audit, user-types, authorization]
related: ["[[schema]]", "[[migrations-log]]"]
---

# Auditoria de Schema — Tipos de Usuário (João Guirunas)

> Source-of-truth: `supabase/baseline.sql` + `supabase/migrations/` (816 arquivos no disco / 212 entries em `client-migrations.json`) + `src/integrations/supabase/types.ts` (gerado).
> Tenant ativo: `wotuyxscsfralqpoiyfv` (single-tenant desde 2026-05-01).
> Última migration canônica de tipos: `20260502120000_user_types_canonical_refactor.sql` (order_index 10200).

---

## TL;DR

João Guirunas possui **dois sistemas paralelos de role**:
1. **Vivo / canônico** — `settings_users.user_type ∈ {admin, manager, user}` + `super_admin` (boolean), com função `is_admin_or_manager()` e ~40 RLS policies que checam isso.
2. **Morto / não-usado** — `user_roles` table + `app_role` enum {admin, manager, user} + `has_role()` function (criados em 2025-11-13 mas **nunca consumidos** por edge functions ou frontend).

Há também um terceiro sistema **parcial** (granular) — `tenant_roles` + `tenant_role_permissions` + `feature_key` enum — criado em 2026-04-23 mas sem código frontend que o consuma. `settings_users.role_id` foi adicionado mas é null em todos os registros.

**Veredicto:** schema convergiu corretamente em `settings_users.user_type`, mas há débito de limpeza significativo (3 sistemas concorrentes) e ao menos 1 inconsistência (edge function lê coluna inexistente).

---

## Tabelas relacionadas a usuário (estado vivo)

| Tabela | Campos relevantes | FK para auth.users | RLS habilitado |
|---|---|---|---|
| `settings_users` | `id`, `auth_user_id`, `name`, `email`, `phone`, `super_admin` (bool), `user_type` (text, CHECK ∈ {admin,manager,user}), `active`, `avatar_url`, `deleted_at` | `auth_user_id` → `auth.users(id)` (nullable) | sim — policies `authenticated_read`/`authenticated_write` USING (true) (FWUP-17) |
| `settings_users_teams` | `id`, `user_id`, `team_id`, `is_leader` | `user_id` → `settings_users(id)` (não auth.users) | sim — `authenticated_*` USING (true) (FWUP-17) |
| `settings_teams` | `id`, `name`, `description`, `team_type`, `priority`, `active` | — | sim — `authenticated_*` USING (true) |
| `user_roles` (legacy/dead) | `id`, `user_id`, `role` (enum app_role) | `user_id` → `auth.users(id)` ON DELETE CASCADE | sim — policies próprias (`Users can read own roles`, `Admins can manage all roles` via `has_role()`) |
| `tenant_roles` (granular, parcial) | `id`, `tenant_id`, `name`, `description`, `is_system` | — (tenant_id orphan, sem FK) | sim — policies tenant_roles_read/write checam jwt.app_metadata.tenant_id + settings_users.user_type |
| `tenant_role_permissions` (granular, parcial) | `role_id`, `feature_key` (enum), `enabled` | `role_id` → `tenant_roles(id)` | sim |
| `auth.users` (Supabase nativo) | `id`, `email`, `app_metadata` (jsonb com tenant_id), `user_metadata` | n/a | gerenciada pelo Supabase Auth |

**Tabelas mortas/legadas que NÃO existem mais no schema vivo (segundo `types.ts`):**
- `crm_usuarios` — schema multi-tenant antigo, removido na migração single-tenant
- `crm_agencias`, `crm_agencia_tenants`, `crm_agencia_usuarios` — modelo de agências (multi-tenant)
- `crm_tenants` — também removido
- `users`, `users_teams` (sem prefixo `settings_`) — apareciam no baseline antigo, hoje substituídos

**Coluna fantasma:**
- `settings_users.tenant_id` — NÃO existe em `types.ts`, mas é selecionada pela edge function `admin-unenroll-mfa/index.ts:48`. Resulta em coluna `null` (silent fail) ou erro no PostgREST. **GAP-1.**
- `settings_users.role_id` — adicionada via migration `20260423009000_tenant_role_permissions` (order 143), mas NÃO aparece em `types.ts`. Provavelmente nunca regenerado após apply, OU coluna não foi propagada para o tenant João Guirunas.

---

## Enums / tipos de role

| Tipo | Valores | Onde é usado | Status |
|---|---|---|---|
| `public.app_role` | `admin`, `manager`, `user` | `user_roles` table only | **MORTO** — tabela não consumida |
| `public.feature_key` | `crm_export`, `crm_delete`, `score_view`, `coach_view`, `coach_edit`, `sends_create`, `bi_view`, `settings_view` | `tenant_role_permissions.feature_key` | **PARCIAL** — granular RBAC ainda não cabeado no frontend |
| `public.tipo_usuario` (legacy) | `admin_global`, `admin_cliente`, `usuario_cliente` (e versão antiga `gestor`/`atendente`) | nenhuma tabela viva | **MORTO** — herança multi-tenant |
| `public.permissao_usuario` (legacy) | `admin`, `leitura`, `suporte` | nenhuma tabela viva | **MORTO** |
| `public.tipo_time` | `vendas`, `suporte`, `marketing`, `financeiro` | settings_teams.team_type? (text, sem ENUM constraint visível) | indeterminado |

**CHECK constraint canônica em `settings_users.user_type`:**
```sql
CHECK (user_type = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text]))
```
DEFAULT: `'user'`. Aplicado em `20260502120000_user_types_canonical_refactor.sql`.

---

## Função autoritativa de role

```sql
public.is_admin_or_manager() RETURNS boolean
  STABLE SECURITY DEFINER, search_path=public
  WHERE auth_user_id = auth.uid()
    AND (super_admin = true OR user_type IN ('admin', 'manager'))
    AND active = true
    AND deleted_at IS NULL
```

Esta é a fonte de verdade para verificações via RLS. Em `types.ts: 6619`.

A função `has_role(user_id, app_role)` também existe, mas é consumida apenas pela RLS de `user_roles` (que é dead).

---

## Políticas RLS (resumo dos pontos sensíveis)

### `settings_users`
| Policy | Comando | USING | Origem |
|---|---|---|---|
| `authenticated_read` | SELECT | `true` | FWUP-17 (20260428060000) |
| `authenticated_write` | ALL | `true` WITH CHECK `true` | FWUP-17 |

**GAP-2 (CRÍTICO):** `settings_users` está **completamente aberto a qualquer usuário autenticado** — qualquer user logado pode `SELECT *`, `UPDATE`, `INSERT`, `DELETE` qualquer linha. As policies restritivas `Users can read own profile` / `Admins can create users` (de `20251113165027`) foram DROPADAS pela migration FWUP-17 porque a baseline propagada quebrava em tenants novos. **Autorização real é feita apenas no edge function layer** (super_admin/user_type checks em TS), não em RLS. Para single-tenant João Guirunas é menos grave (só usuários do tenant), mas viola defense-in-depth.

### `user_roles` (legacy)
| Policy | USING |
|---|---|
| `Users can read own roles` | `user_id = auth.uid()` |
| `Admins can manage all roles` | `has_role(auth.uid(), 'admin')` |

Restritivas mas irrelevantes (tabela vazia/não-usada).

### `tenant_roles` / `tenant_role_permissions`
- USING combina `tenant_id = jwt.app_metadata.tenant_id::uuid` + `settings_users.user_type IN ('admin','manager') OR super_admin = true` (após canonical refactor reescrever `'gestor'` → `IN('admin','manager')`).
- **Risco:** se `app_metadata.tenant_id` não estiver populado no JWT, o predicate retorna NULL → Postgres trata como false → tudo bloqueado. Confirmar no auth-login que `tenant_id` é injetado em `app_metadata` via hook ou `update_user_app_metadata`.

### Padrão geral pós-refactor (após 20260502120000)
~40 policies em outras tabelas (CRM, sends, etc.) foram reescritas de:
```sql
USING (... user_type = 'gestor' ...)
```
para:
```sql
USING (... user_type = ANY (ARRAY['admin','manager']) ...)
```
A reescrita aconteceu via DO block iterando `pg_policies`. **Risco residual:** se houver policies que usam `'gestor'` em formatação não-exata (ex: outra string com aspas duplas, ou `user_type ILIKE 'gestor'`), o REPLACE não pegou. Vale uma query auditiva: `SELECT * FROM pg_policies WHERE qual ILIKE '%gestor%' OR with_check ILIKE '%gestor%'`.

---

## Edge functions com lógica de autorização

Todas leem **`settings_users`** (não `user_roles`, não `tenant_role_permissions`) e checam `super_admin === true || user_type === 'admin'` para admin, `user_type === 'manager'` para manager.

| Função | Linha | Pattern |
|---|---|---|
| `delete-user/index.ts` | 41,50,51 | `select('id, super_admin, user_type')` + checks |
| `create-tenant-user/index.ts` | 111,123,124,170 | mesmo pattern; insere `user_type` e `super_admin` |
| `create-global-user/index.ts` | 31,75,87,88,216 | tem schema Zod `z.enum(['admin','manager','user'])` ✅ |
| `update-user-password/index.ts` | 103,131,132 | mesmo pattern |
| `update-user-email/index.ts` | 91,121,122 | mesmo pattern |
| `score-re-evaluate/index.ts` | 67,71,72 | mesmo pattern |
| `filter-leads-for-send/index.ts` | 95,99,100 | mesmo pattern |
| `bi-sync-meta-ads/index.ts` | 100,105,106 | mesmo pattern |
| `bi-sync-google-ads/index.ts` | 132,137,138 | mesmo pattern |
| `admin-unenroll-mfa/index.ts` | 48,53,54 | **GAP-1** — `select('id, user_type, tenant_id')` mas `tenant_id` não existe em settings_users |

Edge functions que usam `app_metadata.tenant_id` (apenas para isolamento, não para role):
- `data-export-request/index.ts:32`
- `public-booking/index.ts:108-119`
- `gemini-live-token/index.ts:51-53`
- `gemini-ws-proxy/index.ts:34`

Nenhuma edge function consome `user_roles`, `has_role()`, `tenant_role_permissions`, ou `feature_key`.

---

## Frontend (consumo de tipos)

`src/hooks/useAuth.ts:171-218` — fetcha `settings_users` selecionando `id, name, email, phone, user_type, active, super_admin, avatar_url, ...`.

Mapping para `profile`:
- `gestor: user_type === 'manager' || user_type === 'admin'`
- `super_adm: user_type === 'admin'` ⚠️ (não usa `super_admin` boolean — depende só de `user_type`)
- `user_type: as 'admin' | 'manager' | 'user'`

**GAP-3:** `super_adm` no profile do frontend ignora a coluna `super_admin` (boolean) — derivado só de `user_type === 'admin'`. Se no DB existir um row com `super_admin = true` e `user_type = 'user'` (estado inconsistente possível antes do canonical refactor), o frontend trataria como NÃO super-admin enquanto edge functions o tratariam como SIM. Após canonical refactor, o backfill garantiu `super_admin = true → user_type = 'admin'`, mas writes futuros não têm trigger garantindo invariante.

Outros componentes usam `user_type` consistentemente:
- `src/components/modals/EditarUsuarioModal.tsx:52`
- `src/components/config/UsuariosConfig.tsx:58,89,90,103`
- `src/hooks/useAtribuicaoNegocio.ts:60,71,78`
- `src/hooks/useUsersTeams.ts:15,27`
- `src/pages/Perfil.tsx:291`

Referências a `usuario.is_super_admin` e `usuario.super_adm` (sem underscore intermediário) em `UsuariosConfig.tsx:74,103` apontam para campos **inexistentes** em `settings_users` — fallback morto, sempre `undefined`. **GAP-4** (pequeno, mas indica débito).

---

## Inconsistências / gaps consolidados

| # | Severidade | Gap | Impacto |
|---|---|---|---|
| **GAP-1** | médio | `admin-unenroll-mfa` seleciona `tenant_id` em `settings_users`, coluna não existe nos tipos | PostgREST retorna erro ou null silencioso; função pode autorizar/negar com base em campo undefined |
| **GAP-2** | crítico | RLS em `settings_users` é `USING (true)` para todos autenticados — sem defense-in-depth; toda autorização vive em edge functions | Bug em uma edge function ou query direta autenticada do client expõe/permite alterar dados de qualquer usuário |
| **GAP-3** | médio | Frontend deriva `super_adm` apenas de `user_type === 'admin'`, ignora coluna `super_admin` boolean | Drift possível se DB tiver `super_admin=true && user_type≠'admin'` (canonical refactor backfill cobriu retroativamente, mas sem trigger preventivo) |
| **GAP-4** | baixo | `UsuariosConfig.tsx` referencia `usuario.is_super_admin` e `usuario.super_adm` (campos inexistentes) | Sempre undefined → fallback false; código morto |
| **GAP-5** | médio | `user_roles` table + enum `app_role` + função `has_role()` existem mas são código morto | Confusão para novos devs; risco de alguém ressuscitar acidentalmente o segundo sistema |
| **GAP-6** | médio | `tenant_roles` + `tenant_role_permissions` + `feature_key` enum existem mas sem consumidor (frontend ou edge function); `settings_users.role_id` ausente em `types.ts` | RBAC granular projetado mas não cabeado; tipos desatualizados sugerem coluna não foi aplicada ao tenant João Guirunas OU types não foi regenerado |
| **GAP-7** | baixo | Possíveis policies sobreviventes com `user_type = 'gestor'` em formatação não-exata (ILIKE, aspas duplas, etc.) escaparam do REPLACE do canonical refactor | Verificável via `SELECT * FROM pg_policies WHERE qual ILIKE '%gestor%'` |
| **GAP-8** | baixo | RLS de `tenant_roles` requer `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` populado | Se `app_metadata.tenant_id` faltar no JWT (race no signup, hook quebrado), todo acesso a granular RBAC fica bloqueado |

---

## Recomendações (ordem de prioridade)

1. **GAP-2** — restaurar policies restritivas em `settings_users` baseadas em `is_admin_or_manager()` para writes; manter SELECT aberto se necessário pra UX. Defense-in-depth.
2. **GAP-1** — corrigir `admin-unenroll-mfa/index.ts:48` removendo `tenant_id` do SELECT (single-tenant não precisa).
3. **GAP-5/6** — decisão arquitetural: ou ressuscitar `user_roles`/`tenant_roles` (com plano de migração) ou DROPAR. Documentar em ADR.
4. **GAP-7** — query auditiva em `pg_policies` por `'gestor'`/`gerente`/`atendente`/`consultor` survivors.
5. **GAP-3** — adicionar trigger BEFORE INSERT/UPDATE em `settings_users` garantindo invariante `super_admin = true ↔ user_type = 'admin'`.
6. **GAP-4** — limpar referências mortas em `UsuariosConfig.tsx`.
7. Regenerar `src/integrations/supabase/types.ts` para refletir `role_id` (se aplicado) e demais drifts.

---

## Estatísticas

- **2 tabelas vivas** de usuário (`settings_users`, `settings_users_teams`)
- **2 tabelas mortas** (`user_roles`, `tenant_roles` — esta última só com schema, sem dados)
- **3 enums de role** (`app_role` morto, `feature_key` parcial, `user_type` ativo via CHECK constraint não-enum)
- **6 RLS policies** notáveis em `settings_users` (mas as 4 restritivas foram DROPADAS por FWUP-17)
- **10 edge functions** verificam role
- **8 gaps identificados** (1 crítico, 4 médios, 3 baixos)
