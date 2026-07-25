---
title: Migration Status
type: task-log
agent: dev-data-engineer
updated: 2026-05-01
tags: [database, migrations, status]
related: ["[[schema]]", "[[migrations-log]]"]
---

# Migration Status

## Timestamps

| Campo | Valor |
|---|---|
| **Último timestamp criado** | `20260501140000` |
| **Último arquivo** | `20260501140000_ora_schema_drift_reconcile.sql` |
| **Próximo timestamp disponível** | `20260501150000` |

> Convenção: incremento de 1000 por migration (mantém ordenação legível).  
> Para stories do dia 2026-04-26, usar prefixo `20260426` se não houver conflito de ordering.

---

## Migrations Recentes das Stories Ativas

### 153 — `auth_login_attempts` (20260423018000)

| Campo | Detalhe |
|---|---|
| Arquivo | `20260423018000_auth_login_attempts.sql` |
| Story | AUTH-V2-03c |
| Status | Aplicada |
| Tabela criada | `public.auth_login_attempts` |
| Segurança | PII evitada: ip_hash + email_hash (SHA-256). RLS ativo, service_role only. |
| Índices | `auth_login_attempts_lookup_idx` (ip_hash, email_hash), `auth_login_attempts_blocked_until_idx` (blocked_until WHERE NOT NULL) |
| pg_cron | `cleanup-auth-login-attempts` — hourly, remove blocos expirados (>1h) |
| FK | `tenant_id` → `settings(id)` ON DELETE CASCADE |
| Observacao | UNIQUE constraint em (ip_hash, email_hash) — sem RLS policies explícitas além de ENABLE; service_role acessa direto |

### 154 — `ai_providers_get_active_key_rpc` (20260424001000)

| Campo | Detalhe |
|---|---|
| Arquivo | `20260424001000_ai_providers_get_active_key_rpc.sql` |
| Story | BI-VOICE-00 |
| Status | Aplicada |
| Função criada | `public.get_active_ai_provider_key(p_provider text) RETURNS text` |
| Segurança | SECURITY DEFINER, REVOKE ALL de PUBLIC/anon/authenticated, GRANT EXECUTE apenas para service_role |
| Lógica | SELECT api_key FROM settings_ai_providers WHERE provider=p_provider AND is_default=true AND active=true LIMIT 1 |
| Retorno | text (NULL quando não configurado) |

### 155 — `ora_schema_drift_reconcile` (20260501140000)

| Campo | Detalhe |
|---|---|
| Arquivo | `20260501140000_ora_schema_drift_reconcile.sql` |
| Decisão | Opção A + Opção C aprovadas pelo team-lead |
| Status | **Aplicada — 2026-05-01T17:13** (projeto `wotuyxscsfralqpoiyfv`) |
| Opção A | `ai_agents.stage_ids` text[] → uuid[] (cast com USING + DO block idempotente) |
| Opção C | `ai_agents.pipeline_ids text[]` adicionada + backfill de `pipeline_id` |
| Pre-flight | DO block aborta se `stage_ids` contiver elemento não-UUID |
| Smoke-test | stage_ids→uuid[] ✅, pipeline_ids→text[] ✅, backfill 2 agentes ✅ |
| Rollback | `rollbacks/20260501140000_rollback.sql` — disponível, não consumido |
| Manifest | order_index `10199` |

---

## Próximas Migrations Pendentes (stories ativas)

| Story | Migration necessária | Timestamp sugerido |
|---|---|---|
| BI-VOICE-02 (AC8) | `bi_voice_tool_invocations` | `20260424012000` |

---

## Regras de Timestamp

- Migrations do mesmo dia: incrementar em 1000 (`011000` → `012000`)
- Nova data: iniciar em `20260426000000` se for hoje (2026-04-26)
- Nunca reutilizar timestamp já ocupado
- Formato tenant: `{YYYYMMDDHHMMSS}_{descricao_snake}.sql`
