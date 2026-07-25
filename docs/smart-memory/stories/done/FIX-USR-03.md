---
title: "FIX-USR-03: Trigger para invariante super_admin ↔ user_type='admin'"
type: story
status: done
epic: security
complexity: S
agent: dev-data-engineer
created: 2026-05-07
updated: 2026-05-07
tags: [story, security, schema, trigger]
related: ["[[../../../agents/data-engineer/user-schema-audit]]", "[[../../../agents/qa/user-types-verdict]]", "[[../../../decisions/ADR-AUTH-08-invariante-super-admin-user-type]]"]
---

# FIX-USR-03: Trigger para invariante super_admin ↔ user_type='admin'

## Objetivo
Garantir no nível do banco que `super_admin = true` implica `user_type = 'admin'` — evitando drift silencioso que hoje é possível sem validação automática.

## Acceptance Criteria
- [ ] AC1: Trigger `BEFORE INSERT OR UPDATE` em `settings_users` garante: se `super_admin = true` e `user_type != 'admin'`, raise exception
- [ ] AC2: Ou alternativa: trigger sincroniza automaticamente (`super_admin = true` força `user_type = 'admin'`)
- [ ] AC3: Migration numerada corretamente e adicionada ao `client-migrations.json`
- [ ] AC4: Frontend `useAuth.ts:196` alinhado — deriva `super_adm` a partir de `super_admin` boolean (não só de `user_type`)

## Escopo

**IN:**
- Trigger Postgres em `settings_users`
- Correção em `useAuth.ts:196` para ler `super_admin` boolean diretamente

**OUT:**
- Mudança na lógica de negócio de promoção de usuário

## Contexto Técnico
`useAuth.ts:196` deriva `super_adm` apenas de `user_type === 'admin'`, ignorando a coluna `super_admin`. Se `super_admin=true` e `user_type='manager'` (possível sem trigger), o frontend não reconhece o super-admin.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer |
| Iniciado   | — |
| Concluído  | — |
