---
title: "Story FIX-SENDS-STATUS-BRIDGE-01: Bridge de delivered/read da Meta para sends_contacts"
type: story
status: backlog
priority: P1
complexity: M
agent: dev-architect
created: 2026-05-01
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
tags: [story, sends-pro, omni-pro, whatsapp, webhook, status-tracking, observability]
related:
  - "[[../../agents/research/sends-status-callback-analysis]]"
  - "[[../../agents/research/2026-05-01-sends-disparo-rca]]"
  - "[[../../agents/research/sends-pro-dispatch-flow]]"
  - "[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]"
---

# Story FIX-SENDS-STATUS-BRIDGE-01: Bridge de delivered/read da Meta para sends_contacts

## Pitch

Bridge no `whatsapp-inbound` para capturar `statuses[]` da Meta → atualizar `messages.status` (`delivered`/`read`/`failed`) e propagar para `sends_contacts.delivered_at`/`read_at` via trigger SQL `AFTER UPDATE OF status ON messages`. Resolve o gap empiricamente confirmado em 2026-05-01T18:08 (campanha `eduteste1`: user recebeu mensagem real, mas `sends_contacts.delivered_at=NULL` no banco). Sem mudança no Meta Business Manager.

## Objetivo

Fechar o loop de tracking de entrega de campanhas WhatsApp: cada `delivered`/`read`/`failed` recebido pela Meta deve refletir em `messages` e propagar para `sends_contacts`, destravando dashboards de "% entregue" e "% lido" que hoje ficam zerados em 100%.

## Contexto Técnico

**Estado atual (gap confirmado):**
- `whatsapp-inbound/index.ts:512-515` descarta payloads com `statuses[]` (`if (!payload.messages?.length) return 200`).
- `send-status-callback` é edge fn órfã (zero callers em runtime) — não é chamada nem por código interno nem por webhook externo.
- `messages.status` em outbound de campanha avança apenas `pending → sending → sent`. Nunca atinge `delivered`/`read`.
- `sends_contacts.status` trava em `sent` (escrito por `send-dispatch-worker` ao enfileirar — semântica errada). `delivered_at`/`read_at` sempre `NULL`.

**Recomendação técnica (Opção A em [[../../agents/research/sends-status-callback-analysis]] §9):**
- Adicionar branch antes do filter da linha 513 do `whatsapp-inbound`: para cada item em `payload.statuses[]`, fazer `UPDATE messages SET status, delivered_at|read_at WHERE wa_message_id = s.id`.
- Trigger SQL `AFTER UPDATE OF status ON messages` que, quando `source_type='campaign'`, deriva `send_id = module_ref_id` e propaga para `sends_contacts` por `(send_id, people_id)`.
- Idempotência: respeitar `STATUS_RANK` (`pending<sent<delivered<read`) para bloquear regressão de status.
- `send-status-callback` marcada como `deprecated` (remoção em story de cleanup posterior).

**Módulos afetados:**
- `supabase/functions/whatsapp-inbound/index.ts` (~30 linhas TS adicionadas).
- `supabase/migrations/2026XXXXXXXXXX_messages_status_to_sends_trigger.sql` (1 trigger SQL + função PL/pgSQL).
- (opcional) `supabase/functions/send-status-callback/index.ts` (header de deprecation).

**Pré-requisitos:**
- Confirmar que `messages.delivered_at` e `messages.read_at` existem no schema atual. Se não existirem, migration adiciona as colunas antes do trigger. Bythak verifica via SQL `information_schema.columns`.
- `sends_contacts.delivered_at` e `read_at` já existem (módulo SENDS PRO).

**Constraints:**
- Webhook único da Meta (`whatsapp-inbound`) processa tanto `messages[]` quanto `statuses[]` — não tentar configurar endpoint dedicado (Meta BM permite apenas 1 webhook por produto).
- HMAC-SHA256 signature já é validada no `whatsapp-inbound` antes de qualquer branch — bridge entra após auth.

## Acceptance Criteria

- [ ] **AC1:** `whatsapp-inbound` deixa de descartar payloads com `statuses[]`. Linhas 512-515 do código atual passam a entrar em branch dedicado quando `payload.statuses?.length > 0`.
- [ ] **AC2:** Para cada item de `statuses[]`, faz `UPDATE messages SET status, [delivered_at|read_at]` usando lookup por `wa_message_id = statuses[i].id`. Mapping: `delivered → delivered_at=now()`, `read → read_at=now()`, `failed → metadata.last_error`.
- [ ] **AC3:** Trigger SQL `AFTER UPDATE OF status ON messages` propaga para `sends_contacts` (`UPDATE status, delivered_at, read_at, error_message`) quando `source_type='campaign'`, derivando `send_id = module_ref_id` (já é `uuid` pós-migration FWUP-15) e `people_id = messages.people_id`.
- [ ] **AC4:** Idempotência via `STATUS_RANK`: trigger só atualiza `sends_contacts.status` se o novo status for de rank superior ao atual (impede regressão `read → delivered`).
- [ ] **AC5:** Smoke-test: disparar campanha de 1 contato (igual a `eduteste1` 2026-05-01T18:08) → após Meta entregar, conferir que `sends_contacts.delivered_at IS NOT NULL` em até 60s. Quando user lê: `read_at IS NOT NULL`.
- [ ] **AC6:** `send-status-callback` ganha header `// @deprecated — superseded by FIX-SENDS-STATUS-BRIDGE-01` e é removida do `SystemDocConfig.tsx:edgeFunctions[]`. Remoção física da edge fn fica em story de cleanup separada.
- [ ] **AC7:** Rollback `2026XXXXXXXXXX_rollback.sql` testado: derruba o trigger e reverte `whatsapp-inbound` ao comportamento antigo via revert de commit.

## Escopo

**IN:**
- Branch de `statuses[]` em `whatsapp-inbound`.
- Trigger SQL `messages → sends_contacts` para `source_type='campaign'`.
- Migration forward + rollback testados.
- Header de deprecation em `send-status-callback`.
- Smoke-test E2E com campanha de 1 contato.

**OUT:**
- UI de "% entregue" / "% lido" em `Disparos.tsx` (consumirá os dados destravados, mas é story separada — `OBS-DISPATCH-HEALTH-01` pode incluir).
- Remoção física do arquivo `send-status-callback/index.ts` (story de cleanup).
- Tracking de status para mensagens não-campanha (chats normais do OMNI). Se trigger ficar genérico, OK; se exigir lógica diferenciada, fica fora de escopo.
- Reconciliação histórica de mensagens já enviadas com `delivered_at=NULL` (forward-only).

## Dependências e riscos

**Dependências:**
- Schema de `messages` precisa expor `delivered_at` / `read_at`. Se faltar coluna, migration prévia (incluída na mesma story).
- `module_ref_id` em `messages` deve estar `uuid` (já corrigido pela migration `20260317000000_fix_claim_pending_messages_types.sql` — válido em João Guirunas).

**Riscos:**
- **R1 (médio):** trigger pode disparar em volume alto (100+ msgs/min em campanhas grandes). Mitigação: `WHEN (NEW.status IS DISTINCT FROM OLD.status)` no trigger + índice em `messages(wa_message_id)` se ainda não existir.
- **R2 (baixo):** mensagens sem `wa_message_id` populado (falhas pré-Meta) não são pegas pelo bridge — comportamento correto. Não regride.
- **R3 (baixo):** ordem de chegada de webhooks Meta pode ser fora de ordem (ex: `read` antes de `delivered`). `STATUS_RANK` resolve via idempotência — read implica delivered.
- **R4 (médio):** `sends_contacts` pode não ter linha para `(send_id, people_id)` se contato foi removido manualmente. Trigger faz `UPDATE` (no-op se não existe) — não cria linhas. Aceitável.

## Owner sugerido

- **Implementação edge fn:** `dev-dev-beta` (Rex) — `whatsapp-inbound` é território dele.
- **Implementação trigger SQL:** `dev-data-engineer` (Bythak) — migration + rollback + smoke-test SQL.
- **QA:** `dev-qa` (Axikar) — gate report com 5-point checklist + smoke E2E real.

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
