---
title: "FIX-USR-04: Remover stacks RBAC mortos (user_roles + tenant_roles)"
type: story
status: invalid
epic: cleanup
complexity: S
agent: dev-data-engineer
created: 2026-05-07
updated: 2026-05-07
tags: [story, cleanup, schema, dead-code]
related: ["[[../../../agents/data-engineer/user-schema-audit]]", "[[../../../agents/qa/user-types-verdict]]"]
---

# FIX-USR-04: Remover stacks RBAC mortos (user_roles + tenant_roles)

## Objetivo
Eliminar dois sistemas RBAC nunca usados que coexistem no schema: tabela `user_roles` + enum `app_role` + função `has_role()` (criados 2025-11-13) e tabela `tenant_roles` + `tenant_role_permissions` + enum `feature_key` (criados 2026-04-23).

## Acceptance Criteria
- [ ] AC1: `DROP TABLE user_roles`, `DROP TYPE app_role`, `DROP FUNCTION has_role()` em migration
- [ ] AC2: `DROP TABLE tenant_role_permissions`, `DROP TABLE tenant_roles`, `DROP TYPE feature_key` em migration (verificar se `useUserPermissions` + `usePermissions` referenciam — se sim, remover hooks também)
- [ ] AC3: Nenhuma referência restante no frontend ou edge functions após remoção
- [ ] AC4: Migration adicionada ao `client-migrations.json`

## Escopo

**IN:**
- Drops das tabelas/tipos/funções mortos
- Remoção de hooks frontend que referenciam exclusivamente esses schemas (se existirem)

**OUT:**
- Qualquer alteração no sistema canônico `settings_users`/`user_type`

## Contexto Técnico
Ambos os sistemas foram criados mas nunca cabeados no frontend ou edge functions. `tenant_role_permissions` tem FK para `tenant_roles` — ordem de drop: `tenant_role_permissions` → `tenant_roles`. Verificar `useUserPermissions` e `usePermissions.FeatureKey` antes de dropar `feature_key` enum.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer |
| Iniciado   | — |
| Concluído  | — |
