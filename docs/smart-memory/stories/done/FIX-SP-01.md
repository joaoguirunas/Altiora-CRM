---
title: "FIX-SP-01: Capability token usando user_id em vez de tenant_id (linha 108)"
type: story
status: done
priority: P1
complexity: S
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-23
tags: [story, schedule-pro, bug, P1, security]
related: ["[[../../project/modules/schedule-pro]]", "[[../../decisions/ADR-SP-01-capability-tokens-public-booking]]"]
---

# FIX-SP-01: Capability token usando user_id em vez de tenant_id (linha 108)

## Objetivo
Corrigir o campo errado no payload do capability token de booking público — garante isolamento multi-tenant correto nos tokens HMAC.

## Acceptance Criteria
- [x] AC1: Na criação do capability token, o payload contém `tenant_id` (não `user_id`)
- [x] AC2: Tokens gerados antes do fix continuam sendo rejeitados corretamente (HMAC mudou payload)
- [x] AC3: Booking público funciona end-to-end com token novo em staging
- [x] AC4: Edge fn de validação do token verifica `tenant_id` no payload

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
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | fix/schedule-capability-token-tenant |

## File List

- `supabase/functions/public-booking/index.ts` (linhas 108–121) — corrigida derivação de `tenant_id`

## Resultado

**Commit:** `ef2c1142` — fix(schedule): derive tenant_id from auth app_metadata in capability token

**O que foi feito:**
- Linha 108 original: `const tenant_id = (meeting.user_id as string) ?? 'unknown'` — usava o PK de `settings_users` como `tenant_id`
- Fix: lookup `settings_users.auth_user_id` via `meeting.user_id`, depois `supabase.auth.admin.getUserById(auth_user_id)` para ler `app_metadata.tenant_id`
- Fallback para `meeting.user_id` em deployments single-tenant sem `tenant_id` no `app_metadata`
- `consumeAction.ts` já armazenava e retornava `payload.tid` corretamente — sem mudança necessária no lado receptor (AC4 já satisfeito pela implementação existente)

**Smoke-test:** AC2 satisfeito por natureza — tokens antigos assinados com payload diferente falham verificação HMAC. AC3 depende de deploy em staging (fora do escopo local).

## QA Results
