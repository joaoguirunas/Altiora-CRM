---
title: "Migrations Lint Baseline — 2026-07-25"
type: ops-report
generated: 2026-07-25T00:00:00Z
tags: [lint, migrations, baseline, rel-04, tech-debt]
---

# Migrations Lint Baseline — REL-04 AC6

Relatório de backfill gerado por `node scripts/lint-migrations.js --all` em 2026-07-25.
Estabelece a dívida histórica de lint. PRs futuros (após merge desta story) seguem disciplina;
backlog histórico fica como tech debt visível.

## Sumário

| Campo | Valor |
|---|---|
| Arquivos analisados | 902 |
| Total de erros | 1.801 |
| Total de warnings | 21 |
| Comando | `node scripts/lint-migrations.js --all` |
| Data | 2026-07-25 |

## Distribuição por código

| Código | Regra | Ocorrências | Tipo |
|---|---|---|---|
| MIG006 | Rollback file ausente | 822 | ERROR |
| MIG003 | CREATE INDEX sem IF NOT EXISTS | 295 | ERROR |
| MIG002 | CREATE TABLE sem IF NOT EXISTS | 214 | ERROR |
| MIG005 | DROP TABLE sem @allow-destructive | 194 | ERROR |
| MIG004 | ADD COLUMN sem IF NOT EXISTS | 173 | ERROR |
| MIG001 | Timestamp prefix inválido | 103 | ERROR |
| MIG007 | Arquivo > 500 linhas | 20 | WARN |
| MIG008 | CREATE FUNCTION sem OR REPLACE | 1 | WARN |

## Principais ofensores

| Arquivo | Erros |
|---|---|
| `20251110183840_c226a235-…-ok.sql` | 59 |
| `20251202181343_6d2f4fbc-…-ok.sql` | 53 |
| `20250920031453_baa51030-…-ok.sql` | 53 |
| `20250920031234_2fb2382e-…-ok.sql` | 53 |
| `20260312150001_ensure_full_tenant_baseline.sql` | 34 |
| `20251202180828_8d6e7863-…-ok.sql` | 34 |
| `20251226031506_02bf6e62-…-ok.sql` | 31 |
| `20260214185310_06829439-…-ok.sql` | 24 |
| `20260702120000_kiwify_integration_schema.sql` | 19 |

## Análise por regra

### MIG006 — Rollback ausente (822 erros)
A regra mais violada. A maioria das migrations pre-REL-04 não tem rollback correspondente.
**Ação:** novas migrations DEVEM ter rollback; backlog histórico documenta-se aqui como dívida.

### MIG003/MIG002/MIG004 — IF NOT EXISTS ausente (682 erros combinados)
Migrations antigas não usavam padrão idempotente. Crítico para o REL-03 Repair button:
re-aplicação falha em migrations sem `IF NOT EXISTS`.
**Ação:** novas migrations DEVEM usar `IF NOT EXISTS`; backlog candidato a fixup em wave futura.

### MIG005 — DROP sem @allow-destructive (194 erros)
Includes archives de Coach Pro, Call Pro e módulos removidos. Drops intencionais mas sem header.
**Ação:** migrations futuras de DROP devem adicionar `-- @allow-destructive reason: ...`.

### MIG001 — Timestamp inválido (103 erros)
Migrations antigas (2025) com formato `YYYYMMDD-uuid-ok.sql` não seguem padrão `\d{14}_`.
**Ação:** novas migrations DEVEM usar `YYYYMMDDHHMMSS_descricao.sql`.

### MIG007 — Arquivo grande (20 warnings)
20 migrations com > 500 linhas. `ensure_full_tenant_baseline.sql` tem 3.5MB+.
**Ação:** novas migrations DEVEM ser focadas e < 500 linhas.

### MIG008 — CREATE FUNCTION sem OR REPLACE (1 warning)
Raro — 1 caso histórico. Baixo impacto.

## Tech Debt Dashboard

```
Total dívida histórica (erros): 1.801
  Rollbacks faltando:            822  (45.6%)
  IF NOT EXISTS faltando:        682  (37.9%)
  DROP sem @allow-destructive:   194  (10.8%)
  Timestamp inválido:            103   (5.7%)

Warnings históricos:              21
  Arquivos grandes (>500 lin):    20  (95.2%)
  CREATE FUNCTION sem OR REPLACE:  1   (4.8%)
```

## Disciplina pós REL-04 (forward)

A partir do merge de REL-04, toda PR com migrations é bloqueada por `lint-migrations.yml` se:
- MIG001: timestamp inválido
- MIG002: CREATE TABLE sem IF NOT EXISTS
- MIG003: CREATE INDEX sem IF NOT EXISTS
- MIG004: ADD COLUMN sem IF NOT EXISTS
- MIG005: DROP TABLE sem @allow-destructive
- MIG006: rollback ausente (sem @no-rollback)
- MIG009: migration não registrada em migrations-manifest.json

Warnings (MIG007, MIG008) não bloqueiam merge mas aparecem como comentário no PR.

## Próximos passos (sugestões)

| Prioridade | Ação | Impacto |
|---|---|---|
| P1 | Criar rollbacks para Wave 2 migrations (já feito em 2026-07-25) | -9 de MIG006 |
| P2 | Fixup das 20 migrations mais ofensoras com IF NOT EXISTS | -282 de MIG002/003/004 |
| P3 | Adicionar @no-rollback ou rollbacks para top-50 migrations históricas por MIG006 | -50 de MIG006 |
| P4 | Renomear migrations com timestamp inválido (103 arquivos) | -103 de MIG001 |

## Referências

- Script: `scripts/lint-migrations.js` (AC1)
- Workflow: `.github/workflows/lint-migrations.yml` (AC2 — dev-devops)
- Dry-run: `.github/workflows/migrations-dry-run.yml` (AC3 — dev-devops)
- Story: [[../../stories/done/REL-04]]
