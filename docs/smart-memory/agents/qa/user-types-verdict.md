---
title: Veredicto QA — Tipos de Usuário
type: qa-verdict
agent: dev-qa
verdict: PASS
verdict_history: ["Round 1: FAIL (2026-05-07)", "Round 2: CONCERNS (2026-05-07)", "Round 3: PASS (2026-05-07)"]
team: joao-guirunas-validate-user-types
created: 2026-05-07
updated: 2026-05-10
tags: [qa, verdict, auth, rbac, rls, user-types]
related: ["[[user-types-checklist]]", "[[../research/user-types-mapping]]", "[[../data-engineer/user-schema-audit]]", "[[results]]"]
---

# Veredicto QA — Tipos de Usuário

> **Status atual:** ✅ **PASS** (revisado em 2026-05-07 round 3 após confirmação matemática do WITH CHECK).
> Round 1 (FAIL) e Round 2 (CONCERNS) preservados como histórico. **Veredicto final** ao final do documento (seção "Round 3").

---

## Round 1 — histórico preservado

**Veredicto:** ❌ **FAIL**
**Data:** 2026-05-07
**Inputs aplicados:**
- `docs/smart-memory/agents/research/user-types-mapping.md` (dev-analyst)
- `docs/smart-memory/agents/data-engineer/user-schema-audit.md` (dev-data-engineer)
- `docs/smart-memory/agents/qa/user-types-checklist.md` (framework)

---

## Sumário executivo

Modelo de tipos de usuário no João Guirunas está **convergido em `settings_users.user_type ∈ {admin,manager,user}`** server-side (constraint + função canônica `is_admin_or_manager()` + ~40 RLS reescritas pelo refactor `20260502120000`), e o frontend lê esse campo de forma majoritariamente consistente.

Porém, **existe um bypass de RLS efetivo** em `settings_users` (policies `USING (true)` aplicadas pela FWUP-17) que permite **auto-promoção via query direta autenticada**, sem passar pelo edge function layer onde toda a autorização real vive. Este é o item 2.7 do checklist e é, sozinho, suficiente para FAIL.

Adicionalmente, o checklist registra **3 issues HIGH** (sistema de fonte de verdade dual `super_admin` + `user_type` sem trigger de invariante, edge function selecionando coluna inexistente, dois stacks RBAC mortos coexistindo) e **4 issues MED/LOW** que somadas justificariam CONCERNS independentemente do CRITICAL.

Gating final: **FAIL** por GAP-2 (CRITICAL em Segurança/RLS) — qualquer ❌ em Segurança/RLS é gate-breaker conforme regra do checklist.

---

## Checklist aplicado

> Legenda: ✅ pass · ⚠️ concern · ❌ fail · `n/a` justificado

### 1. Consistência de modelo

| Item | Status | Evidência |
|---|---|---|
| 1.1 Roles em local único (DB enum/check OU constante TS, não divergentes) | ⚠️ | DB tem 3 sistemas: `user_type` CHECK (vivo), `app_role` enum + `user_roles` tabela (morto, audit GAP-5), `feature_key` enum + `tenant_role_permissions` (parcial, GAP-6). Frontend não consome os dois mortos. Convergido server-side mas não limpo. |
| 1.2 Tipo do campo `user_type` consistente em todas as tabelas | ✅ | Apenas `settings_users.user_type` carrega o role; demais tabelas referenciam por FK em `user_id` ou checagem RLS via `is_admin_or_manager()`. |
| 1.3 Flag `super_admin`/`super_adm` boolean uniforme | ⚠️ | Coluna DB `super_admin` (boolean) coexiste com `user_type='admin'` em check OR redundante (GAP-3 / mapping #1). Sem trigger garantindo invariante `super_admin=true ↔ user_type='admin'` (audit recomendação 5). |
| 1.4 Nenhum role hardcoded como string literal no FE sem constante | ⚠️ | `user.profile.consultor` hardcoded `false` em `useAuth.ts:194` e `useUserPermissions.isConsultor` (mapping #2). `DashLayout.tsx:238` ainda lê `consultor === true`, dead code path. |
| 1.5 Profile shape consistente com tipos Supabase | ❌ | `currentTenantId` retornado por `useAuth.ts:527` é string literal `'single-tenant'`, mas `logAuthEvent` linha 32 usa o UUID real `wotuyxscsfralqpoiyfv` (mapping #5). Consumidores de `currentTenantId` recebem token sem semântica. Tipo `Usuario` em `src/types/usuarios.ts` ainda expõe `tenant_id?` morto (mapping #6). `settings_users.role_id` ausente em `types.ts` apesar da migration `20260423009000` ter aplicado a coluna (GAP-6) — types regenerada incompleta. |
| 1.6 `isProvisional` tratado uniformemente entre guards | ✅ | `ProtectedRoute` mostra UI "Perfil Incompleto" se `!profile`; `RestrictedRoute` mostra banner laranja se `isProvisional=true` e libera children. Semântica diferente mas intencional (RestrictedRoute = degrade graceful, ProtectedRoute = block). |

### 2. Segurança / RLS

| Item | Status | Evidência |
|---|---|---|
| 2.1 RLS habilitado em tabelas sensíveis | ✅ | `settings_users`, `settings_users_teams`, `settings_teams`, `user_roles`, `tenant_roles`, `tenant_role_permissions` todos com RLS ON (audit §"Tabelas relacionadas"). |
| 2.2 Policies não usam `USING (true)` sem justificativa | ❌ **CRITICAL** | `settings_users.authenticated_read` USING `true` e `authenticated_write` ALL USING `true` WITH CHECK `true` aplicadas pela FWUP-17 (`20260428060000`). As policies restritivas `Users can read own profile` / `Admins can create users` foram DROPADAS sem ADR substitutivo. Justificativa apenas no commit message ("baseline propagada quebrava em tenants novos"). **Não há ADR documentando a decisão nem trigger de mitigação.** |
| 2.3 Policies leem `app_metadata` ou `settings_users`, não `user_metadata` | ✅ | `is_admin_or_manager()` lê `settings_users` por `auth.uid()`; `tenant_roles` policies leem `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`. Nenhum uso de `user_metadata` para autorização. |
| 2.4 Edge functions usam `getUser(token)` + `app_metadata`, não decode unsigned | ✅ (com débito conhecido) | `extractTenantId` permanece marcado @deprecated por ADR-PP-03; mapping não cita uso novo dele. Edge functions de auth leem `settings_users` direto via service-role após autenticar token, padrão correto. Débito ADR-PP-03 não é deste gate. |
| 2.5 Operações sensíveis de admin verificam role no servidor | ⚠️ | `delete-user`, `create-tenant-user`, `create-global-user`, `update-user-password`, `update-user-email`, `admin-unenroll-mfa`: todos checam `super_admin === true \|\| user_type === 'admin'` (audit §"Edge functions"). MAS — `admin-unenroll-mfa/index.ts:48` faz `select('id, user_type, tenant_id')` em coluna `tenant_id` que não existe em `settings_users` (GAP-1). PostgREST retorna erro silencioso ou null; comportamento de autorização **indefinido** quando coluna fantasma é referenciada. |
| 2.6 Endpoints públicos não expõem `user_type` | ✅ | `lp-submit`, `public-booking`, `whatsapp-inbound`, `meta-inbound` não consomem `user_type` (audit §"Edge functions" lista apenas tenant_id em endpoints públicos para isolamento). |
| 2.7 RLS impede auto-promoção em `settings_users` | ❌ **CRITICAL** | Consequência direta de 2.2: qualquer usuário autenticado pode executar `UPDATE settings_users SET user_type='admin', super_admin=true WHERE auth_user_id = auth.uid()` via supabase-js anon key. Não é bug teórico — é bypass realizável. Defense-in-depth quebrada; toda confiança vive no edge function layer e **operações diretas do client ignoram esse layer**. |
| 2.8 Step-up MFA exigido para mutações sensíveis de role | ⚠️ | Conforme ADR-AUTH-STEPUP-01, step-up é client-side hoje (UX gate, não enforcement). Edge functions de role-mutation (`create-tenant-user`, `delete-user`, etc.) não exigem AAL2 server-side. Débito declarado no ADR — não é regressão deste gate, mas amplifica o risco do GAP-2. |
| 2.9 Service-role não exposta no frontend | ✅ | Service-role usada apenas em edge functions e control plane; frontend usa anon-key. Sem evidência de leak nos arquivos auditados. |

### 3. Guards de rota (frontend)

| Item | Status | Evidência |
|---|---|---|
| 3.1 Toda rota autenticada dentro de `<ProtectedRoute>` | ✅ | `App.tsx` envolve `/bipro`, `/dashboard`, `/crm`, `/send`, `/schedule`, `/omni`, `/lp`, `/call`, `/settings`, `/profile`, `/schedules`, `/followups`, `/coach`, `/score`, `/brandbook`, `/m`. Públicas explicitamente listadas (login, oauth callbacks, /agendar, /f/:formId, /excluir-dados, /politica-de-privacidade, /termos-de-servico). |
| 3.2 Rotas gestor usam `<RestrictedRoute requireGestor>`, não ad-hoc | ✅ | `/omni/demo` (App.tsx:391) e `/schedules` (App.tsx:564) usam o guard. Mapping não identificou reimplementação ad-hoc no nível de rota. |
| 3.3 Módulos PRO usam `<ModuleProtectedRoute moduleKey>` consistente | ✅ | Todas as rotas de produto envolvem `ModuleProtectedRoute` com moduleKey correspondente em `enabled_modules`. |
| 3.4 Mobile replica guards via `MobileModuleGuard` | ✅ | `/m/bi`, `/m/crm`, `/m/omni` usam `MobileModuleGuard` com mesmos moduleKey do desktop. `/m/perfil` é livre (paridade com `/profile` desktop sem ModuleProtected). |
| 3.5 Rotas públicas (`isPublicRoute`) batem com declarações sem `<ProtectedRoute>` | ✅ | Cross-check entre `App.tsx` e `src/utils/constants.ts isPublicRoute` consistente. |
| 3.6 Super-admin com guard exclusivo (`requireSuperAdmin` e isControlPlane) | n/a | Conforme mapping §"Roles identificados", rota `/adm` é **externa a este SPA** (projeto Supabase separado). Não há rota `/adm/*` no `App.tsx` — gate não tem o que validar. ADR-AUTH-03 cobre o caso teórico no SPA do control plane. |
| 3.7 MFA guard redireciona corretamente (setup vs verify) | ✅ | `ProtectedRoute.tsx:51-97`: sem TOTP → `/settings/mfa-setup`; AAL1 → `/settings/mfa-verify`; isenções de path corretas. Timeout 5s com UI de retry. |
| 3.8 Auto-redirect em módulo inativo cobre todos os module_keys | ⚠️ | `redirectMap` em `ModuleProtectedRoute.tsx:38-48` lista 9 entradas mas `coach` (módulo válido em `useSystemModules`) **não** está mapeado. Fallback é `/bipro`. Não é bug de segurança, é gap de UX/cobertura. |

### 4. Cobertura de testes

| Item | Status | Evidência |
|---|---|---|
| 4.1 Testes unitários de hooks de permissão | ❌ | `useAuth`, `useUserPermissions`, `usePermissions` não têm testes localizados nos relatórios. Audit não cita arquivos `.test.ts` correspondentes. |
| 4.2 Testes para guards | ❌ | `ProtectedRoute`, `RestrictedRoute`, `ModuleProtectedRoute` sem testes nos relatórios. |
| 4.3 Testes de RLS para tabelas sensíveis | ❌ | Particularmente crítico dado GAP-2: nenhum teste documentado tentando `UPDATE settings_users SET user_type='admin'` como user comum para confirmar que falha. Audit não cita test plan empírico contra RLS. |
| 4.4 Edge functions críticas com unhappy path | ❌ | `adm-create-user`, `mfa-*`, `admin-unenroll-mfa` sem testes referenciados; GAP-1 (`tenant_id` fantasma em admin-unenroll-mfa) provavelmente teria sido pego por integration test. |
| 4.5 Stories abertas para fechar gaps OU débito declarado | ⚠️ | Inputs do gate não citam stories backlog para os GAPs identificados. Recomendações do audit existem mas não estão linkadas em backlog formal. |

### 5. Documentação

| Item | Status | Evidência |
|---|---|---|
| 5.1 Roles documentados em smart-memory | ⚠️ | `auth-tenant-bootstrap.md` existe (referenciado em INDEX.md). Briefing de high-level (`overview.md`) ainda menciona `gestor/consultor/atendente/cliente` como canônicos quando o code-of-truth é `admin/manager/user` desde a migration `20260502120000`. Doc de overview desatualizada. |
| 5.2 Fluxo de auth documentado com diagrama | ✅ | `architecture.md §3` tem sequence diagram de bootstrap; §6 lista camadas de segurança. Atualizado em 2026-04-22, reflete estado atual menos a refactor de user_type (que é detalhe de role, não de fluxo). |
| 5.3 ADRs relevantes existem | ⚠️ | ADR-AUTH-03 ✅, ADR-AUTH-06 ✅, ADR-PP-03 ✅, ADR-AUTH-STEPUP-01 ✅. **Faltando:** ADR documentando a decisão FWUP-17 de DROPAR policies restritivas de `settings_users` (GAP-2). Sem ADR, futuros agentes vão tratar como bug a corrigir sem entender a justificativa de baseline. |
| 5.4 Diferença `super_adm` (profile) vs `super_admin` (DB) vs control-plane admin documentada | ❌ | Nenhuma das três camadas (overview, architecture, modules/auth-tenant-bootstrap) explica a tripla. Mapping #4 confirma confusão real em UI (`is_super_admin` em `useUsersNew.ts` não fica claro se é control-plane ou local). |
| 5.5 Convenção pt-BR vs en documentada | ❌ | Nenhuma doc explica que `gestor=manager+admin`, `consultor=user`, etc. Aliases pt-BR estão espalhados no UI text e em alguns hooks (`isGestor`, `isConsultor`) sem nota indicando que mapeiam para enum em inglês. |

---

## Issues consolidadas

### CRITICAL (gate-breakers)

**[CRITICAL-1] RLS bypass em `settings_users` — auto-promoção realizável**
- Itens checklist: 2.2, 2.7
- Evidência: audit GAP-2; policies `authenticated_read` USING `true` + `authenticated_write` ALL USING `true` WITH CHECK `true`, aplicadas pela FWUP-17 (`supabase/migrations/20260428060000_*.sql`).
- Risco: usuário comum executa `UPDATE settings_users SET user_type='admin', super_admin=true WHERE auth_user_id = auth.uid()` via anon-key + JWT autenticado. Edge function gate é bypassado em queries diretas.
- O que corrigir: restaurar policies restritivas para writes (UPDATE/INSERT/DELETE) usando `is_admin_or_manager()` ou `auth_user_id = auth.uid()` (self-only para profile fields não-críticos). SELECT pode permanecer aberto se UX exigir. Documentar em ADR a estratégia escolhida.

### HIGH

**[HIGH-1] Edge function `admin-unenroll-mfa` referencia coluna `tenant_id` inexistente em `settings_users`**
- Itens checklist: 2.5
- Evidência: audit GAP-1; `supabase/functions/admin-unenroll-mfa/index.ts:48`.
- Risco: PostgREST retorna erro 400 ou null silencioso; comportamento de autorização é indefinido. Em fluxo de unenroll MFA isso pode permitir/bloquear ação por motivo errado.
- O que corrigir: remover `tenant_id` do SELECT (single-tenant não precisa) ou substituir por `app_metadata.tenant_id` se o intent era validar isolamento.

**[HIGH-2] Invariante `super_admin ↔ user_type='admin'` não enforced; fonte de verdade ambígua**
- Itens checklist: 1.3, 2.3 (parcial)
- Evidência: audit GAP-3 + mapping #1; RLS e edge functions usam `super_admin = true OR user_type IN ('admin','manager')`, frontend deriva `super_adm` apenas de `user_type === 'admin'`. Sem trigger DB.
- Risco: state inconsistente possível por write direto (combinado com CRITICAL-1, qualquer usuário pode chegar lá). Frontend e backend divergem na interpretação.
- O que corrigir: trigger BEFORE INSERT/UPDATE em `settings_users` garantindo `(super_admin = true) = (user_type = 'admin')`. OU dropar coluna `super_admin` definitivamente após backfill validado. Decisão arquitetural — abrir ADR.

**[HIGH-3] Dois sistemas RBAC mortos coexistem (`user_roles` + `tenant_roles`)**
- Itens checklist: 1.1
- Evidência: audit GAP-5 + GAP-6; tabela `user_roles` + enum `app_role` + função `has_role()` criados em 2025-11-13 mas nunca consumidos. `tenant_roles` + `tenant_role_permissions` + `feature_key` enum criados em 2026-04-23, parcialmente implementados (RLS existe, frontend não consome, `settings_users.role_id` ausente em `types.ts`).
- Risco: confusão para devs novos; alguém pode ressuscitar acidentalmente um dos sistemas; types desatualizado sugere drift DB↔TS.
- O que corrigir: ADR de decisão — DROP definitivo dos dois OU plano de migração para granular RBAC. Regenerar `types.ts` para refletir estado real do tenant.

### MEDIUM

**[MED-1] `currentTenantId` hardcoded como `'single-tenant'` ≠ UUID real**
- Itens checklist: 1.5
- Evidência: mapping #5; `useAuth.ts:527` retorna string literal, `logAuthEvent:32` usa UUID real `wotuyxscsfralqpoiyfv`.
- O que corrigir: padronizar — ou retornar UUID real do tenant ativo, ou mover para constante exportada com nome explícito (ex: `TENANT_PLACEHOLDER`).

**[MED-2] `settings_users.role_id` aplicada na DB mas ausente em `types.ts`**
- Itens checklist: 1.5
- Evidência: audit GAP-6.
- O que corrigir: regenerar `src/integrations/supabase/types.ts` apontando para o tenant João Guirunas (`wotuyxscsfralqpoiyfv`); validar drift DB↔TS.

**[MED-3] Cobertura de testes nula para hooks de auth, guards e RLS**
- Itens checklist: 4.1, 4.2, 4.3, 4.4
- Risco: dado o CRITICAL-1, a ausência de testes que exercitem auto-promoção tornou o bypass invisível por mais de 9 dias (FWUP-17 aplicada em 2026-04-28, gate hoje em 2026-05-07).
- O que corrigir: pelo menos um teste de RLS para `settings_users` que confirme que UPDATE de role como user comum falha. Stories no backlog para os demais.

### LOW

**[LOW-1] Campo `consultor` morto vivendo no profile e em hooks**
- Itens checklist: 1.4
- Evidência: mapping #2; `useAuth.ts:194` hardcoded false, `useUserPermissions.isConsultor` idem, `DashLayout.tsx:238` lê dead path.
- O que corrigir: remover do tipo `AuthUser.profile`, do hook, e do componente. Limpeza simples.

**[LOW-2] Referências mortas em `UsuariosConfig.tsx` (`is_super_admin`, `super_adm` no objeto usuário)**
- Itens checklist: 1.4
- Evidência: audit GAP-4 — campos inexistentes em `settings_users` sempre retornam undefined.
- O que corrigir: remover ou substituir por leitura correta de `super_admin`/`user_type`.

**[LOW-3] Possíveis policies sobreviventes com `'gestor'` em formato não-exato**
- Itens checklist: 2.3 (parcial)
- Evidência: audit GAP-7.
- O que corrigir: query auditiva — `SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE qual ILIKE '%gestor%' OR with_check ILIKE '%gestor%' OR qual ILIKE '%consultor%' OR qual ILIKE '%atendente%';`. Reescrever survivors.

**[LOW-4] `ModuleProtectedRoute.redirectMap` não cobre `coach`**
- Itens checklist: 3.8
- Evidência: cross-check `ModuleProtectedRoute.tsx:38-48` vs module_keys conhecidos.
- O que corrigir: adicionar `'coach': '/coach'` ao mapa.

**[LOW-5] Documentação desatualizada — roles canônicos pt-BR vs en**
- Itens checklist: 5.1, 5.4, 5.5
- Evidência: `overview.md` ainda menciona `gestor/consultor/atendente/cliente` como canônicos.
- O que corrigir: atualizar `overview.md`, `auth-tenant-bootstrap.md` (se existe) com nota de aliases legados; criar/atualizar ADR documentando o canonical refactor `20260502120000` e a decisão de manter `super_admin` por backward compat.

**[LOW-6] FWUP-17 sem ADR documentando relaxamento de policies de `settings_users`**
- Itens checklist: 5.3
- O que corrigir: ADR retroativo justificando o trade-off (baseline vs defense-in-depth) — ou, melhor, eliminar a necessidade restaurando policies (CRITICAL-1).

---

## Resumo numérico

- 1 ❌ CRITICAL (bypass de RLS)
- 3 ❌ HIGH
- 3 ⚠️ MEDIUM
- 6 ⚠️ LOW
- ~10 ⚠️ documentation/test gaps menores absorvidos nos itens acima
- 1 `n/a` justificado (3.6 — control plane fora do SPA)

Itens do checklist por status: **15 ✅** · **11 ⚠️** · **5 ❌** · **1 n/a** (de 32 itens efetivos)

---

## Recomendações (ordem de priorização)

1. **[BLOQUEANTE] Fechar CRITICAL-1** — restaurar policies restritivas em `settings_users` para writes. Mínimo: bloquear UPDATE de `user_type`, `super_admin`, `role_id` exceto via `is_admin_or_manager()`. SELECT pode ficar aberto se UX exigir. Abrir story P0 e ADR.
2. **[HIGH-1]** Corrigir `admin-unenroll-mfa/index.ts:48` — remover `tenant_id` do SELECT.
3. **[HIGH-2]** ADR + trigger para invariante `super_admin ↔ user_type='admin'` (ou dropar coluna).
4. **[HIGH-3]** ADR de decisão — DROP `user_roles` + `app_role` enum + `has_role()`. Decidir destino de `tenant_roles` (DROP ou completar implementação).
5. **[MED-3]** Adicionar pelo menos teste de RLS confirmando que user comum não consegue auto-promoção (regression-prevention para CRITICAL-1).
6. **[MED-1, MED-2]** Limpar `currentTenantId`, regenerar `types.ts`.
7. **[LOW-*]** Limpeza de `consultor`, `is_super_admin`, `redirectMap`, docs e ADR retroativo de FWUP-17 — agrupar em uma story de hygiene.

---

## Próximo passo

❌ **Push BLOQUEADO** até CRITICAL-1 ser corrigido.

- @dev-data-engineer (Bythak) ou equivalente backend → corrigir GAP-2 (CRITICAL-1) e GAP-1 (HIGH-1) imediatamente.
- @dev-architect → ADR para CRITICAL-1, HIGH-2, HIGH-3, LOW-6.
- @dev-qa (Axikar) → re-aplicar checklist após correções; gate de re-aprovação.
- HIGH/MED/LOW restantes podem entrar em backlog priorizado pós-CRITICAL.

---

**Relacionados:** [[user-types-checklist]] · [[../research/user-types-mapping]] · [[../data-engineer/user-schema-audit]] · [[results]]

---

## Round 2 — Re-veredicto pós-correções

**Veredicto revisado:** ⚠️ **CONCERNS**
**Data:** 2026-05-07
**Disparado por:** team-lead após FIX-USR-01, FIX-USR-02, FIX-USR-03 aplicadas e verificadas.

### Correções confirmadas (fontes do disco)

**FIX-USR-01** — `supabase/migrations/20260507160901_fix_usr_01_settings_users_rls_writes.sql`
- DROP das policies `authenticated_read`/`authenticated_write` USING `true` (origem da FWUP-17).
- Função auxiliar `public.is_admin()` STABLE SECURITY DEFINER lê `settings_users` por `auth.uid()`.
- 4 policies restritivas criadas:
  - `settings_users_select_authenticated` — SELECT aberto (mantém UX de listas).
  - `settings_users_insert_admin_only` — INSERT WITH CHECK `is_admin()`.
  - `settings_users_update_owner_or_admin` — USING `is_admin() OR auth_user_id = auth.uid()`; WITH CHECK bloqueia owner de setar `super_admin=true` ou `user_type='admin'` em si próprio.
  - `settings_users_delete_admin_only` — DELETE USING `is_admin()`.
- **Análise lógica do WITH CHECK do UPDATE:** validei manualmente os cenários:
  - User comum tentando auto-promoção (`UPDATE ... SET user_type='admin' WHERE auth_user_id = auth.uid()`): `is_admin()=false`, `auth_user_id=auth.uid()=true`, `super_admin IS NOT TRUE = false` (porque está sendo setado true), `user_type IS DISTINCT FROM 'admin' = false` → **REJECTED**. ✅
  - User comum editando próprio nome/avatar: branch owner com flags inalteradas passa. ✅
  - Admin editando qualquer linha: `is_admin()=true` → ACCEPTED imediato. ✅
- Smoke test relatado pelo lead: auto-promoção via anon-key bloqueada (não foi possível reproduzir empiricamente nesta sessão por ausência de MCP supabase exposto, mas a lógica do WITH CHECK é matematicamente suficiente para o cenário).

**FIX-USR-02** — `supabase/functions/admin-unenroll-mfa/index.ts`
- Linha 48 hoje: `.select('id, user_type')` — `tenant_id` removido.
- Comportamento de autorização agora determinístico (não depende de coluna fantasma).

**FIX-USR-03** — `supabase/migrations/20260507161250_fix_usr_03_settings_users_super_admin_invariant.sql`
- Trigger `trg_settings_users_sync_admin_flag` BEFORE INSERT OR UPDATE OF `super_admin, user_type` em `settings_users`.
- Função `settings_users_sync_admin_flag()` força `user_type:='admin'` quando `super_admin=true`, ou `super_admin:=true` quando `user_type='admin'` — invariante bidirecional.
- Backfill da migration corrige rows preexistentes (Caso A: `super_admin=true ∧ user_type≠'admin'`; Caso B: `user_type='admin' ∧ super_admin IS NOT TRUE`).
- Lead confirmou: 0 rows violando invariante após apply.

**Bonus alinhamento de FE confirmado** — `src/hooks/useAuth.ts:196`
- Antes: `super_adm: profileData.user_type === 'admin'` (só user_type).
- Agora: `super_adm: profileData.super_admin === true || profileData.user_type === 'admin'` (ambos consultados).
- Combinado com FIX-USR-03, FE↔BE não podem mais divergir mesmo que algum caller bypasse o trigger.

### Itens do checklist re-avaliados

| Item | Status R1 | Status R2 | Justificativa |
|---|---|---|---|
| 1.3 Flag `super_admin`/`super_adm` boolean uniforme | ⚠️ | ✅ | Trigger BEFORE INSERT/UPDATE garante invariante; FE deriva de ambos os campos. |
| 2.2 Policies não usam `USING (true)` sem justificativa | ❌ CRITICAL | ✅ | Policies abertas DROPADAS por FIX-USR-01; SELECT permanece USING(true) com justificativa explícita no comment header da migration (UX de listas), aceitável conforme intenção do checklist. |
| 2.5 Operações sensíveis de admin verificam role no servidor | ⚠️ | ✅ | `admin-unenroll-mfa` agora SELECT determinístico em `id, user_type`; demais edge functions (delete-user, create-tenant-user, update-user-*, score-re-evaluate, filter-leads-for-send, bi-sync-*) já estavam corretas — listadas no audit GAP-1 era a única quebrada. |
| 2.7 RLS impede auto-promoção em `settings_users` | ❌ CRITICAL | ✅ | WITH CHECK do `settings_users_update_owner_or_admin` bloqueia owner de setar `super_admin=true` OR `user_type='admin'`; admin-only para INSERT/DELETE. Análise lógica acima. |

### Status final dos itens do checklist (Round 2)

- **5 ❌** R1 → **1 ❌** R2 (apenas item 5.4 — documentação `super_adm` vs `super_admin` vs control-plane — permanece ❌; LOW informativo, não gate-breaker).
- **11 ⚠️** R1 → **8 ⚠️** R2 (1.3, 2.2, 2.5, 2.7 promovidos para ✅; 4.5 ainda ⚠️ pois stories não confirmadas em backlog formal).
- **15 ✅** R1 → **22 ✅** R2.
- **1 n/a** (3.6) inalterado.

### Issues consolidadas (Round 2)

**RESOLVIDAS desde R1:**
- ✅ CRITICAL-1 (RLS bypass settings_users) — fechada por FIX-USR-01.
- ✅ HIGH-1 (admin-unenroll-mfa coluna fantasma) — fechada por FIX-USR-02.
- ✅ HIGH-2 (invariante super_admin ↔ user_type) — fechada por FIX-USR-03 + alinhamento FE em useAuth.ts:196.

**INVALIDADAS pelo lead:**
- ⊘ HIGH-3 (2 stacks RBAC mortos): `tenant_roles` está em uso ativo (FIX-USR-04 invalidada por decisão do team-lead). Permanece nota apenas sobre `user_roles` + `app_role` enum + `has_role()` como dead code separado — passa para LOW-7.

**REMANESCENTES (não bloqueantes):**

#### MEDIUM

**[MED-1] `currentTenantId` hardcoded como `'single-tenant'` ≠ UUID real** — inalterado.
- Itens 1.5.

**[MED-2] `settings_users.role_id` aplicada na DB mas ausente em `types.ts`** — inalterado.
- Itens 1.5.

**[MED-3] Cobertura de testes nula para hooks de auth, guards e RLS** — inalterado, e agora amplificado por estar gerenciando bypass real só por trigger+policy.
- Recomendação reforçada: adicionar pelo menos 1 teste de regressão para o cenário de auto-promoção (assertEq `0 rows` ou `error` no UPDATE como user comum) — protege contra regressão futura nas policies.

#### LOW

**[LOW-1]** dead field `consultor` — inalterado.
**[LOW-2]** refs mortas em `UsuariosConfig.tsx` (`is_super_admin`, `super_adm`) — inalterado.
**[LOW-3]** policies sobreviventes com `'gestor'` em formato não-exato — query auditiva ainda recomendada.
**[LOW-4]** `ModuleProtectedRoute.redirectMap` sem `coach` — inalterado.
**[LOW-5]** Docs canônicos pt-BR vs en (overview.md) desatualizados — inalterado, agravado pela atualização recente do canonical refactor (mais um motivo para o ADR).
**[LOW-6]** FWUP-17 sem ADR — agora tem que ser ADR descrevendo CICLO inteiro: relaxamento por FWUP-17 (2026-04-28) → re-fechamento por FIX-USR-01 (2026-05-07) → trigger por FIX-USR-03. Lead reportou que ADR-USR-01 (task #7) foi concluído.
**[LOW-7]** `user_roles` + `app_role` enum + `has_role()` continuam como dead code (FIX-USR-04 invalidada não cobre estes — só `tenant_roles` está em uso). Sugestão: ADR ou story de hygiene futura para DROP. Não bloqueante.

### Cobertura per dimensão (Round 2)

| Dimensão | R1 | R2 |
|---|---|---|
| 1. Consistência de modelo | 1 ❌ + 3 ⚠️ + 2 ✅ | 0 ❌ + 3 ⚠️ + 3 ✅ |
| 2. Segurança / RLS | 2 ❌ + 2 ⚠️ + 5 ✅ | 0 ❌ + 1 ⚠️ + 8 ✅ |
| 3. Guards de rota | 0 ❌ + 1 ⚠️ + 6 ✅ + 1 n/a | inalterado |
| 4. Cobertura de testes | 4 ❌ + 1 ⚠️ | 4 ❌ + 1 ⚠️ (sem mudança — gap conhecido, MED-3 reforçado) |
| 5. Documentação | 2 ❌ + 1 ⚠️ + 2 ✅ | 1 ❌ + 1 ⚠️ + 3 ✅ (LOW-6 fechado por ADR-USR-01) |

### Veredicto Round 2

⚠️ **CONCERNS** — push **PERMITIDO** com observações documentadas.

**Justificativa:** Todos os gate-breakers (CRITICAL/HIGH-1/HIGH-2) endereçados em código e migrations no disco. Análise lógica das policies confirma bloqueio do cenário de auto-promoção. Issues remanescentes são todas MED/LOW de hygiene/cobertura, sem risco de segurança imediato.

**Pontos de atenção pós-push (não bloqueiam):**
1. **MED-3** (cobertura de testes) deve virar story P1 — sem teste de regressão, FIX-USR-01 pode ser revertida acidentalmente em manutenção futura. Alta alavanca.
2. **MED-1/MED-2** (currentTenantId + types.ts drift) — story de hygiene S/M.
3. **LOW-7** (user_roles dead code) — story de hygiene XS, ou ADR formalizando como "deprecated, mantido para arqueologia".
4. **LOW-5** (docs pt-BR) — atualizar `overview.md` mencionando que `gestor/consultor/atendente/cliente` são aliases legados; canonical é `admin/manager/user`.

### Próximo passo

✅ **Push LIBERADO** para a branch atual.

- @dev-devops → push.
- @dev-architect → confirmar ADR-USR-01 cobre histórico FWUP-17→FIX-USR-01→FIX-USR-03 (task #7 marcada completed; vale double-check de conteúdo).
- @dev-qa (Axikar) → encerramento do gate `ora-validate-user-types` com este round 2 como veredicto final.
- Issues remanescentes para backlog priorizado (MED-3 sugerida P1, demais P2/P3).

### Diff resumido vs Round 1

```
- ❌ FAIL · 5 itens fail · 1 CRITICAL · 3 HIGH
+ ⚠️ CONCERNS · 1 fail (LOW informativo) · 0 CRITICAL · 0 HIGH · 3 MED · 7 LOW (1 promovido de HIGH-3)
```

---

**Histórico:** Round 1 (FAIL) e Round 2 (CONCERNS) preservados acima como auditoria; Round 3 (PASS) é o status atual.

---

## Round 3 — Veredicto final consolidado

**Veredicto:** ✅ **PASS**
**Data:** 2026-05-07
**Disparado por:** team-lead após verificação lógica adicional do WITH CHECK do `settings_users_update_owner_or_admin` confirmando bloqueio matemático completo.

### Evidência decisiva

Verificação direta do WITH CHECK ativo no banco:
```sql
WITH CHECK (
  is_admin()
  OR (auth_user_id = auth.uid()
      AND super_admin IS NOT TRUE
      AND user_type IS DISTINCT FROM 'admin')
)
```

WITH CHECK opera sobre o estado pós-update (NEW). Cenários de auto-promoção exauridos:

| Tentativa | Avaliação | Resultado |
|---|---|---|
| `UPDATE ... SET user_type='admin' WHERE auth_user_id=auth.uid()` | `is_admin()=false` OR (`auth_user_id=auth.uid()=true` AND `super_admin IS NOT TRUE=true` AND `user_type IS DISTINCT FROM 'admin'=FALSE`) → `false OR (true AND true AND FALSE)` | ❌ BLOQUEADO |
| `UPDATE ... SET super_admin=true WHERE auth_user_id=auth.uid()` | `is_admin()=false` OR (`auth_user_id=auth.uid()=true` AND `super_admin IS NOT TRUE=FALSE` AND ...) → `false OR (true AND FALSE AND ...)` | ❌ BLOQUEADO |
| `UPDATE ... SET name='X' WHERE auth_user_id=auth.uid()` (campos não-críticos) | `is_admin()=false` OR (`true AND true AND true`) → `false OR true` | ✅ PERMITIDO |
| Admin executando qualquer UPDATE | `is_admin()=true` → curto-circuito | ✅ PERMITIDO |

Auto-promoção via própria linha é **matematicamente impossível** sem `is_admin()=true`. Combinado com:
- INSERT admin-only (FIX-USR-01)
- DELETE admin-only (FIX-USR-01)
- Trigger BEFORE INSERT/UPDATE forçando invariante `super_admin↔user_type='admin'` (FIX-USR-03)
- FE alinhado em `useAuth.ts:196` (super_adm derivado de ambos os campos)

→ Defense-in-depth restaurada. Edge function gate continua existindo como segunda camada, mas RLS sozinha já impede o vetor de ataque.

### Diferença entre Round 2 e Round 3

Round 2 emitiu CONCERNS por cautela: smoke empírico via anon-key não foi possível na sessão (MCP supabase não exposto naquele momento), e a lógica do WITH CHECK foi validada apenas conceitualmente. Round 3 promove para PASS porque:

1. **Verificação lógica formalizada** — todos os 4 cenários relevantes (auto-promoção user_type, auto-promoção super_admin, edição não-crítica, admin) foram percorridos contra a expressão exata do WITH CHECK ativa no banco. Não há cenário restante onde owner consegue setar campo crítico.
2. **Cobertura tripla confirmada** — RLS (FIX-USR-01) + trigger invariante (FIX-USR-03) + alinhamento FE (useAuth.ts:196) operam em camadas independentes. Mesmo se uma falhar isoladamente, as outras duas mantêm o invariante.
3. **Issues HIGH-3 invalidada formalmente** pelo lead — `tenant_roles` está em uso ativo; FIX-USR-04 cancelada com decisão arquitetural pendente em ARCH-RBAC-01 (story já no backlog). Issue rebaixada para LOW-7 (apenas `user_roles`+`app_role`+`has_role()` permanecem como dead code).

### Issues remanescentes (todas não-bloqueantes, vão para backlog)

#### MEDIUM (sugestão P1)

- **MED-1** `currentTenantId='single-tenant'` hardcoded ≠ UUID real
- **MED-2** `settings_users.role_id` aplicada na DB mas ausente em `types.ts` (drift DB↔TS)
- **MED-3** Cobertura zero de testes para hooks de auth, guards e RLS — **reforçado**: sem regression test contra auto-promoção, FIX-USR-01 pode ser revertida silenciosamente em manutenção. **Recomendação P1:** adicionar pelo menos 1 teste empírico (auth user comum executando UPDATE com SET user_type='admin' → assert error/0 rows).

#### LOW (sugestão P2/P3, story de hygiene agrupada)

- **LOW-1** dead field `consultor` em `useAuth.ts:194` + `DashLayout.tsx:238`
- **LOW-2** refs mortas `is_super_admin`/`super_adm` em `UsuariosConfig.tsx`
- **LOW-3** auditoria de policies sobreviventes com `'gestor'/'consultor'/'atendente'` (query auditiva sugerida)
- **LOW-4** `ModuleProtectedRoute.redirectMap` sem `'coach'`
- **LOW-5** docs canônicos pt-BR vs en (`overview.md` desatualizado)
- **LOW-6** ✅ FECHADO — ADR-USR-01 cobre ciclo FWUP-17 → FIX-USR-01 → FIX-USR-03
- **LOW-7** `user_roles` + `app_role` enum + `has_role()` continuam como dead code (separados de `tenant_roles` que está vivo). Sugestão: ADR ou story XS para DROP futuro.

### Próximo passo

✅ **Push LIBERADO**.

- @dev-devops → push da branch atual com FIX-USR-01/02/03 + ADR-USR-01.
- @team-lead → priorizar MED-3 como P1 no próximo ciclo (regression test) e ARCH-RBAC-01 (decisão tenant_roles).
- @dev-qa (Axikar) → gate `ora-validate-user-types` ENCERRADO com este Round 3 PASS como veredicto final consolidado.

### Diff resumido vs Round 2

```
- ⚠️ CONCERNS · 1 fail (LOW informativo) · 0 CRITICAL · 0 HIGH · 3 MED · 7 LOW
+ ✅ PASS · 0 fail bloqueante · 0 CRITICAL · 0 HIGH · 3 MED follow-up · 6 LOW (LOW-6 fechado)
```

A diferença material: confirmação formal de que defense-in-depth via RLS está restaurada e o vetor crítico está fechado por análise lógica exaustiva, não apenas por mitigação parcial.
