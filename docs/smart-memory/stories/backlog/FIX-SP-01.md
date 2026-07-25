---
title: "FIX-SP-01: Capability token usando user_id em vez de tenant_id (linha 108)"
type: story
status: backlog
priority: P1
complexity: S
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-22
tags: [story, schedule-pro, bug, P1, security]
related: ["[[../../project/modules/schedule-pro]]", "[[../../decisions/ADR-SP-01-capability-tokens-public-booking]]"]
---

# FIX-SP-01: Capability token usando user_id em vez de tenant_id (linha 108)

## Objetivo
Corrigir o campo errado no payload do capability token de booking público — garante isolamento multi-tenant correto nos tokens HMAC.

## Acceptance Criteria
- [ ] AC1: Na criação do capability token, o payload contém `tenant_id` (não `user_id`)
- [ ] AC2: Tokens gerados antes do fix continuam sendo rejeitados corretamente (HMAC mudou payload)
- [ ] AC3: Booking público funciona end-to-end com token novo em staging
- [ ] AC4: Edge fn de validação do token verifica `tenant_id` no payload

## Escopo

**IN:**
- Arquivo com capability token generation (linha ~108) — identificar via `grep -r "capability" supabase/functions/`
- Corrigir campo de `user_id` para `tenant_id` no payload
- Verificar validação no lado receptor

**OUT:**
- Refactor completo do sistema de tokens
- Migração de tokens existentes no banco

## Contexto Técnico
ADR-SP-01 define capability tokens HMAC-SHA256 para public booking. A linha 108 de alguma edge fn de schedule passa `user_id` onde deveria passar `tenant_id`, criando tokens que potencialmente vazam contexto cross-tenant. Ver `docs/smart-memory/project/modules/schedule-pro.md` e `docs/smart-memory/decisions/ADR-SP-01-capability-tokens-public-booking.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/schedule-capability-token-tenant |

## File List

## QA Results
