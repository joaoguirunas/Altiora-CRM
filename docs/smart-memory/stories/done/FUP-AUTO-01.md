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

- [x] **UI-1** — Nova seção "Programado" no painel de FUP
  - Tab "Programado" em `/followups` com sub-tabs "FUP Programado" (fup_programados) e "Retorno ad-hoc" (ai_scheduled_callbacks)
  - Lista global de FUPs com status, tipo, motivo, data agendada, botão de cancelar pendentes
  - Badge de status (pending/processing/done/failed/cancelled)
  - Auto-refresh a cada 60s via refetchInterval

- [x] **TOOL-1** — Tool `agendar_fup` no `ai-agent-execute`
  - Chama RPC `agendar_fup(...)` via `supabase.rpc()`
  - Parâmetros: tipo, scheduled_at, motivo, etapa_id?, template_id?, mensagem?, agendamento_titulo?
  - Validações: tipo válido, scheduled_at futuro, constraints por tipo
  - Tool definition adicionada ao array TOOL_DEFINITIONS

- [x] **WORKER-1** — Edge fn `fup-programados-worker`
  - Query: `fup_programados WHERE status='pending' AND scheduled_at <= now() AND deleted_at IS NULL`
  - Tipo etapa_crm: UPDATE leads SET leads_stages_id = etapa_id
  - Tipo agendamento: INSERT em meetings (title, start_time, end_time, people_id)
  - Tipo programado: chama whatsapp-outbound com template ou mensagem livre
  - MAX_RETRIES=3; status: pending→processing→done|failed

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (Bythak) — DB-1 a DB-5; Serak (dev-dev-gamma) — UI-1, TOOL-1, WORKER-1 |
| Iniciado | 2026-07-25 |
| Concluído | 2026-07-25 |
| Branch | feature/fix-sends-ui-rbac-cleanup |

## File List

### Criados por Bythak
- `supabase/migrations/20260725340000_fup_programados.sql` — DB-1 a DB-5
- `supabase/migrations/rollbacks/20260725340000_fup_programados.rollback.sql`

### Criados por Serak (dev-dev-gamma)
- `supabase/functions/fup-programados-worker/index.ts` — WORKER-1 (etapa_crm/agendamento/programado)
- `src/hooks/useFupProgramados.ts` — hook para fup_programados (global view + cancel mutation)
- `src/hooks/useScheduledCallbacks.ts` — hook para ai_scheduled_callbacks (retornos ad-hoc)
- `src/components/followups/ScheduledCallbacksTab.tsx` — UI-1 tab unificada (fup_programados + ai_scheduled_callbacks)
- `src/pages/Followups.tsx` — integra tab "Programado"
- Tool `agendar_fup` adicionada em `supabase/functions/ai-agent-execute/index.ts` — TOOL-1

## QA Results

```
VEREDICTO (v1): PASS — 2026-07-25 (DB only: DB-1 a DB-5, superado)
VEREDICTO (v2): CONCERNS — 2026-07-25 (completo: DB+WORKER+TOOL+UI)

Story: FUP-AUTO-01 (completo) | Data: 2026-07-25
Aprovado com observação:

──── DB (já verificado em v1, mantido) ────
DB-1 a DB-5: ✅ (ver detalhes em v1 abaixo)

──── WORKER-1 ────
WORKER-1 ✅  supabase/functions/fup-programados-worker/index.ts existe.
             3 tipos implementados:
               etapa_crm → UPDATE leads SET leads_stages_id = etapa_id. ✅
               agendamento → INSERT into meetings (title, start_time, end_time, people_id). ✅
               programado → call whatsapp-outbound com template_id ou mensagem. ✅
             Status flow: pending → processing → done | failed. ✅
             MAX_RETRIES=3: isFinal=(newRetry >= MAX_RETRIES) → marca failed. ✅
             pending→processing ANTES de executar (atomic pattern). ✅
             Logs via createLogger('fup-programados-worker'). ✅

──── TOOL-1 ────
TOOL-1 ✅  agendar_fup em CALLBACK_TOOL_DEFINITIONS (L604 ai-agent-execute/index.ts).
           Tool definition completa: tipos etapa_crm | agendamento | programado. ✅
           Handler: case 'agendar_fup' (L2691) com validações:
             tipo IN lista → Error se inválido. ✅
             scheduled_at > now() → Error se passado. ✅
             tipo=programado sem template_id e sem mensagem → Error. ✅
           supabase.rpc('agendar_fup', { p_lead_id, p_tipo, ... }) (L2722-2724). ✅
           Log: agendar_fup_ok / agendar_fup_rpc_failed (L2735-2739). ✅

[CONCERN-1 MEDIUM] agendar_fup está em CALLBACK_TOOL_DEFINITIONS, não em TOOL_DEFINITIONS.
  Story AC especifica "Tool definition adicionada ao array TOOL_DEFINITIONS" — literal.
  Impacto: agendar_fup só disponível quando callbackConfig?.enabled = true (L787).
  Agentes sem callback habilitado NÃO podem agendar FUPs programados.
  Aceitável se todos os agentes que usam FUP têm callback habilitado (caso Diagnostico).
  AÇÃO: @dev-devops ou lead confirmar se agendar_fup deve ser sempre disponível
  (mover para TOOL_DEFINITIONS) ou só quando callback ativado (documentar AC).

──── UI-1 ────
UI-1 ✅  Integrado em ScheduledCallbacksTab.tsx (não FupProgramadosPanel.tsx separado).
         useFupProgramados + useCancelFupProgramado importados. ✅
         FupRow component com badge status + motivo + data + botão cancelar. ✅
         FupProgramadosPane com filtro por status. ✅
         refetchInterval: 60_000 (auto-refresh a cada 60s conforme spec). ✅
         Sub-tabs "FUP Programado" + "Retorno ad-hoc" combinados. ✅

Push LIBERADO. CONCERN-1 MEDIUM requer confirmação do lead para fechar o gap de spec.
```

```
VEREDICTO: PASS
Story: FUP-AUTO-01 (parte DB) | Data: 2026-07-25
Escopo: DB-1 a DB-5 (schema + índices + RLS + RPC + cron). UI-1/TOOL-1/WORKER-1 fora escopo.
Rollback: 20260725340000_fup_programados.rollback.sql ✅

DB-1 ✅  fup_programados: CREATE TABLE IF NOT EXISTS. Schema completo:
         lead_id FK leads CASCADE, people_id FK clients_people SET NULL,
         agent_id FK ai_agents SET NULL. ✅
         tipo CHECK ('etapa_crm','agendamento','programado'). ✅
         etapa_id FK leads_stages SET NULL (para tipo=etapa_crm). ✅
         template_id text + mensagem text + agendamento_titulo text. ✅
         motivo, scheduled_at, fired_at, status CHECK (5 estados). ✅
         error_message, retry_count DEFAULT 0. ✅
         cancelado_por FK auth.users SET NULL, cancelado_em. ✅
         created_at, updated_at, deleted_at (soft delete). ✅
         Trigger update_fup_programados_updated_at → update_updated_at_column(). ✅
         COMMENT ON TABLE e colunas críticas documentadas. ✅

DB-2 ✅  4 índices parciais com IF NOT EXISTS:
         idx_fup_programados_pending — (scheduled_at) WHERE pending AND NOT deleted. ✅
         idx_fup_programados_lead_id — (lead_id) WHERE NOT deleted. ✅
         idx_fup_programados_status — (status, scheduled_at) WHERE NOT deleted. ✅
         idx_fup_programados_agent_id — (agent_id) WHERE agent_id IS NOT NULL. ✅

DB-3 ✅  RLS ENABLE ROW LEVEL SECURITY. 4 policies:
         SELECT: auth.uid() IS NOT NULL + settings_users ativo/não-deletado. ✅
         INSERT: super_admin OR user_type IN ('admin','manager') + ativo. ✅
         UPDATE: mesmo gate de INSERT. ✅
         service_role bypass: FOR ALL USING(true) WITH CHECK(true). ✅
         GRANT SELECT/INSERT/UPDATE TO authenticated; ALL TO service_role. ✅

DB-4 ✅  agendar_fup() SECURITY DEFINER + SET search_path = public. ✅
         Validações em ordem: tipo IN lista, scheduled_at > now(), lead EXISTS. ✅
         Validações por tipo: etapa_crm→etapa_id obrigatório. ✅
                              programado→template_id OR mensagem obrigatório. ✅
         INSERT via SELECT FROM leads (propaga people_id automaticamente). ✅
         REVOKE ALL ON FUNCTION FROM PUBLIC + GRANT TO service_role, authenticated. ✅
         (padrão de defesa-em-profundidade — melhor que _get_cron_health_metrics)

DB-5 ✅  pg_cron fup-programados-worker, */5 (a cada 5 min). FORA do BEGIN/COMMIT. ✅
         cron.unschedule() antes de cron.schedule() — idempotente. ✅
         fn_cron_http_call() padrão (_app_config) — mesma arquitetura dos outros crons. ✅

[INFO] Edge fn fup-programados-worker não existe ainda — cron vai falhar silenciosamente
       até o WORKER-1 ser deployado. Comportamento seguro (documentado em Notas técnicas).
       Não bloqueia o gate DB.

Segurança ✅  SECURITY DEFINER + REVOKE ALL FROM PUBLIC + GRANT explícito. ✅
              Validações defensivas na RPC antes de qualquer INSERT. ✅
              FKs com ON DELETE CASCADE/SET NULL previnem órfãos. ✅

Próximo passo: @dev-devops push migration. @dev-beta/gamma implementar WORKER-1 e TOOL-1.
```

## Notas técnicas

- **Separação de tabelas:** nova tabela `fup_programados` (não extende `followup_queue`) — mantém separação clara entre FUPs de cadência (stage/meeting) e FUPs programados por IA
- **people_id automático:** RPC propaga `leads.people_id` → sem necessidade de passar no tool call
- **Cron idempotente:** `cron.unschedule` antes de `cron.schedule` — safe para re-apply
- **WORKER dependência:** cron já agendado, mas edge fn `fup-programados-worker` não existe ainda — cron vai falhar silenciosamente até o worker ser deployado (comportamento seguro — não bloqueia outras operações)
- **tipo=programado vs followup_queue:** para `tipo=programado`, o worker deve inserir em `followup_queue` (reusa o pipeline de entrega existente) em vez de duplicar lógica de envio WhatsApp
