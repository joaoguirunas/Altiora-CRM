---
title: "FIX-ADM-01: Rollback em adm-create-user + remover hints de secrets em plaintext"
type: story
status: done
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-07-25
tags: [story, adm-control-plane, debt, P2, security]
related: ["[[../../project/modules/adm-control-plane]]"]
---

# FIX-ADM-01: Rollback em adm-create-user + remover hints de secrets em plaintext

## Objetivo
Adicionar rollback transacional na edge fn `adm-create-user` (hoje deixa órfãos em caso de falha) e remover os hints de secrets de 12 chars que ficam em plaintext no banco.

## Acceptance Criteria
- [x] AC1: `adm-create-user` tem rollback explícito — se qualquer step falhar, todos os registros parciais são removidos
- [x] AC2: Nenhum hint de secret em plaintext (12 chars) armazenado em `adm_clients` ou tabelas relacionadas
- [x] AC3: Criação de usuário falha graciosamente com mensagem de erro clara (sem órfãos no banco)
- [x] AC4: Migration de limpeza de hints existentes criada (ou estratégia documentada)

## Escopo

**IN:**
- `supabase/functions/adm-create-user/index.ts` — adicionar try/catch + cleanup em caso de erro
- Remover ou mascarar completamente os hints de secrets (não apenas os 12 chars)
- Verificar se outros flows de criação (adm-create-tenant?) têm o mesmo problema

**OUT:**
- Refactor completo do fluxo de onboarding
- Mudança no sistema de pgcrypto para secrets

## Contexto Técnico
**Standalone adaptation:** `adm-create-user` não existe neste projeto standalone. O equivalente é `create-global-user`.

**Bug:** `create-global-user` criava auth user via `supabaseAdmin.auth.admin.createUser()` (linha 138) e depois fazia INSERT em `settings_users`. Se o INSERT falhasse, a função retornava erro mas o auth user permanecia órfão no Supabase Auth — sem rollback.

**AC1 — Rollback:** Adicionada função `rollbackAuthUser()` e flag `authUserCreated`. Quando `profileCreateError` ocorre em criação nova (não update), o auth user recém-criado é deletado antes de retornar erro. Users resolvidos por email existente não são tocados (não compensáveis).

**AC2 — Secret hints:** Não aplicável neste projeto standalone. `adm_clients` é tabela do control plane multi-tenant (não existe neste banco). `create-global-user` não armazena hints. `create-tenant-user` já usa `adm_client_decrypted_secrets` RPC com vault — sem plaintext.

**AC3 — Graceful failure:** Corrigido — response 422 com mensagem clara, auth user removido, sem órfão.

**AC4 — Migration:** N/A neste standalone. Não há coluna `secret_hint` nas tabelas locais (verificado via grep em supabase/baseline.sql + migrations).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List
- `supabase/functions/create-global-user/index.ts` — AC1+AC3: `rollbackAuthUser()`, flag `authUserCreated`, rollback on profileCreateError

## QA Results
<!-- QA preenche ao revisar -->
