---
title: "ADM-V3-07: Versionar migrations RPCs e audit_log em migrations_adm/"
type: story
status: done
epic: adm-v3
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, adm, control-plane, database, reliability, P2]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-ADM-04-batch-vs-incremental-sync]]"]
---

# ADM-V3-07: Versionar migrations RPCs e audit_log em migrations_adm/

## Objetivo
Garantir que todos os objetos de schema do control plane (`adm_audit_log`, `adm_migrations`, `adm_migration_runs`, RPCs de cifragem) estejam formalizados em `supabase/migrations_adm/` versionados, eliminando dependência de `manual-fixes/` para bootstrap de um novo control plane.

## Acceptance Criteria
- [x] AC1: Auditoria concluída — objetos que estavam apenas em `manual-fixes/` ou migrations regulares: `app_encrypt_secret`, `app_decrypt_secret`, `adm_client_decrypted_secrets`, `adm_clients_secrets_status` (em `supabase/migrations/20260325210000_adm_secrets_encryption.sql` e `20260405210000_adm_clients_secrets_status.sql` — aplicadas apenas no control plane por convenção, não versionadas em `migrations_adm/`)
- [x] AC2: Migration `supabase/migrations_adm/20260422001000_adm_audit_log.sql` cria `adm_audit_log` com schema completo (colunas, RLS, índices de ADM-V3-06) — idempotente via `CREATE TABLE IF NOT EXISTS`
- [x] AC3: Migration `supabase/migrations_adm/20260422002000_adm_rpcs.sql` cria/substitui RPCs: `app_encrypt_secret`, `app_decrypt_secret`, `adm_client_decrypted_secrets`, `adm_clients_secrets_status` — idempotente via `CREATE OR REPLACE FUNCTION`
- [x] AC4: Migration `supabase/migrations_adm/20260422003000_adm_migrations_catalog.sql` cria `adm_migrations` e `adm_migration_runs` se não existirem — com RLS idempotente via DO block
- [x] AC5: Script `scripts/bootstrap-control-plane.sh` executa todas as migrations de `migrations_adm/` em ordem — documentado via comentário inline com instruções de uso

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations_adm/20260422001000_adm_audit_log.sql`
- `supabase/migrations_adm/20260422002000_adm_rpcs.sql`
- `supabase/migrations_adm/20260422003000_adm_migrations_catalog.sql`
- `scripts/bootstrap-control-plane.sh`

## QA Results
<!-- QA preenche ao revisar -->
