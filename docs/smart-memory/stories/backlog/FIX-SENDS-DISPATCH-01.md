---
title: "Story FIX-SENDS-DISPATCH-01: Atomic claim em sends-dispatch-batch via UPDATE+RETURNING"
type: story
status: backlog
epic: SENDS
complexity: M
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, dispatch, race-condition, bug, P1]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]", "[[FIX-SENDS-01]]"]
---

# Story FIX-SENDS-DISPATCH-01: Atomic claim em sends-dispatch-batch via UPDATE+RETURNING

## Objetivo

Eliminar a race condition no `sends-dispatch-batch` que permite dois invocações simultâneas do cron processarem o mesmo send, causando envio duplicado de mensagens para os mesmos contatos.

## Acceptance Criteria

- [ ] AC1: Duas invocações simultâneas de `sends-dispatch-batch` para o mesmo send resultam em exatamente um dispatch, não dois.
- [ ] AC2: O claim atômico usa UPDATE com condição de cadência embutida (sem SELECT separado antes) — padrão compare-and-swap.
- [ ] AC3: Se o UPDATE retorna 0 rows (outro worker já fez claim), a invocação atual faz skip silencioso do send.
- [ ] AC4: O mecanismo funciona corretamente com `send_interval_seconds` de 5s, 30s e 3600s.
- [ ] AC5: Sends com `status != 'running'` (paused, completed) nunca são processados — invariante mantida.

## Escopo

**IN:**
- Substituir o padrão SELECT→check→UPDATE separados por uma única query UPDATE com RETURNING que inclui a condição de cadência
- Pode usar RPC Postgres ou query via Supabase JS com `.update().eq().lte().is().select('id')`
- Manter log de `dispatched` e `skipped` no response

**OUT:**
- Mudança no `send-dispatch-worker` (permanece sem alteração)
- Mudança na lógica de cadência (intervalo configurado por `send_interval_seconds` mantido)
- Introdução de filas ou mecanismos de lock externos

## Contexto Técnico

**Bug raiz:** `supabase/functions/sends-dispatch-batch/index.ts` — linhas 38-80.

O fluxo atual é check-then-act:
1. SELECT sends WHERE status='running' (sem lock)
2. Verifica `now < nextBatchDue` em JS
3. UPDATE last_batch_at WHERE id=X AND status='running'
4. Invoca worker

Entre passos 1-3 há janela de race. Deno Deploy pode ter múltiplas instâncias simultâneas; pg_cron pode ter retry.

**Fix via query atômica (Supabase JS):**
```typescript
// Ao invés de SELECT + check + UPDATE separados:
const { data: claimed } = await supabase
  .from('sends')
  .update({ last_batch_at: new Date().toISOString() })
  .eq('id', send.id)
  .eq('status', 'running')
  .or(`last_batch_at.is.null,last_batch_at.lte.${new Date(now - intervalMs).toISOString()}`)
  .select('id');

if (!claimed || claimed.length === 0) {
  skipped++;
  continue; // outro worker fez claim primeiro
}
// agora invocar o worker
```

**Alternativa via RPC:** criar `claim_send_for_dispatch(send_id uuid, interval_seconds int) RETURNS bool` que faz UPDATE+RETURNING atomicamente no Postgres.

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
