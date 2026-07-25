---
title: Checklist de Validação — Tipos de Usuário
type: qa-checklist
agent: dev-qa
status: active
created: 2026-05-07
updated: 2026-05-10
tags: [qa, auth, roles, rls, user-types]
related: ["[[../../project/architecture]]", "[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-AUTH-03-restricted-route-control-plane]]", "[[../../decisions/ADR-AUTH-06-mfa-totp]]", "[[../../decisions/ADR-PP-03-server-verified-tenant-id]]"]
---

# Checklist de Validação — Tipos de Usuário

Framework formal aplicado por **Axikar** para emitir veredicto sobre consistência, segurança e cobertura do modelo de tipos de usuário no João Guirunas.

> **Contexto:** João Guirunas é single-tenant (1 projeto Supabase por cliente — `wotuyxscsfralqpoiyfv` no caso João Guirunas). O modelo multi-tenant continua como padrão arquitetural cross-cliente (control plane → tenant), mas dentro de cada projeto existe **um único tenant**. Roles canônicos: `gestor`, `consultor`, `atendente`, `cliente`, mais a flag `super_adm` ortogonal (admin do control plane). Guards principais: `ProtectedRoute`, `RestrictedRoute`, `ModuleProtectedRoute`. MFA AAL2 obrigatório para `gestor`/`super_adm` quando `settings.require_mfa_for_gestores=true`.

---

## Como aplicar

1. Para cada item, marcar `✅` (verde), `⚠️` (concern), `❌` (fail) ou `n/a`.
2. Cada marcação **deve** apontar evidência: arquivo:linha, migration, policy, teste, ou ausência explícita.
3. Issues `❌` em qualquer item dentro de **Segurança/RLS** ou **Consistência de modelo** elevam o veredicto a `FAIL` por padrão.
4. Issues `⚠️` agregadas (3+) também elevam para `CONCERNS` mínimo.
5. Item `n/a` exige justificativa (ex: "projeto não usa coluna X").

---

## Dimensões de análise

### 1. Consistência de modelo

- [ ] **1.1** Roles definidos em local único — DB enum/check OU constante TS exportada — não ambos divergentes.
  - Evidência esperada: nome da migration que cria enum/check; nome do arquivo TS exportando constante; comparação textual.
- [ ] **1.2** Tipo do campo `user_type` (ou equivalente) é idêntico em todas as tabelas que o referenciam (`settings_users`, profiles, etc).
- [ ] **1.3** Flag `super_adm` é `boolean` em todas as tabelas/colunas que a guardam — sem ambivalência string/bool.
- [ ] **1.4** Nenhum role hardcoded como string literal em componente/hook frontend (ex: `if (role === 'gestor')` espalhado sem constante).
- [ ] **1.5** Profile shape (`user.profile`) consistente com tipos do Supabase gerados (`Database['public']['Tables']['settings_users']['Row']`).
- [ ] **1.6** `isProvisional` (perfil em loading/fallback) tratado de forma uniforme entre guards — mesma semântica em `ProtectedRoute` e `RestrictedRoute`.

### 2. Segurança / RLS

- [ ] **2.1** Todas as tabelas sensíveis (`settings_users`, `clients_people`, `leads`, `meetings`, `messages`, `clients_companies`) têm `ENABLE ROW LEVEL SECURITY` ativo.
  - Evidência: query `pg_tables` ou checagem das migrations.
- [ ] **2.2** Policies não usam `USING (true)` sem justificativa documentada (ADR ou comentário inline).
- [ ] **2.3** Policies que checam role usam fonte estável — `auth.jwt() -> 'app_metadata' -> 'tenant_id'` ou tabela `settings_users` joined por `auth.uid()` — nunca `user_metadata` (mutável pelo cliente).
- [ ] **2.4** Edge functions que validam role chamam `supabase.auth.getUser(token)` e leem `user.app_metadata`, **não** decodificam JWT unsigned (ADR-PP-03 — `extractTenantId` deprecated).
- [ ] **2.5** Operações sensíveis de admin (`adm-create-user`, `adm-sync-client`, etc) verificam `super_adm` no servidor antes de executar — nunca confiam apenas em guard de UI.
- [ ] **2.6** Endpoints públicos (`lp-submit`, `public-booking`, `whatsapp-inbound`, `meta-inbound`) **não** têm coluna de `user_type` exposta; segurança é HMAC ou capability token, não role.
- [ ] **2.7** RLS `update`/`delete` em `settings_users` **impede** auto-promoção: usuário comum não consegue setar `super_adm=true` ou `gestor=true` no próprio registro.
- [ ] **2.8** Step-up auth (MFA AAL2) é exigido para mutações sensíveis ao nível de role (criar/promover usuário, gerar recovery codes) — server-side ou client-side declarado em ADR-AUTH-STEPUP-01.
- [ ] **2.9** Nenhum bypass de RLS via `service_role` no frontend; chave service-role só em edge functions ou control plane.

### 3. Guards de rota (frontend)

- [ ] **3.1** Toda rota autenticada está dentro de `<ProtectedRoute>` em `src/App.tsx` — nenhuma página leak fora do guard.
- [ ] **3.2** Rotas que exigem gestor usam `<RestrictedRoute requireGestor>` — não há reimplementação ad-hoc com `if (user.profile.gestor)`.
- [ ] **3.3** Rotas de módulo PRO usam `<ModuleProtectedRoute moduleKey="...">` consistente com `enabled_modules` do tenant.
- [ ] **3.4** Mobile (`/m/*`) replica os mesmos guards via `MobileModuleGuard` — nenhuma rota mobile escapa de proteção que existe no desktop.
- [ ] **3.5** Rotas públicas explicitamente listadas (`isPublicRoute` em `src/utils/constants.ts`) batem com as rotas declaradas sem `<ProtectedRoute>` em `App.tsx`.
- [ ] **3.6** Super-admin (rotas `/adm/*`, se existirem) tem guard exclusivo (`requireSuperAdmin` ou equivalente per ADR-AUTH-03), **e** depende de `isControlPlane && super_adm` — nunca apenas `super_adm`.
- [ ] **3.7** MFA guard em `ProtectedRoute` redireciona corretamente: `/settings/mfa-setup` se sem TOTP, `/settings/mfa-verify` se AAL1.
- [ ] **3.8** Auto-redirect quando módulo está inativo (`ModuleProtectedRoute` redirect map) cobre todos os `module_key` válidos sem fallback silencioso para rota proibida.

### 4. Cobertura de testes

- [ ] **4.1** Existem testes unitários cobrindo lógica de permissão dos hooks (`useAuth`, `useUserPermissions` se houver).
- [ ] **4.2** Existem testes para os guards (`ProtectedRoute`, `RestrictedRoute`, `ModuleProtectedRoute`) — pelo menos golden path + role insuficiente.
- [ ] **4.3** Existem testes (manuais documentados ou automatizados) de RLS para tabelas sensíveis — usuário comum tenta ler/atualizar registros que não deveria.
- [ ] **4.4** Edge functions críticas de auth (`adm-create-user`, `mfa-*`) têm pelo menos um teste de unhappy path (token inválido, role insuficiente).
- [ ] **4.5** Caso o checklist atual revele gaps, há story aberta no backlog para fechar — ou justificativa documentada se for declarado débito técnico.

### 5. Documentação

- [ ] **5.1** Roles documentados em smart-memory (`auth-tenant-bootstrap.md` ou ADR dedicado) com semântica de cada um.
- [ ] **5.2** Fluxo de auth (login → bootstrap → MFA → profile) documentado com diagrama (existe em `architecture.md §3` e `§6`; verificar se está atualizado).
- [ ] **5.3** ADRs relevantes existentes e legíveis: ADR-AUTH-03 (super-admin), ADR-AUTH-06 (MFA), ADR-PP-03 (server-verified tenant).
- [ ] **5.4** Diferença entre `super_adm` (flag DB) e isControlPlane (contexto runtime) explicada — relação clara para evitar confusão futura.
- [ ] **5.5** Convenção de nomenclatura de roles documentada — pt-BR (`gestor`, `consultor`, `atendente`, `cliente`) é padrão; mistura com inglês deve ser flagada.

---

## Inputs esperados (Fase 2)

Para emitir veredicto, **Axikar** consumirá:

- `docs/smart-memory/agents/research/user-types-mapping.md` (dev-analyst) — mapeamento de roles no frontend, hooks, guards, hardcodes.
- `docs/smart-memory/agents/data-engineer/user-schema-audit.md` (dev-data-engineer) — schema `settings_users` + RLS policies + edge functions auth.

---

## Output (Fase 2)

`docs/smart-memory/agents/qa/user-types-verdict.md` com:

- Veredicto formal: `PASS` / `CONCERNS` / `FAIL`
- Tabela do checklist preenchida com evidências
- Issues classificadas (CRITICAL / HIGH / MED / LOW)
- Recomendações acionáveis
- Próximo passo (push, correções, stories abertas)

---

**Relacionados:** [[../../project/architecture]] · [[../../project/modules/auth-tenant-bootstrap]] · [[results]]
