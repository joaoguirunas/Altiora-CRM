---
title: "Story FIX-SENDS-DISPATCH-01: Atomic claim em sends-dispatch-batch via UPDATE+RETURNING"
type: story
status: done
epic: SENDS
complexity: M
agent: dev-dev-beta
created: 2026-04-30
updated: 2026-07-25
tags: [story, sends-pro, dispatch, race-condition, bug, P1]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]", "[[FIX-SENDS-01]]"]
---

# Story FIX-SENDS-DISPATCH-01: Atomic claim em sends-dispatch-batch via UPDATE+RETURNING

## Objetivo

Eliminar a race condition no `sends-dispatch-batch` que permite dois invocações simultâneas do cron processarem o mesmo send, causando envio duplicado de mensagens para os mesmos contatos.

## Acceptance Criteria

- [x] AC1: Duas invocações simultâneas de `sends-dispatch-batch` para o mesmo send resultam em exatamente um dispatch, não dois.
- [x] AC2: O claim atômico usa UPDATE com condição de cadência embutida (sem SELECT separado antes) — padrão compare-and-swap.
- [x] AC3: Se o UPDATE retorna 0 rows (outro worker já fez claim), a invocação atual faz skip silencioso do send.
- [x] AC4: O mecanismo funciona corretamente com `send_interval_seconds` de 5s, 30s e 3600s.
- [x] AC5: Sends com `status != 'running'` (paused, completed) nunca são processados — invariante mantida.

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

O fluxo anterior era check-then-act com janela de race entre JS check e UPDATE.

**Fix implementado:** UPDATE atômico com condição embutida:
```typescript
const { data: claimed, error: claimErr } = await supabase
  .from('sends')
  .update({ last_batch_at: nowIso })
  .eq('id', send.id)
  .eq('status', 'running')
  .or(`last_batch_at.is.null,last_batch_at.lte.${lastDueIso}`)
  .select('id');

if (claimErr || !claimed || claimed.length === 0) {
  skipped++;
  continue; // outro worker fez claim primeiro
}
```

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup (commit 527d1b5) |

## File List
- `supabase/functions/sends-dispatch-batch/index.ts` — substituído SELECT+JS cadence check+UPDATE separados por UPDATE+RETURNING atômico com `.or('last_batch_at.is.null,last_batch_at.lte.${lastDueIso}')` embutido

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-DISPATCH-01 | Data: 2026-07-25
Checklist: 8/8 verificados
tsc: EXIT 0 | lint: sem novos erros
Issues: nenhum

AC1 ✅  Atomic UPDATE: dois workers simultâneos → apenas um retorna claimed.length=1.
        Compare-and-swap via UPDATE+RETURNING é atomicamente serializado pelo Postgres.
AC2 ✅  Single UPDATE query — sem SELECT pré-claim. Janela de race eliminada.
        Condição de cadência embutida no WHERE: .or('last_batch_at.is.null,last_batch_at.lte.${lastDueIso}').
AC3 ✅  claimed.length === 0 → skipped++; continue. Skip silencioso correto.
AC4 ✅  lastDueIso = nowIso - send_interval_seconds. Funciona para 5s / 30s / 3600s.
AC5 ✅  .eq('status', 'running') no WHERE — paused e completed nunca satisfazem a condição.
        Invariante mantida: sends não-running nunca processados.

Próximo passo: @dev-devops push
```
