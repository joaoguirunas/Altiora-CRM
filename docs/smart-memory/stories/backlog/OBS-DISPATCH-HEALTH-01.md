---
title: "Story OBS-DISPATCH-HEALTH-01: View v_dispatch_health + RPC + card UI de saúde do disparo"
type: story
status: backlog
priority: P3
complexity: M
agent: dev-architect
created: 2026-05-01
updated: 2026-05-10
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

## Objetivo

Tornar o estado de saúde do pipeline de disparo (crons, fila de mensagens, canais WhatsApp, JWT em `_app_config`) visível em tempo real na UI — sem exigir acesso MCP ou conhecimento de SQL — para que falhas sejam detectadas e diagnosticadas em <1min em vez de horas/dias.

## Contexto Técnico

**Histórico que motivou a story:**
- Bug de disparo João Guirunas (2026-04-30 → 2026-05-01): `_app_config.service_role_key` desincronizado do Vault → ambos crons retornavam 401 silenciosamente. Mensagens travadas em `pending` por 13+ horas. User reclamou; investigação tomou 6 SQLs + 3 agentes.
- Beta (`2026-05-01-sends-edge-fns-audit` §A16): `sends-dispatch-batch:120-124` cataloga erro do fetch em `errors[]` mas **nunca marca o `send` como failed**. Campanha "fica running" indefinidamente sem alarme.
- Beta §A1: `MAX_AGE_HOURS=24` no `omni-delivery-engine` corta mensagens silenciosamente sem dead-letter.
- Bythak ([[../../agents/data-engineer/sends-pro-db-state]] §"Observabilidade contínua"): propôs view `public.v_dispatch_health` com colunas básicas dos crons.
- Gamma (`2026-05-01-sends-frontend-audit` §M4): falta painel de saúde por campanha agregando estado de cron + canal + msgs pendentes.

**Componentes a criar:**

### 1. View `public.v_dispatch_health` (Bythak)
Agrega estado dos 3 crons críticos e métricas de fila:
- `jobname, schedule, active` (de `cron.job`).
- `runs_5min, failures_30min, last_run_at` (de `cron.job_run_details`).
- `pending_5min` — `count(*) FROM messages WHERE status='pending' AND created_at < now() - 5min AND from_contact <> 'cliente'`.
- `error_30min` — `count(*) FROM messages WHERE status='error' AND created_at > now() - 30min AND from_contact <> 'cliente'`.
- `expired_24h` — `count(*) FROM messages WHERE status='pending' AND created_at < now() - 24h AND from_contact <> 'cliente'` (atinge gap A1 do beta).
- `running_stuck` — `count(*) FROM sends WHERE status='running' AND last_batch_at < now() - 1h` (atinge gap A16 do beta).

### 2. RPC `get_send_health(send_id uuid)` (Bythak)
Retorna JSON `{ pg_cron_alive, last_dispatch_at, channel_status, template_status, pending_count, error_count_by_reason }` para a campanha específica. Consumível via `supabase.rpc('get_send_health', { send_id })` — sem precisar de N queries no frontend.

### 3. Componente `<DispatchHealthCard />` (Aria)
Renderizado em `src/pages/Disparos.tsx` (lista) e `src/pages/DisparoDetalhes.tsx` (detalhe da campanha):
- 3 LEDs: cron (verde se `runs_5min >= 4`), canal (verde se `access_token` presente e `is_default OR active`), fila (verde se `pending_5min < 10`).
- Click no LED → modal expansível com detalhes (último run, último erro, link para Settings → Canais).
- Refresh a cada 30s via `useQuery` ou `Realtime` em `_app_config` se viável.

**Constraints:**
- View precisa de RLS apropriada — `super_adm` OR `tenant_owner`. Não vazar `service_role_key` length nem hash.
- RPC `SECURITY DEFINER` com `SET search_path = public` (padrão do projeto).
- Frontend não pode chamar `pg_proc`/`cron.*` direto — apenas via view/RPC.

## Acceptance Criteria

- [ ] **AC1:** Migration cria view `public.v_dispatch_health` com colunas: `jobname, schedule, active, runs_5min, failures_30min, last_run_at, pending_5min, error_30min, expired_24h, running_stuck`. View filtra apenas os 3 crons críticos (`omni-delivery-engine`, `sends-dispatch-batch`, `process-message-buffer`) na coluna `jobname`.
- [ ] **AC2:** View tem RLS apropriada — somente `super_adm` ou usuário com `crm_user_roles.role IN ('owner','manager')` pode `SELECT`. Service role acessa irrestrito (uso interno de RPC).
- [ ] **AC3:** RPC `get_send_health(send_id uuid) RETURNS jsonb` retorna `{ pg_cron_alive, last_dispatch_at, channel_status: { has_token, is_default, active }, template_status: { meta_template_name_present, meta_template_status }, pending_count, error_count_by_reason }`. Cruzando `sends`, `settings_whatsapp_channels`, `whatsapp_templates`, `messages`, `cron.job_run_details`. RLS valida que o caller tem acesso ao `send_id`.
- [ ] **AC4:** Componente `<DispatchHealthCard />` em `src/components/disparos/DispatchHealthCard.tsx` renderiza:
  - 3 LEDs (cron / canal / fila) com cores verde/amarelo/vermelho.
  - Tooltip por LED com métrica detalhada.
  - Click expande modal com `last_run_at`, `error_30min`, link para `/settings/canais` se canal vermelho.
  - Auto-refresh 30s via `useQuery` (`refetchInterval: 30000`).
- [ ] **AC5:** Card integrado em:
  - `src/pages/Disparos.tsx` — versão compacta no topo da lista (consumindo view).
  - `src/pages/DisparoDetalhes.tsx` — versão expandida com `get_send_health(send_id)` chamada para o `send` corrente.
- [ ] **AC6:** Smoke-test E2E:
  - Rodar dispatch normal → card vai para verde em <1min.
  - Pausar cron manualmente (`SELECT cron.alter_job(jobid, active := false)`) → card vai para vermelho em <1min.
  - Setar `_app_config.service_role_key` com valor inválido → LED de cron amarelo (warning de auth) em ≤30s.
- [ ] **AC7:** Migration forward + rollback testados. Adicionada ao `client-migrations.json` na ordem cronológica.

## Escopo

**IN:**
- View `v_dispatch_health` + RPC `get_send_health` + RLS.
- Componente `<DispatchHealthCard />` em duas variantes (compacta + expandida).
- Integração em `Disparos.tsx` e `DisparoDetalhes.tsx`.
- Migration forward + rollback.
- Smoke-test E2E manual com 3 cenários acima.

**OUT:**
- Alarmes externos (Slack/email) — fica para `OBS-ALERTS-01` se for prioridade futura.
- Métrica de "% entregue" / "% lido" — depende de `FIX-SENDS-STATUS-BRIDGE-01` ter destravado os dados primeiro.
- Banner global "Cron offline há > 5min" no `DashLayout` (gap M4 do audit gamma — bom mas escopo cresce, fica para sweep posterior).
- Histórico/timeline de saúde além do agora (sem persistência de séries temporais — view é stateless).
- Mobile responsivo do card (segue padrão do projeto, não precisa de design específico).

## Dependências e riscos

**Dependências:**
- `cron.job` e `cron.job_run_details` precisam estar acessíveis ao role da view — requer GRANT SELECT do schema `cron` ao role `authenticator` ou usar `SECURITY DEFINER` na view.
- `_app_config` já existe e é a fonte canônica — confirmado em [[../../agents/data-engineer/sends-pro-db-state]].

**Riscos:**
- **R1 (médio):** acessar `cron.*` direto via view requer escalar privilégio para `postgres` ou usar função `SECURITY DEFINER` que encapsula a query. View pura `CREATE VIEW ... SELECT FROM cron.job` falha por permissão padrão Supabase. Solução: criar função `_get_cron_health()` `SECURITY DEFINER` e a view fazer `SELECT * FROM _get_cron_health()`.
- **R2 (baixo):** auto-refresh 30s × N usuários abertos = carga em `cron.job_run_details`. Aceitável para MVP single-tenant. Cache em vista materializada se virar problema.
- **R3 (baixo):** RLS na view precisa cuidado — `cron.*` é cross-tenant em projetos multi-tenant; em single-tenant João Guirunas isso é trivial mas o template fica registrado para reuso.
- **R4 (médio):** `get_send_health(send_id)` cruza 5 tabelas + 1 schema externo (`cron`). Se não indexado bem (ex: `cron.job_run_details(jobid, start_time)`), pode lentar. Bythak avalia índices necessários.

## Owner sugerido

- **Implementação backend (view + RPC + RLS + migration):** `dev-data-engineer` (Bythak) — proposta original veio dele.
- **Implementação frontend (card + integração):** `dev-dev-alpha` (Aria) — territory em `Disparos.tsx`.
- **QA:** `dev-qa` (Axikar) — gate report + 3 smoke-tests E2E (cron pause, JWT inválido, dispatch normal).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
