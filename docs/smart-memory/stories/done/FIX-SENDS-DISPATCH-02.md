---
title: "Story FIX-SENDS-DISPATCH-02: Reduzir retry delays inline para prevenir timeout em batch"
type: story
status: done
epic: SENDS
complexity: S
agent: dev-dev-beta
created: 2026-04-30
updated: 2026-07-25
tags: [story, sends-pro, dispatch, retry, timeout, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]"]
---

# Story FIX-SENDS-DISPATCH-02: Reduzir retry delays inline para prevenir timeout em batch

## Objetivo

Reduzir os delays de retry inline no `send-dispatch-worker` para que um batch com múltiplos contatos falhantes não ultrapasse o timeout de 150s da Supabase Edge Function.

## Acceptance Criteria

- [x] AC1: O tempo máximo de espera acumulada por contato falhante (3 retries) não ultrapassa 15s.
- [x] AC2: Com `batch_size=5` e todos os 5 contatos falhando 3x cada, o worker completa (com todos marcados como `failed`) dentro do timeout da edge function.
- [x] AC3: A lógica de `isRetryableError` (4xx não retentável, 429 com Retry-After) permanece intacta.
- [x] AC4: Contatos marcados como `failed` pelo retry exausto permanecem com `retry_count` correto no banco.

## Escopo

**IN:**
- Reduzir `delays` em `retryWithBackoff` de `[5000, 15000, 45000]` para `[1000, 3000, 9000]`
- Manter `maxRetries = 3` (número de tentativas não muda)

**OUT:**
- Mudança na lógica de classificação de erro (isRetryableError permanece)
- Introdução de sistema de fila de retry server-side

## Contexto Técnico

**Fix:** linha 543 de `send-dispatch-worker/index.ts`.
Delays `[5000,15000,45000]` → `[1000,3000,9000]`.
Max por contato: 13s. 5 contatos × 13s = 65s < 150s timeout. ✓

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup (commit a882da5) |

## File List
- `supabase/functions/send-dispatch-worker/index.ts` — delays `[5000,15000,45000]` → `[1000,3000,9000]`

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-DISPATCH-02 | Data: 2026-07-25
Checklist: 8/8 verificados
tsc: N/A (Deno edge fn) | lint: sem novos erros
Issues: nenhum

AC1 ✅  Delays [1000,3000,9000] → max por contato = 1+3+9 = 13s.
        5 contatos × 13s = 65s < 150s timeout. Invariante verificada.
AC2 ✅  Batch com todos falhando: 5×13s=65s < 150s. Edge fn conclui dentro do timeout.
AC3 ✅  isRetryableError intocado (4xx não-retentável, 429 com Retry-After preservado).
        linha 590: retry usa retryAfterMs se 429 — não usa delay array neste caso.
AC4 ✅  retry_count incrementado por retryWithBackoff; lido em seguida (linha 1194).
        Banco reflete contagem correta de tentativas.

Fix confirmado em send-dispatch-worker/index.ts linha 545:
  // FIX-SENDS-DISPATCH-02: reduzido de [5000,15000,45000] (max 65s/contato) para
  // [1000,3000,9000] (max 13s/contato). Com batch_size=5: 5×13s=65s < 150s timeout.
  delays: number[] = [1000, 3000, 9000],

Próximo passo: @dev-devops push
```
