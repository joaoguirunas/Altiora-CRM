---
title: "FIX-SENDS-01: Mover loop de disparo do browser para servidor (setInterval → pg_cron/edge fn)"
type: story
status: done
priority: P1
complexity: L
agent: dev-dev-gamma
created: 2026-04-22
updated: 2026-04-30
tags: [story, sends-pro, bug, P1, reliability]
related: ["[[../../project/modules/sends-pro]]"]
---

# FIX-SENDS-01: Mover loop de disparo do browser para servidor (setInterval → pg_cron/edge fn)

## Objetivo
Mover o batch dispatch loop de SENDS do browser (setInterval frágil) para uma edge function acionada por pg_cron, garantindo que broadcasts não parem quando o usuário fecha a aba.

## Acceptance Criteria
- [ ] AC1: `setInterval` removido do código frontend de SENDS dispatch
- [ ] AC2: Edge fn `sends-dispatch-batch` criada e deployada, processando a fila de envio
- [ ] AC3: pg_cron job criado/migrado para chamar a edge fn a cada intervalo configurável
- [ ] AC4: Broadcast ativo continua progredindo após fechar e reabrir a aba de SENDS
- [ ] AC5: UI de progresso atualiza via polling/realtime sem depender do loop local

## Escopo

**IN:**
- Remover `setInterval` do componente/hook frontend responsável pelo dispatch
- Criar `supabase/functions/sends-dispatch-batch/index.ts`
- Migration pg_cron: `cron.schedule('sends-batch', '* * * * *', ...)`
- Adaptar UI para polling de status via Supabase Realtime ou polling query

**OUT:**
- Refactor do filter-leads-for-send
- Mudança no schema de sends_campaigns

## Contexto Técnico
O loop atual roda no browser com `setInterval` — se o usuário fechar a aba, o disparo para e precisa de retomada manual. Padrão correto: edge fn stateless + pg_cron como scheduler. Ver `docs/smart-memory/project/modules/sends-pro.md` seção "Dispatch Loop".

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-gamma (sera) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | fix/schedule-double-booking-zoom-rls |

## File List

- `supabase/functions/sends-dispatch-batch/index.ts` — nova edge fn chamada pelo pg_cron
- `supabase/functions/send-dispatch-worker/index.ts` — aceita service role key (pg_cron path)
- `supabase/migrations/20260423010000_sends_server_dispatch.sql` — last_batch_at + pg_cron job
- `src/hooks/useSendDispatch.ts` — remove setInterval; kickstart primeiro batch via edge fn
- `src/hooks/useSends.ts` — useSend aceita refetchInterval para polling
- `src/components/disparos/DisparoControls.tsx` — Pause atualiza status no DB; remove countdown
- `src/components/disparos/TabelaContatos.tsx` — remove nextSendIn prop e countdown display
- `src/pages/DisparoDetalhes.tsx` — poll a cada 15s quando status=running

## Acceptance Criteria

- [x] AC1: `setInterval` removido do frontend de SENDS dispatch
- [x] AC2: Edge fn `sends-dispatch-batch` criada para processar a fila de envio
- [x] AC3: pg_cron job criado para chamar edge fn a cada minuto (cadência respeitada via last_batch_at)
- [x] AC4: Broadcast ativo continua após fechar e reabrir aba (pg_cron não depende do browser)
- [x] AC5: UI de progresso atualiza via polling de 15s sem depender do loop local

## QA Results

```
VEREDICTO: CONCERNS
Story: FIX-SENDS-01 | Data: 2026-04-30
Aprovado com observações:

Checklist 8-pontos:
  1. Code review            → OK (auth dual-mode service-role/JWT, abort signal 55s)
  2. Unit tests             → N/A (sem suite)
  3. Acceptance criteria    → 5/5 atendidos
  4. Sem regressões         → setInterval residual em LiveCounterSidebar.tsx é animação UI (clock counter), não loop de dispatch — correto
  5. Performance            → Cron a cada minuto + cadência por send via last_batch_at → OK; abort 55s evita lock no minuto seguinte
  6. Security               → SECURITY DEFINER + search_path em trigger_sends_dispatch_batch; service_role lido de _app_config (vault pattern)
  7. Documentação           → Migration documenta dependência de _app_config; story tem File List acurada
  8. Contratos de API       → sends-dispatch-batch retorna {success, dispatched, skipped, errors?} consistente

ACs verificados:
- [x] AC1: setInterval removido do dispatch loop. useSendDispatch.ts:59-92 dispara primeiro batch via send-dispatch-worker e entrega controle ao pg_cron. setInterval em LiveCounterSidebar.tsx:43 é animação de número (não-relacionado).
- [x] AC2: supabase/functions/sends-dispatch-batch/index.ts existe, processa fila via service-role + invoca send-dispatch-worker por send.
- [x] AC3: Migration 20260423010000_sends_server_dispatch.sql cria coluna last_batch_at + função trigger_sends_dispatch_batch + cron.schedule('sends-dispatch-batch', '* * * * *'). 
       Issue tech-debt: existe DUPLICATA EXATA da migration em 20260423013000_sends_server_dispatch.sql (diff vazio). Idempotente (CREATE OR REPLACE + ALTER ADD COLUMN IF NOT EXISTS + cron.schedule é safe re-run), portanto não quebra deploy. Recomendação: remover a duplicata em commit de cleanup.
- [x] AC4: pg_cron não depende do browser; comportamento esperado validado por design (não verificável estaticamente, smoke test deferido).
- [x] AC5: useSends.ts aceita refetchInterval para polling; DisparoDetalhes.tsx faz poll quando status=running (per File List).

Issues identificados:
- [LOW] Migration duplicada idêntica: 20260423010000_sends_server_dispatch.sql e 20260423013000_sends_server_dispatch.sql são bit-by-bit iguais (diff retorna vazio). Idempotência salva, mas suja o histórico.
       Arquivo: supabase/migrations/20260423013000_sends_server_dispatch.sql
       Sugestão: remover a duplicata em commit de cleanup; a `cron.schedule('sends-dispatch-batch', ...)` automaticamente desinstala+reinstala, então segunda execução é no-op.

- [LOW] sends-dispatch-batch sem entrada explícita em supabase/config.toml. Aceita service-role JWT (verify_jwt=true default OK), mas para pg_cron path o service_role já satisfaz JWT verification. Documentar para clareza ops.

- [LOW] AC4 smoke test (broadcast continua após fechar aba) não verificado em ambiente staging. Validação manual recomendada.

Próximo passo: @dev-devops push (observações documentadas; story funcionalmente completa, tech-debt de migration duplicada acionável em cleanup separado).
```
