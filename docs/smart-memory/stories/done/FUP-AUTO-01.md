---
id: FUP-AUTO-01
title: FUP Programado — Agendamento automático de follow-up via agente IA
status: done
wave: 2
priority: medium
created: 2026-05-03
updated: 2026-07-25
tags: [story, fup, agente-ia, cron, schema, done]
---

# FUP-AUTO-01 — FUP Programado via agente IA

## Objetivo
Permitir que o agente IA agende FUPs programados (etapa_crm / agendamento / programado) sem intervenção humana, via tool `agendar_fup`.

## Acceptance Criteria — Status

### ✅ DB (Bythak — concluído 2026-07-25)

- [x] **DB-1** — Tabela `fup_programados`
  - `id`, `lead_id` FK leads CASCADE, `people_id` FK clients_people SET NULL
  - `agent_id` FK ai_agents SET NULL (rastreia qual agente agendou)
  - `tipo` CHECK (etapa_crm | agendamento | programado)
  - `etapa_id` FK leads_stages SET NULL (para tipo=etapa_crm)
  - `template_id` text (para tipo=programado)
  - `mensagem` text (para tipo=programado ou agendamento)
  - `agendamento_titulo` text (para tipo=agendamento)
  - `motivo` text (contexto da conversa)
  - `scheduled_at`, `fired_at`, `status` CHECK (pending/processing/done/failed/cancelled)
  - `error_message`, `retry_count`, `cancelado_por`, `cancelado_em`
  - `created_at`, `updated_at` (trigger), `deleted_at` (soft delete)

- [x] **DB-2** — Índices
  - `idx_fup_programados_pending` — (scheduled_at) WHERE status='pending' AND deleted_at IS NULL
  - `idx_fup_programados_lead_id` — (lead_id) WHERE deleted_at IS NULL
  - `idx_fup_programados_status` — (status, scheduled_at) WHERE deleted_at IS NULL
  - `idx_fup_programados_agent_id` — (agent_id) WHERE agent_id IS NOT NULL AND deleted_at IS NULL

- [x] **DB-3** — RLS (4 policies)
  - SELECT: authenticated + settings_users ativo
  - INSERT: admin/manager ou service_role
  - UPDATE: admin/manager ou service_role
  - ALL: service_role bypass (worker lê e atualiza sem JWT de usuário)
  - GRANT SELECT/INSERT/UPDATE TO authenticated; ALL TO service_role

- [x] **DB-4** — RPC `agendar_fup()` SECURITY DEFINER
  - Parâmetros: lead_id, tipo, scheduled_at, etapa_id?, template_id?, mensagem?, agendamento_titulo?, motivo?, agent_id?
  - Validações: tipo válido, scheduled_at futuro, lead existe, constraints por tipo (etapa_crm→etapa_id, programado→template_id ou mensagem)
  - Propaga `people_id` do lead automaticamente
  - GRANT EXECUTE TO service_role, authenticated
  - Retorna: uuid do FUP criado

- [x] **DB-5** — pg_cron `fup-programados-worker` (*/5 * * * *)
  - Padrão `fn_cron_http_call('fup-programados-worker', 'fup-programados-cron')`
  - Edge fn `fup-programados-worker` a ser implementada por dev-beta/gamma

### ⏳ Pendente (dev-beta/gamma/alpha)

- [ ] **UI-1** — Nova seção "Programado" no painel de FUP
  - Lista FUPs programados do lead (query `fup_programados WHERE lead_id = ?`)
  - Formulário para admin criar FUP manual (tipo, data, template/mensagem/etapa)
  - Badge de status (pending/done/failed)

- [ ] **TOOL-1** — Tool `agendar_fup` no `ai-agent-execute`
  - Chama RPC `agendar_fup(...)` via supabase client
  - Parâmetros: data, tipo, mensagem|template_id|etapa_id
  - Integração com lógica de `bloquear_ia` para timing inadequado

- [ ] **WORKER-1** — Edge fn `fup-programados-worker`
  - Query: `SELECT * FROM fup_programados WHERE status='pending' AND scheduled_at <= now() AND deleted_at IS NULL`
  - Para cada FUP: UPDATE status='processing', executa ação por tipo, UPDATE status='done'/'failed'
  - Tipo etapa_crm: UPDATE leads SET leads_stages_id = etapa_id
  - Tipo agendamento: INSERT em meetings ou chama criar_agendamento
  - Tipo programado: INSERT em followup_queue (reusa pipeline existente)

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (Bythak) — DB-1 a DB-5 |
| Iniciado | 2026-07-25 |
| Concluído (parte DB) | 2026-07-25 |
| Branch | feature/04-terminologia-referral |

## File List

### Criados por Bythak
- `supabase/migrations/20260725340000_fup_programados.sql` — DB-1 a DB-5
- `supabase/migrations/rollbacks/20260725340000_fup_programados.rollback.sql`

### Pendente (dev-beta/gamma/alpha)
- `supabase/functions/fup-programados-worker/index.ts` — WORKER-1
- `src/components/followup/FupProgramadosPanel.tsx` — UI-1
- Integração tool `agendar_fup` em `ai-agent-execute` — TOOL-1

## Notas técnicas

- **Separação de tabelas:** nova tabela `fup_programados` (não extende `followup_queue`) — mantém separação clara entre FUPs de cadência (stage/meeting) e FUPs programados por IA
- **people_id automático:** RPC propaga `leads.people_id` → sem necessidade de passar no tool call
- **Cron idempotente:** `cron.unschedule` antes de `cron.schedule` — safe para re-apply
- **WORKER dependência:** cron já agendado, mas edge fn `fup-programados-worker` não existe ainda — cron vai falhar silenciosamente até o worker ser deployado (comportamento seguro — não bloqueia outras operações)
- **tipo=programado vs followup_queue:** para `tipo=programado`, o worker deve inserir em `followup_queue` (reusa o pipeline de entrega existente) em vez de duplicar lógica de envio WhatsApp
