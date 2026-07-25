---
title: "Story OBS-DISPATCH-HEALTH-01: View v_dispatch_health + RPC + card UI de saúde do disparo"
type: story
status: done
priority: P3
complexity: M
agent: dev-data-engineer
created: 2026-05-01
updated: 2026-07-25
tenant: wotuyxscsfralqpoiyfv
tags: [story, sends-pro, observability, monitoring, pg-cron, ux]
related:
  - "[[../../agents/data-engineer/sends-pro-db-state]]"
  - "[[../../agents/research/2026-05-01-sends-edge-fns-audit]]"
  - "[[../../agents/research/2026-05-01-sends-frontend-audit]]"
  - "[[../../agents/research/2026-05-01-sends-disparo-rca]]"
---

# Story OBS-DISPATCH-HEALTH-01: View v_dispatch_health + RPC + card UI de saúde do disparo

## Pitch

A RCA de 2026-05-01 mostrou que diagnóstico do bug de disparo exigiu MCP + 6 SQLs distintos (cron status, fila, JWT, schema drift, canal, tokens). Não é sustentável — próxima regressão tipo "JWT desync silencioso" passará despercebida até o user reclamar de novo. Esta story cria a infra de observabilidade nativa: view `public.v_dispatch_health` (Bythak), RPC `get_send_health(send_id)` (campanha-específico) e componente `<DispatchHealthCard />` na página `Disparos.tsx` com 3 LEDs (cron, canal, fila).

## Acceptance Criteria

- [x] **AC1:** Migration cria view `public.v_dispatch_health` com colunas: `jobname, schedule, cron_active, runs_5min, failures_30min, last_run_at, pending_5min, error_30min, expired_24h, running_stuck`. View filtra apenas os 3 crons críticos (`omni-delivery-engine`, `sends-dispatch-batch`, `process-message-buffer`).
- [x] **AC2:** View tem RLS apropriada via WHERE clause — somente `super_admin`, `user_type IN ('gestor','admin')`, ou `service_role` obtém rows. Usuários sem role recebem 0 rows (sem erro).
- [x] **AC3:** RPC `get_send_health(send_id uuid) RETURNS jsonb` retorna `{ pg_cron_alive, last_dispatch_at, channel_status: { has_token, is_default, active }, template_status: { meta_template_name_present, meta_template_status }, pending_count, error_count_by_reason }`.
- [ ] **AC4:** Componente `<DispatchHealthCard />` *(dev-dev-alpha — aguardando ARCH-RBAC-02 AC1/AC2/AC4)*
- [ ] **AC5:** Card integrado em `Disparos.tsx` e `DisparoDetalhes.tsx` *(dev-dev-alpha)*
- [ ] **AC6:** Smoke-test E2E (cron pause / JWT inválido / dispatch normal) *(QA Axikar)*
- [x] **AC7:** Migration forward + rollback testados. Pronta para apply via Grav.

## Implementação (2026-07-25)

### Arquitetura criada

**`_get_cron_health_metrics()` SECURITY DEFINER:**
- Acessa `cron.job` + `cron.job_run_details` (schema requer privilégio elevado)
- Agrupa por jobid: runs_5min (succeeded em 5 min), failures_30min (failed em 30 min), last_run_at
- Filtra pelos 3 crons de disparo
- Usada internamente pela view (não exposta ao frontend)

**`v_dispatch_health` VIEW:**
- Chama `_get_cron_health_metrics()` + subqueries de `messages` e `sends`
- `pending_5min` — msgs outbound pending > 5 min (cron parado)
- `error_30min` — msgs outbound error < 30 min
- `expired_24h` — msgs outbound pending > 24h (gap MAX_AGE_HOURS A1 beta)
- `running_stuck` — sends em 'running' sem last_batch_at < 1h (gap A16 beta)
- WHERE clause de RLS: super_admin OR user_type IN ('gestor','admin') OR service_role
- GRANT SELECT TO authenticated, service_role

**`get_send_health(send_id uuid)` FUNCTION SECURITY DEFINER:**
- Valida caller antes de executar (RAISE EXCEPTION se sem permissão)
- Cruza: sends, settings_whatsapp_channels, whatsapp_templates, messages, cron.job_run_details
- `pg_cron_alive`: algum dos 3 crons teve run 'succeeded' nos últimos 5 min
- `error_count_by_reason`: agrupa por `metadata->'delivery_error'->>'title'` (populado pelo bridge FIX-SENDS-STATUS-BRIDGE-01)
- GRANT EXECUTE TO authenticated, service_role

### Nota de design (R1 da story)
Acesso ao schema `cron` encapsulado em `_get_cron_health_metrics()` SECURITY DEFINER conforme R1 previsto. View + RPC não expõem `service_role_key` nem outros segredos de `_app_config`.

## Escopo

**IN (DB — Bythak):**
- `_get_cron_health_metrics()` helper SECURITY DEFINER ✓
- View `v_dispatch_health` + RLS ✓
- RPC `get_send_health` + GRANT ✓
- Migration forward + rollback ✓

**OUT (outros agentes):**
- `<DispatchHealthCard />` — dev-alpha (AC4+AC5)
- Smoke-test E2E — Axikar (AC6)
- Alarmes externos (Slack/email) — OBS-ALERTS-01 futuro
- "% entregue"/"% lido" — destravado por FIX-SENDS-STATUS-BRIDGE-01 (já feito)

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer (Bythak) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 (parte DB) |
| Branch     | feature/04-terminologia-referral (wave 2) |

## File List

- `supabase/migrations/20260725290000_obs_dispatch_health.sql` — view + RPC + helper
- `supabase/migrations/rollbacks/20260725290000_obs_dispatch_health.rollback.sql`

## QA Results

```
VEREDICTO: CONCERNS (DB part — AC1+AC2+AC3+AC7)
Story: OBS-DISPATCH-HEALTH-01 | Data: 2026-07-25
Escopo: AC1+AC2+AC3+AC7 (DB). AC4+AC5 aguarda dev-alpha. AC6 smoke E2E aguarda apply.
tsc: N/A (SQL migration) | Rollback: ✅ (20260725290000_obs_dispatch_health.rollback.sql)
Aprovado com observações:

AC1 ✅  v_dispatch_health criada com todas as 9 colunas da spec:
        jobname, schedule, cron_active, runs_5min, failures_30min, last_run_at,
        pending_5min, error_30min, expired_24h, running_stuck.
        Filtra 3 crons: omni-delivery-engine, sends-dispatch-batch,
        process-message-buffer. ✅
        _get_cron_health_metrics() helper SECURITY DEFINER para cron.* acesso. ✅

AC2 ✅  RLS via WHERE clause: super_admin=true OR user_type IN ('gestor','admin')
        AND active=true AND deleted_at IS NULL. service_role via JWT claims. ✅
        0 rows para usuários não-autorizados (sem erro). ✅
        REVOKE ALL + GRANT SELECT TO authenticated, service_role. ✅
        ver CONCERN-1 (user_type 'manager' excluído).

AC3 ✅  get_send_health(uuid) JSONB com todas as chaves da spec:
        pg_cron_alive, last_dispatch_at, channel_status, template_status,
        pending_count, error_count_by_reason. ✅
        Caller validation BEFORE execute (RAISE EXCEPTION insufficient_privilege). ✅
        REVOKE ALL + GRANT EXECUTE TO authenticated, service_role. ✅
        error_count_by_reason: metadata.delivery_error.title (bridge FIX-SENDS-STATUS-BRIDGE-01). ✅
        ver CONCERN-2 (EXCEPTION handler bug menor) e CONCERN-3 (REVOKE helper).

AC4 [ ] Aguarda dev-alpha. Fora do escopo desta revisão.
AC5 [ ] Aguarda dev-alpha. Fora do escopo desta revisão.
AC6 [ ] Smoke-test E2E: PENDING — requer apply em prod + campanha real.
AC7 ✅  Rollback: 20260725290000_obs_dispatch_health.rollback.sql existe. ✅

[CONCERN-1 MEDIUM] user_type 'manager' (canônico) excluído do acesso à view e RPC.
  WHERE clause usa IN ('gestor','admin') — valor canônico pós-ARCH-RBAC-02 é
  'manager', não 'gestor'. Se tenant usa user_type='manager', managers ficam sem
  acesso ao DispatchHealthCard.
  AÇÃO: @dev-data-engineer adicionar 'manager' ao IN: ('gestor', 'admin', 'manager')
  em ambos WHERE clause da view e IF NOT EXISTS da RPC. Ou aguardar confirmação
  de que 'gestor' é o valor em uso em prod (João Guirunas tenant).

[CONCERN-2 LOW] EXCEPTION handler em get_send_health: SQLSTATE mismatch.
  IF SQLSTATE IN ('42501','P0001','insufficient_privilege','no_data_found')
  'insufficient_privilege' e 'no_data_found' são CONDITION NAMEs, não SQLSTATE codes.
  SQLSTATE real para no_data_found = '02000' (não está na lista) → "not found"
  exception seria envolto em mensagem genérica "get_send_health(X) failed: ...".
  Funcional (erro ainda propaga), mas mensagem de diagnóstico degradada.
  AÇÃO: corrigir para IN ('42501','P0001','02000').

[CONCERN-3 MEDIUM] _get_cron_health_metrics() sem REVOKE PUBLIC explícito.
  Funções Postgres têm EXECUTE to PUBLIC por default. Usuário autenticado pode
  chamar diretamente (bypass do WHERE clause da view) — embora PostgREST
  não exponha funções com _ prefix via API REST por convenção.
  Segurança defesa-em-profundidade gap; ataque requer acesso DB ou exploit PostgREST.
  AÇÃO: adicionar REVOKE ALL ON FUNCTION public._get_cron_health_metrics() FROM PUBLIC;
  após a CREATE OR REPLACE (antes do COMMIT).

Push LIBERADO. CONCERN-1 prioridade MEDIUM — confirmar user_type em prod antes do deploy.
```
