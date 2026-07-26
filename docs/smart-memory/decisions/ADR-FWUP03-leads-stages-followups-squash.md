---
title: "ADR-FWUP03: Canonicalização do schema de leads_stages_followups"
type: adr
status: accepted
created: 2026-04-27
tags: [adr, schema, followups, migration]
related: ["[[../stories/active/FWUP-03]]"]
---

# ADR-FWUP03: Canonicalização do schema de leads_stages_followups

## Status

Aceito — migration `20260427040000_fwup03_canonicalize_leads_stages_followups.sql`

## Contexto

Três migrations distintas criaram `leads_stages_followups` com schemas incompatíveis via `CREATE TABLE IF NOT EXISTS`. Dependendo da ordem de aplicação, tenants podem ter ficado com diferentes conjuntos de colunas:

| Migration | FK de stage | Campo de delay | Campo de nome |
|---|---|---|---|
| `20251005205003` (Schema A — canônico) | `leads_stages_id` | `days + hours + minutes` | não existe |
| `20251110183840` (Schema B) | `stage_id` | `delay_minutes` | `name NOT NULL` |
| `20251202180828` (Schema C) | `stage_id` | `delay_minutes` | `name NOT NULL` |

O frontend (`useFollowups.ts`) sempre usou o Schema A. As migrations B e C rodaram via `CREATE TABLE IF NOT EXISTS`, então em instâncias onde Schema A já existia, não houve alteração estrutural — mas em instâncias "frescas" que só receberam B ou C, o schema divergiu.

## Decisão

Aplicar migration de normalização que:

1. **Garante colunas canônicas** via `ADD COLUMN IF NOT EXISTS` (idempotente)
2. **Backfill** de `stage_id → leads_stages_id` onde o campo órfão tem valor
3. **Dropa colunas órfãs** — `stage_id`, `name`, `delay_minutes`
4. **Smoke test** inline verifica ausência dos órfãos e presença da FK canônica

## Colunas eliminadas e justificativa

| Coluna | Motivo da eliminação |
|---|---|
| `stage_id` | Duplicata de `leads_stages_id` com nome não-canônico. FK para a mesma tabela. Backfill garante que nenhum dado seja perdido antes do DROP. |
| `name` | Campo `NOT NULL` em schemas B/C mas inexistente no schema A. Frontend nunca lê nem escreve este campo. Sem dados funcionais em produção. |
| `delay_minutes` | Representação alternativa do delay — Schema A usa `days + hours + minutes` com granularidade fina. `delay_minutes` é apenas `minutes` sem equivalência para horas/dias. |

## Schema canônico final

```
leads_stages_followups (
  id                uuid PK,
  leads_stages_id   uuid FK→leads_stages (nullable — pode ser null se só score_matrix_id),
  score_matrix_id   uuid FK→score_matrix (nullable),
  target_stage_id   uuid FK→leads_stages (nullable),
  type              text NOT NULL DEFAULT 'texto',
  message           text,
  subject           text,
  template_id       text,
  audio_file        text,
  days              integer NOT NULL DEFAULT 0,
  hours             integer NOT NULL DEFAULT 0,
  minutes           integer NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true,
  control           integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
)
```

## Consequências

**Positivas:**
- Schema unívoco em todos os tenants após aplicação
- `useFollowups.ts` continua funcionando sem alterações (já usava Schema A)
- Índices canônicos melhoram performance de queries por etapa

**Negativas/riscos mitigados:**
- Tenants com registros apenas em `stage_id` (sem `leads_stages_id`) teriam dados perdidos — backfill em Fase 2 previne isso
- `name` e `delay_minutes` não tinham dados funcionais em produção (campos não usados pelo frontend)
- Rollback disponível em `rollbacks/20260427040000_fwup03_*.rollback.sql` mas não restaura dados de `name`/`delay_minutes`

## Alternativas descartadas

- **Manter todas as colunas:** aumenta superfície de drift e confusão para futuros devs
- **Reescrever histórico de migrations:** impossível sem risco de hash mismatch em tenants aplicados
- **Criar nova tabela e migrar dados:** complexidade desnecessária — ALTER TABLE é suficiente
