---
title: "CLEAN-SENDS-MIGRATION-01: Remover migration duplicada e adicionar config.toml para sends-dispatch-batch"
type: story
status: done
priority: P3
complexity: XS
agent: dev-qa
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, debt, cleanup, P3]
related: ["[[FIX-SENDS-01]]", "[[../../project/modules/sends-pro]]", "[[../../agents/qa/results]]"]
---

# CLEAN-SENDS-MIGRATION-01: Remover migration duplicada e adicionar config.toml para sends-dispatch-batch

## Objetivo
Cleanup detectado pelo QA gate de FIX-SENDS-01 (2026-04-30). Remover arquivo de migration duplicado bit-a-bit e adicionar entrada explícita de `verify_jwt = false` no `supabase/config.toml` para a edge function `sends-dispatch-batch`.

## Acceptance Criteria
- [x] AC1: Deletar `supabase/migrations/20260423013000_sends_server_dispatch.sql` (duplicata exata da `20260423010000_sends_server_dispatch.sql`).
- [x] AC2: Adicionar `[functions.sends-dispatch-batch]` com `verify_jwt = false` em `supabase/config.toml`, com comentário explicando que é chamada pelo `pg_cron` via service-role.
- [x] AC3: Nenhuma quebra de deploy — migration removida é idempotente (CREATE OR REPLACE FUNCTION + ALTER TABLE IF NOT EXISTS + cron.schedule auto-substitui), e a config.toml adicionada apenas explicita o que já era comportamento default aceitável.

## Escopo

**IN:**
- Delete do arquivo `supabase/migrations/20260423013000_sends_server_dispatch.sql`.
- Edição de `supabase/config.toml` adicionando bloco `[functions.sends-dispatch-batch]`.

**OUT:**
- Mudanças em `sends-dispatch-batch/index.ts` (não necessárias).
- Re-deploy da função (delegado a Grav junto com outros deploys de SENDS).
- Mudanças em `20260423010000_sends_server_dispatch.sql` (a migration canônica permanece intocada).

## Contexto Técnico

### Migration duplicada
`diff supabase/migrations/20260423010000_sends_server_dispatch.sql supabase/migrations/20260423013000_sends_server_dispatch.sql` retornava vazio — eram bit-a-bit idênticas. Provável artefato de rebase/merge. Conteúdo é idempotente (CREATE OR REPLACE FUNCTION + ALTER TABLE ADD COLUMN IF NOT EXISTS + `cron.schedule()` que faz unschedule+schedule), portanto Supabase aplicava a segunda como no-op. Removemos a duplicata para higiene de histórico.

### config.toml
Antes desta limpeza, `sends-dispatch-batch` herdava o default `verify_jwt = true`. A função aceita JWT (service-role token enviado por `pg_cron` via `trigger_sends_dispatch_batch()` é um JWT válido) — portanto runtime funcionava. A explicitação em `config.toml` evita ambiguidade futura caso o default mude e alinha com o padrão dos demais cron-callers (`tiktok-token-refresh`, `instagram-token-refresh`, `coach-weekly-summary`, `omni-delivery-engine`, todos com `verify_jwt = false # Called by pg_cron via HTTP POST`).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-qa (Axikar) |
| Iniciado   | 2026-04-30 |
| Concluído  | 2026-04-30 |
| Branch     | main |

## File List

- `supabase/migrations/20260423013000_sends_server_dispatch.sql` — DELETED (duplicata exata)
- `supabase/config.toml` — ADD `[functions.sends-dispatch-batch] verify_jwt = false`

## QA Results

```
VEREDICTO: PASS
Story: CLEAN-SENDS-MIGRATION-01 | Data: 2026-04-30
Checklist: 3/3 ACs verificados
Issues: nenhum
Auto-veredicto: cleanup mínimo executado pelo próprio QA agent a pedido do lead após gate de FIX-SENDS-01.
Próximo passo: @dev-devops push junto com CI fix.
```
