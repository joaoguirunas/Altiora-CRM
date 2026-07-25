---
title: "Story FWUP-06: Implementar retry e dead-letter em followup_queue"
type: story
status: backlog
epic: FWUP
complexity: M
priority: P1
agent: dev-data-engineer + dev-dev-beta
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, queue, reliability, p1]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-03]]"]
---

# Story FWUP-06: Implementar retry e dead-letter em followup_queue

## Objetivo
Eliminar o estado de "queued forever" em `followup_queue`: hoje, se o N8N não chamar `followup-status-callback` após receber o disparo, o registro fica em `status='queued'` indefinidamente sem retry — campanhas paradas sem visibilidade.

## Acceptance Criteria
- [ ] **AC1:** Edge function nova `followup-retry-worker` (cron, a cada 10 min) lê `followup_queue` onde `status='queued' AND updated_at < now() - interval '15 min' AND retry_count < 3`.
- [ ] **AC2:** Para cada registro elegível, incrementa `retry_count`, atualiza `updated_at = now()`, status volta a `pending`, e dispara `followup-trigger-worker` novamente.
- [ ] **AC3:** Após `retry_count = 3`, marca `status='failed'`, escreve `error_message` em `response_data` e gera evento em `adm_audit_log` (ou `crm_audit_log` se for tenant-local).
- [ ] **AC4:** UI em algum painel admin (existing ou novo card no CallProFollowupsConfig) lista entries com `status='failed'` para inspeção manual.
- [ ] **AC5:** `pg_cron` job registrado para rodar `followup-retry-worker` a cada 10 minutos.
- [ ] **AC6:** Mesmo padrão aplicado a `meeting_followup_queue` (espelhar `process-meeting-followups` retry path).
- [ ] **AC7:** Teste manual: enfileirar followup, simular N8N down (desconectar webhook), verificar que após 15min o registro volta a `pending` e tenta de novo; após 3 tentativas vai para `failed`.

## Escopo

**IN:**
- Nova edge function `followup-retry-worker`
- Atualizar `followup-trigger-worker` para aceitar re-execução (idempotência)
- Migration registrando `pg_cron` job
- Aplicar padrão em `meeting_followup_queue` também
- UI mínima de visualização de entries `failed`
- Espelhar pattern de `omni-retry-dead-letter` (já existente no domínio OMNI)

**OUT:**
- Backoff exponencial sofisticado (retry simples linear basta para v1)
- Notificação por email/slack de entries `failed` (futuro)
- Lógica de retry com janelas de horário comercial

## Contexto Técnico

**Arquivos afetados:**
- `supabase/functions/followup-retry-worker/` — novo
- `supabase/functions/followup-trigger-worker/index.ts` — idempotência
- `supabase/functions/process-meeting-followups/index.ts` — espelhar padrão
- `supabase/migrations/` — pg_cron job + colunas de retry se faltarem
- `src/components/config/CallProFollowupsConfig.tsx` — card de visualização

**Padrão existente:** `omni-retry-dead-letter` em `supabase/functions/` faz exatamente isso para messages do OMNI. Reusar estrutura.

**Bloqueado por:** FWUP-03 (schema canônico de `leads_stages_followups`) e FWUP-02 (estabilização de `meetings_followups`). Sem essas, o retry pode mascarar problemas de schema.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main |

## File List

- `supabase/functions/followup-retry-worker/index.ts` — nova edge function (AC1, AC2, AC3, AC5)
- `supabase/functions/process-meeting-followups/index.ts` — retry path para meeting_followup_queue (AC6)
- `supabase/migrations/20260427040000_fwup06_followup_retry_worker_cron.sql` — pg_cron + retry_count em meeting_followup_queue (AC5, AC6)
- `supabase/migrations/rollbacks/20260427040000_fwup06_followup_retry_worker_cron.rollback.sql` — rollback
- `src/components/config/CallProFollowupsConfig.tsx` — card de failed entries colapsável (AC4)

**AC checklist:**
- [x] AC1: followup-retry-worker lê status='queued' AND updated_at < now()-15min AND retry_count < 3
- [x] AC2: incrementa retry_count, updated_at=now(), status→pending, reinvoca followup-trigger-worker
- [x] AC3: retry_count=3 → status='failed', response_data com erro, evento em adm_audit_log
- [x] AC4: card colapsável em CallProFollowupsConfig listando entries failed de followup_queue
- [x] AC5: pg_cron job 'followup-retry-worker' a cada 10 minutos via secure_http_post
- [x] AC6: process-meeting-followups tem retry loop para meeting_followup_queue stale (+ migration adicionando retry_count)
- [ ] AC7: teste manual (requer ambiente com N8N)

## QA Results

```
VEREDICTO: CONCERNS
Story: FWUP-06 | Data: 2026-04-27 | Auditor: Axikar
Aprovado com observações:
- [MEDIUM] AC7 (teste manual com N8N down) NÃO foi executado. Lógica de retry não validada end-to-end. Recomendar:
  (a) Executar teste de campo em staging — enfileirar followup, simular timeout, verificar retry path; OU
  (b) Criar smoke test automatizado simulando timeout. Aceitável dada complexidade do setup, mas alta prioridade antes de incidente real.
Verificações:
- Edge function `supabase/functions/followup-retry-worker/index.ts` existe.
- Migration 20260427040000_fwup06 adiciona retry_count em meeting_followup_queue (idempotente), cria índices idx_mfq_retry e idx_fup_queue_retry, define trigger_followup_retry_worker() usando secure_http_post (ADR-SP-05).
- pg_cron job 'followup-retry-worker' registrado com schedule */10 * * * *.
- AC1-AC6 cumpridos via código + migration.
Próximo passo: @dev-devops push (planejar teste de campo AC7 em sprint seguinte)
```
