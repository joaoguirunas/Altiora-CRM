---
title: "US-CFG-03: Audit log de ações em Settings"
type: story
status: done
epic: settings
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, security, audit, P3]
related: ["[[../../project/modules/settings]]", "[[../../decisions/ADR-ADM-02-secrets-encryption]]"]
---

# US-CFG-03: Audit log de ações em Settings

## Objetivo
Registrar todas as alterações de configuração (quem mudou o quê e quando) e exibir esse histórico em Settings > Outros > Logs.

## Acceptance Criteria
- [x] AC1: Tabela `settings_audit_log` criada (tenant_id, user_id, section, field, old_value, new_value, is_sensitive, changed_at) — campos com suffix `_secret`, `_key`, `_token`, `_password` armazenados como SHA-256 via `audit_value()`
- [x] AC2: Triggers `settings_audit`, `bi_settings_audit`, `omni_channel_configs_audit` (AFTER UPDATE, SECURITY DEFINER) capturam mudanças campo a campo e inserem em `settings_audit_log`
- [x] AC3: Sub-tab "Configurações" em Settings > Outros > Logs exibe tabela paginada (20/página) com: data/hora, campo, seção, valor anterior, novo valor — sensíveis exibem hash truncado com toggle "ver hash completo"
- [x] AC4: Filtros por seção (select) e por usuário (select) — query com `.eq()` no supabase client
- [x] AC5: `pg_cron` job `settings_audit_cleanup` deleta registros com `changed_at < now() - interval '90 days'` — `cron.schedule()` idempotente

## Implementação

### AC1+AC2 — Migration e triggers
`supabase/migrations/20260423002000_settings_audit_log.sql`:
- Tabela `settings_audit_log` com RLS (SELECT por `app_metadata.tenant_id`, INSERT permissivo para triggers SECURITY DEFINER)
- 3 índices: `(tenant_id, changed_at DESC)`, `(tenant_id, section)`, `(tenant_id, user_id)`
- Funções `is_sensitive_column(col)` e `audit_value(col, val)` — hash SHA-256 via `encode(sha256(...),'hex')` para colunas sensíveis
- Trigger function `settings_audit_trigger_fn(section_arg)` — itera colunas via `information_schema`, insere apenas campos que mudaram
- Triggers em `settings` (section='geral'), `bi_settings` (section='integracoes'), `omni_channel_configs` (section='omni')
- `cron.schedule('settings_audit_cleanup', ...)` idempotente

### AC3+AC4 — Hook e componente
`src/hooks/useSettingsAuditLog.ts`:
- `useSettingsAuditLog(filters)` — filtros `section`, `user_id`, `page`; join com `settings_users` para `user_name`; `staleTime: 30s`

`src/components/config/SettingsAuditLog.tsx`:
- Tabela com 5 colunas: Data/Hora (com user_name), Campo (+ badge "hash" para sensíveis), Seção, Valor anterior, Novo valor
- `HashValue` component: sensíveis exibem `hash.slice(0,8)…` com toggle Eye/EyeOff para revelar hash completo
- Paginação simples via `page` state — Next desabilitado quando `entries.length < 20`
- Selects de filtro resetam `page` ao mudar

`OutrosConfig.tsx`:
- Nova tab "Configurações" (lazy `SettingsAuditLog`) entre "Logs" e "Documentação"
- Visível para todos os gestores (não restrita a `isSuperAdmin`)

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## File List

- `supabase/migrations/20260423002000_settings_audit_log.sql` — criado
- `src/hooks/useSettingsAuditLog.ts` — criado
- `src/components/config/SettingsAuditLog.tsx` — criado
- `src/components/config/OutrosConfig.tsx` — tab "Configurações" adicionada

## QA Results

TypeScript: 0 erros (`npx tsc --noEmit --skipLibCheck`).
Nota: triggers dependem de `auth.jwt()` e `auth.uid()` disponíveis — funcionam em contexto RLS mas não em migrations de test sem JWT. Testar manualmente após deploy.
