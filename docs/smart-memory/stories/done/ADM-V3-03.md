---
title: "ADM-V3-03: Retry com backoff exponencial em adm-sync-client por migration falhada"
type: story
status: done
epic: adm-v3
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, adm, control-plane, reliability, P2]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-ADM-04-batch-vs-incremental-sync]]"]
---

# ADM-V3-03: Retry com backoff exponencial em adm-sync-client por migration falhada

## Objetivo
Adicionar retry automático com backoff exponencial para migrations que falham por erros transientes (ex: deadlock, connection reset), reduzindo a necessidade de intervenção manual do super-admin após falhas de sync.

## Acceptance Criteria
- [x] AC1: Cada statement em modo incremental tem até 3 tentativas com backoff: 0ms → 500ms → 2000ms — apenas para erros classificados como transientes
- [x] AC2: Função `isTransientError(err)` em `_shared/retry.ts` — retorna `true` para PG codes `40P01`, `08006`, `08001`, `08004`, `57P03`, `53300`, `55P03` e texto patterns; `false` para erros estruturais
- [x] AC3: Log de cada tentativa falhada em `adm_sync_logs` com `level: 'warn'`, message com `Tentativa N/3 falhou: {error}. Retrying em Xms`
- [x] AC4: Após todas as tentativas falharem, comportamento atual mantido: migration registrada como erro em `adm_migration_runs`, sync continua
- [x] AC5: `sync-clients.js` tem retry de nível de cliente: se `adm-sync-client` retornar `failed > 0`, re-invoca uma vez após 30s — sem loop infinito

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/functions/_shared/retry.ts` (novo — `isTransientError`, `withRetry`)
- `supabase/functions/adm-sync-client/index.ts` (import retry.ts; `applyIncremental` wraps SQL exec com `withRetry`)
- `scripts/sync-clients.js` (client-level retry: 30s sleep + re-invoke após `failed > 0`)

## QA Results
<!-- QA preenche ao revisar -->
