---
title: "FIX-USR-02: Corrigir SELECT em coluna fantasma tenant_id (admin-unenroll-mfa)"
type: story
status: done
epic: security
complexity: S
agent: dev-data-engineer
created: 2026-05-07
updated: 2026-05-07
tags: [story, security, auth, edge-function]
related: ["[[../../../agents/data-engineer/user-schema-audit]]", "[[../../../agents/qa/user-types-verdict]]"]
---

# FIX-USR-02: Corrigir SELECT em coluna fantasma tenant_id (admin-unenroll-mfa)

## Objetivo
Corrigir runtime error em `admin-unenroll-mfa/index.ts:48` que seleciona coluna `tenant_id` inexistente em `settings_users` (projeto single-tenant migrado).

## Acceptance Criteria
- [ ] AC1: `admin-unenroll-mfa` deployada sem referência à coluna `tenant_id`
- [ ] AC2: Fluxo de unenroll MFA funciona end-to-end sem erro 500
- [ ] AC3: Nenhuma outra edge function referencia `settings_users.tenant_id` (varredura de ocorrências)

## Escopo

**IN:**
- Remover/substituir referência a `tenant_id` em `admin-unenroll-mfa/index.ts:48`
- Varrer `supabase/functions/` por outras referências a `settings_users.tenant_id`

**OUT:**
- Mudança no schema de banco
- Alteração em outras edge functions não afetadas

## Contexto Técnico
`settings_users` não possui coluna `tenant_id` após migração single-tenant. A coluna provavelmente era usada em contexto multi-tenant legado. A query provavelmente falha silenciosamente ou lança exceção não tratada.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer |
| Iniciado   | — |
| Concluído  | — |
