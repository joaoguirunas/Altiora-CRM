---
title: "ARCH-RBAC-01: Decisão arquitetural — sistema RBAC granular (tenant_roles)"
type: story
status: done
epic: architecture
complexity: M
agent: dev-architect
created: 2026-05-07
updated: 2026-05-07
tags: [story, architecture, rbac, decision]
related: ["[[../../../agents/data-engineer/user-schema-audit]]", "[[../../../agents/qa/user-types-verdict]]", "[[../../../agents/research/user-types-mapping]]", "[[../../decisions/ADR-AUTH-09-rbac-granular-decision]]", "[[../backlog/ARCH-RBAC-02-drop-rbac-granular]]"]
---

# ARCH-RBAC-01: Decisão arquitetural — sistema RBAC granular (tenant_roles)

## Objetivo

Decidir e documentar (via ADR) se o sistema granular de RBAC composto por `tenant_roles` + `tenant_role_permissions` + `feature_key` deve ser **mantido e evoluído** ou **descontinuado e removido** em favor do sistema canônico `user_type` (admin/manager/user).

A decisão é necessária porque o sistema está em estado intermediário: infra de DB e frontend cabeada e em uso, mas `settings_users.role_id` é NULL para a maioria dos usuários — o que faz toda a UI cair em fallback hardcoded baseado em `user_type`. Isso significa que os gates granulares **existem mas não fazem nada de fato hoje**, e essa ambiguidade tem custo de manutenção contínuo.

## Contexto

### O que existe e está em uso

**Schema (3 tabelas + 1 coluna FK):**
- `tenant_roles` — roles customizadas do tenant (id, name, description, is_system).
- `tenant_role_permissions` — matriz role × feature_key (boolean enabled).
- `settings_users.role_id` — FK opcional para `tenant_roles`. **NULL na maioria dos registros hoje.**

**Frontend (3 arquivos centrais, ~620 LOC):**
- `src/hooks/usePermissions.ts` (162 LOC) — exporta `FeatureKey` (8 keys), CRUD de tenant_roles via React Query (`useTenantRoles`, `useAllRolePermissions`, `useCreateTenantRole`, `useDeleteTenantRole`, `useUpdateRolePermission`).
- `src/hooks/useUserPermissions.ts` (172 LOC) — consome `FeatureKey` e expõe gates: `canExportCRM`, `canDeleteCRM`, `canViewScore`, `canViewCoach`, `canEditCoach`, `canCreateSends`, `canViewBI`, `canViewSettings`. Cada um chama `canFeature(key, defaultValue)` que **lê `tenant_role_permissions` se houver `role_id` populado, senão cai no `defaultValue` hardcoded** (geralmente `canManage`).
- `src/components/config/PermissoesConfig.tsx` (286 LOC) — UI completa de listagem de roles, criação de novas, toggle de permissões por feature. Já está montada na tela de configurações.

**Callers downstream (17 arquivos consomem `useUserPermissions`):**
- Páginas: `Negocios`, `Reunioes`, `Conversas`, `Clientes`, `CoachDashboard`, `CoachTeamBoard`, `CriarDisparo`, `Horarios`.
- Componentes: `DashLayout`, `NegociosToolbar`, `ImportListaTab`, `UsuariosConfig`, `CallProConfig`, `CallMegaConfig`.

**8 feature_keys hoje:** `crm_export`, `crm_delete`, `score_view`, `coach_view`, `coach_edit`, `sends_create`, `bi_view`, `settings_view`.

### Estado real de uso (gap hoje)

- `tenant_role_permissions` query existe (`useUserPermissions.ts:20-23`), mas se `role_id` é NULL não há row a buscar — gate cai em `canManage` (fallback hardcoded).
- Resultado prático: para 99% dos usuários hoje os 8 gates granulares **se comportam exatamente como `if (isManager)`**. A granularidade existe no schema e no código mas não é exercida em produção.
- A UI `PermissoesConfig` permite criar roles e tabelar permissions — mas **não há fluxo de atribuição de role a usuário**. Mesmo que admin crie 5 roles customizadas, nenhuma se aplica a ninguém porque ninguém tem `role_id` setado.

### O que já foi descartado

Sistema legado `user_roles` + enum `app_role` + função `has_role()` foi dropado em migration anterior (parte da limpeza FIX-USR-04 original). O escopo aqui é **apenas** o sistema `tenant_roles`, que não é o mesmo e está vivo.

### Por que essa decisão importa agora

A auditoria FIX-USR-04 inicialmente classificou o sistema inteiro como "stack RBAC morto" e propôs DROP. dev-data-engineer descobriu que isso quebraria 17 callers + UI inteira. Em vez de bater ou recuar sem critério, decidir formalmente o destino do sistema fecha a ambiguidade que está pagando custo:

1. **Falsa sensação de granularidade:** novos devs olham para `canExportCRM` e assumem que existe controle real. Não existe.
2. **Risco de drift se evoluirmos parcialmente:** alguém pode popular `role_id` de alguns usuários e quebrar fallback assumido.
3. **Custo de manter código que não exerce sua função:** ~620 LOC + 3 tabelas + UI sem ROI.
4. **Bloqueador para feature requests:** "tornar X visível só para vendedor sênior" hoje tem 2 caminhos plausíveis (criar role ou criar user_type) — sem decisão, qualquer escolha é insegura.

## Acceptance Criteria

- [x] **AC1: Análise de impacto Opção A (Manter + evoluir)** — documento dentro da própria story (ou anexo `agents/architect/rbac-impact-analysis.md`) cobrindo:
  - Trabalho necessário para popular `role_id` em todos os usuários existentes (migration de seed + default role mapping `user_type` → role).
  - UI de atribuição de role por usuário (em `UsuariosConfig` ou tela dedicada): wireframe + escopo.
  - Documentar comportamento: quem cria roles? admin pode criar role customizada que dê mais poder do que o próprio admin? regras de invariantes.
  - Backfill: estratégia para `role_id` NULL não quebrar produção durante deploy gradual.
  - Custo estimado em complexidade (S/M/L/XL) por sub-task.
  - Riscos novos introduzidos (ex: admin promove via UI sem passar por edge fn → considerar interação com FIX-USR-01).

- [x] **AC2: Análise de impacto Opção B (Descontinuar)** — cobrindo:
  - Lista exata de arquivos a remover: `usePermissions.ts`, `PermissoesConfig.tsx`, registry/route da tela de permissões em `SETTINGS_SECTIONS`.
  - Refactor de `useUserPermissions.ts`: remover `canFeature()`, achatar todos os gates `canExportCRM/canDeleteCRM/...` para depender só de `isManager`/`isAdmin`/`isUser` ou eliminá-los.
  - Migration: drop `tenant_role_permissions`, drop `tenant_roles`, drop `settings_users.role_id`. Adicionar à `client-migrations.json`.
  - Lista dos 17 callers de `useUserPermissions` com diff esperado (mostrar que nenhum perde funcionalidade real, dado que hoje cai no fallback).
  - Custo estimado em complexidade.
  - O que se perde: extensibilidade futura para "papéis customizados" ficaria bloqueada — alguém que quiser isso volta ao zero.

- [x] **AC3: ADR de decisão** — `docs/smart-memory/decisions/ADR-AUTH-09-rbac-granular-decision.md` no formato padrão (Contexto → Opções → Decisão → Consequências) referenciando esta story e a análise. Status `accepted`. Decisão final entre A e B com rationale explícito.

- [x] **AC4: Stories filhas criadas (condicional ao veredicto)**:
  - **Veredicto: Opção B (descontinuar).**
  - Story criada: [[../backlog/ARCH-RBAC-02-drop-rbac-granular]] — drop completo do stack (S, dev-data-engineer).

- [x] **AC5: Cross-references** — ARCH-RBAC-01 referencia `agents/data-engineer/user-schema-audit.md` e `agents/qa/user-types-verdict.md` no frontmatter `related`. ADR-AUTH-09 referencia esta story e ARCH-RBAC-02. FIX-USR-04 já foi removida do disco (invalidação consumada); link para ARCH-RBAC-01 mantido em BACKLOG.md ("invalidated, ver ARCH-RBAC-01").

## Escopo

**IN:**
- Análise comparativa das 2 opções com dados quantitativos (LOC, callers, custo de migração).
- ADR com decisão final e rationale.
- Stories filhas para implementação (escopo + complexidade, sem implementação aqui).

**OUT:**
- Implementação da Opção A ou B — fica para as stories filhas.
- Auditoria de outros sistemas de permissão (control plane, edge fn gates) — escopo é exclusivamente `tenant_roles`.
- Decisão sobre granularidade de `user_type` (manter 3 níveis vs expandir) — ortogonal.

## Contexto Técnico

### Mapa de evidências (verificadas em 2026-05-07)

```
src/hooks/usePermissions.ts              162 LOC — define FeatureKey, expõe CRUD de roles
src/hooks/useUserPermissions.ts          172 LOC — consome FeatureKey, define 8 gates can*
src/components/config/PermissoesConfig.tsx  286 LOC — UI completa de gerenciamento

Callers de useUserPermissions: 17 arquivos
Callers diretos de usePermissions (CRUD): 1 arquivo (PermissoesConfig)
Feature keys: 8
Gates can* dependentes de canFeature(): 8
```

### Restrições / dependências

- A decisão **não pode** ser tomada antes de FIX-USR-01 (RLS de `settings_users` ser fechado). Razão: Opção A introduz necessidade de admin atribuir role via UI — isso só é seguro com RLS restritivo + edge fn gate. Se FIX-USR-01 não estiver mergeado, qualquer mecanismo de role-assignment fica vulnerável a self-elevation.
- ADR-AUTH-04 (granularidade de hooks) cobre `useUserPermissions` por outro ângulo. ARCH-RBAC-01 deve ser consistente com ele — se a decisão for B, ADR-AUTH-04 precisa ser atualizado para refletir a remoção dos gates `can*` granulares.
- ADR-AUTH-08 (invariante super_admin ↔ user_type) não é afetado diretamente — `user_type` continua sendo a fonte canônica de classe de usuário; `tenant_roles` é/seria uma dimensão ortogonal de permissões finas.

### Recomendação preliminar do dev-architect (não-vinculante)

Sem ter ainda feito a análise quantitativa formal das duas opções, minha intuição (baseada no estado atual + sinais do projeto):

> **Inclinação para Opção B (descontinuar).** O sistema está em estado de "infraestrutura sem clientes" — schema, hooks e UI montados, mas zero usuário tem `role_id` populado, então nenhum gate granular faz nada hoje. Manter custa LOC + cognitive load contínuos. Reativar (Opção A) exige investimento não-trivial para entregar um valor que ainda não foi pedido por nenhum stakeholder identificado. **Mas isso pode mudar** se a análise revelar que (a) algum tenant está esperando granularidade, (b) o custo de remoção é maior do que parece, ou (c) há roadmap próximo que precisa disso.

A decisão final só pode ser tomada após AC1 + AC2 estarem completos com números.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-architect |
| Iniciado   | 2026-05-07 |
| Concluído  | 2026-05-07 |

## File List
- `docs/smart-memory/decisions/ADR-AUTH-09-rbac-granular-decision.md` (new) — decisão final + análise A vs B + rationale
- `docs/smart-memory/stories/backlog/ARCH-RBAC-02-drop-rbac-granular.md` (new) — story filha de execução
- `docs/smart-memory/stories/done/ARCH-RBAC-01.md` (moved from backlog/, status → done, ACs marcados)

## Veredicto

**Opção B — descontinuar — APROVADA.**

Análise quantitativa colapsou a decisão: o sistema granular não está apenas sem produtores (tabelas vazias em ORA, função seed nunca chamada) — está também **sem consumidores**. Os 8 gates `canExportCRM/canDeleteCRM/canViewScore/canViewCoach/canEditCoach/canCreateSends/canViewBI/canViewSettings` são definidos em `useUserPermissions.ts:162-169` e **NUNCA lidos por nenhum dos 17 callers**. Verificado por grep word-boundary em todo `src/`.

Bônus: a RLS de write em `tenant_roles` filtra `user_type='gestor' OR super_admin=true`, mas `gestor` não é valor canônico (canônico é `manager`) — bug latente que prova que ninguém testou o caminho real desde a implementação. Drop elimina o bug junto.

Esforço Opção A (manter): L-XL, 3-5 stories, sem stakeholder pedindo. Esforço Opção B (drop): S, ~480 LOC removidas, 0 callers afetados.

A decisão é reversível em código (git) e em design (re-implementação ~2 dias quando houver demanda real).

## QA Results
<!-- QA preenche ao revisar quando ARCH-RBAC-02 mergear -->
