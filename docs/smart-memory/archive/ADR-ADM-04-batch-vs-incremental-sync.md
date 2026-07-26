---
title: "ADR-ADM-04: Estratégia batch vs incremental para replicação de migrations"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, adm, migrations, sync, performance, reliability]
related: ["[[ADR-ADM-01-project-per-tenant]]", "[[ADR-ADM-03-dual-auth-sync-client]]"]
---

# ADR-ADM-04: Estratégia batch vs incremental para replicação de migrations

## Context

`adm-sync-client` replica o catálogo de migrations do control plane (`adm_migrations`) para cada tenant via conexão Postgres direta. O problema de design é: como executar N migrations de forma eficiente e resiliente dentro do limite de 60s de uma edge function?

Duas estratégias:

1. **Batch mode** — concatena todas as migrations pendentes em um único payload SQL e executa em uma transação. Mais rápido (uma conexão, uma roundtrip), mas se qualquer statement falhar, toda a transação é revertida.
2. **Incremental mode** — executa uma migration de cada vez, cada uma em try/catch isolado. Mais lento (N roundtrips), mas falha em migration K não afeta K+1 a N.

Um tenant novo tem tipicamente 50+ migrations a aplicar de uma vez. Um tenant existente normalmente tem 1-5 migrations pending por deploy.

Bugs históricos que moldaram a decisão:
- **Bug 2**: no batch mode inicial, falha em migration N cascateava todas as N+1 migrations como failed — estado incorreto no `adm_migration_runs`.
- **Bug 3**: `adm_migration_runs` não era inserido se o sync abortasse no meio — estado fantasma onde migration "aplicada" não tinha registro.

## Decision

**Modo híbrido: batch para novos tenants, incremental com fallback para existentes.**

Heurística de seleção:
```ts
const isNewClient = appliedIds.size === 0 && pending.length > 10;
```

- `isNewClient = true` → **batch mode**: concatena todas as migrations, executa em uma conexão. Se batch falhar → **fallback automático para incremental** (não cascateia o erro).
- `isNewClient = false` → **incremental mode** diretamente.

`splitStatements(sql)` — parser SQL caseiro que:
- Respeita `$tag$ ... $tag$` (PL/pgSQL function bodies) — não divide por `;` dentro de blocos dollar-quoted.
- Respeita `--` line comments — semicolons em comentários não separam statements.
- Filtra statements vazios ou só-comentário.

Cada migration tem try/catch isolado. Dentro de cada migration, cada statement tem try/catch com `isIdempotentError()`:
- `already exists`, `duplicate key`, `multiple primary keys` → tratado como não-erro (idempotência).
- `CREATE/DROP POLICY ON storage.objects|buckets` → pular com warning (`isStoragePolicyStatement()` — permissão negada para `postgres` user em storage schema em alguns Supabase projects).

`adm_migration_runs` é inserido individualmente por migration com status `success` ou `error` — mesmo se o sync global falhar, o registro de tentativa existe.

## Consequences

**Positivo:**
- Provisionamento de novo tenant é rápido: uma conexão para 50+ migrations concatenadas.
- Fallback automático batch → incremental: provisioning nunca falha totalmente por erro em uma migration.
- Idempotência: re-executar `adm-sync-client` é seguro. Migrations já aplicadas (FK em `adm_migration_runs` com `status=success`) são puladas.
- Falha isolada: erro em migration K não afeta K+1 a N.

**Negativo / trade-offs:**
- **Parser SQL caseiro** (`splitStatements`) pode falhar com SQL muito complexo (ex: dollar-quoting aninhado). Testado com o conjunto atual de migrations, mas não é um parser SQL completo. Adição de migrations incomuns pode quebrar o parser.
- **`isNewClient` heurística**: threshold de 10 migrations é arbitrário. Um tenant existente com muitas migrations pendentes (ex: após longo período sem sync) vai para incremental mesmo sendo potencialmente mais lento.
- **Sem retry estruturado**: migration que falha requer intervenção manual (super-admin clica "Sync agora" novamente). Sem backoff exponencial automático.
- **Edge function 60s limit**: sync de muitos tenants via GitHub Actions é distribuído (um request HTTP por tenant), mas sync manual de um tenant com muitas migrations pode timeout. Mitigação: fallback incremental + stale job cleanup de 5min.

**Arquivos relevantes:**
- `supabase/functions/adm-sync-client/index.ts` — `splitStatements()`, `isIdempotentError()`, `isStoragePolicyStatement()`, batch/incremental logic
- `src/hooks/useAdmClients.ts` — `useSyncClientNow()`
- `scripts/sync-clients.js` — loop por tenant via CI/CD
