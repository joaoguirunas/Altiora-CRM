---
title: "Story FIX-SENDS-DISPATCH-02: Reduzir retry delays inline para prevenir timeout em batch"
type: story
status: backlog
epic: SENDS
complexity: S
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
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
- Testar com batch_size=5 e simulação de falhas totais

**OUT:**
- Mudança na lógica de classificação de erro (isRetryableError permanece)
- Introdução de sistema de fila de retry server-side (escopo maior — story separada se necessário)
- Mudança no comportamento de retry para WA (WA não usa retryWithBackoff — usa insert em messages)

## Contexto Técnico

**Bug raiz:** `supabase/functions/send-dispatch-worker/index.ts` — linha 541.

```typescript
// Atual — max espera por contato: 5+15+45 = 65s
async function retryWithBackoff<T>(fn, ctx, maxRetries = 3, delays = [5000, 15000, 45000])

// Proposto — max espera por contato: 1+3+9 = 13s
async function retryWithBackoff<T>(fn, ctx, maxRetries = 3, delays = [1000, 3000, 9000])
```

Com `batch_size=1` (default), o problema não ocorre — 65s por contato único cabe no timeout de 150s. O risco é quando o usuário configura `batch_size > 1` na cadência.

**Limite seguro:** `5 contatos × 13s = 65s` — cabe em 150s com margem para overhead de DB e rede.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List
- `supabase/functions/send-dispatch-worker/index.ts` — delays `[5000,15000,45000]` → `[1000,3000,9000]` (max 13s/contato vs 65s anterior)

## QA Results
<!-- QA preenche ao revisar -->
