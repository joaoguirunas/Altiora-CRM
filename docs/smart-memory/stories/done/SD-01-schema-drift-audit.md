---
title: "SD-01: Schema Drift Audit — gap report entre código e DB"
type: story
status: done
epic: SD
complexity: M
agent: dev-data-engineer
created: 2026-07-26
updated: 2026-07-26
completed: 2026-07-26
tags: [story, database, schema, audit]
related: [SD-02-migration-consolidada]
---

# SD-01: Schema Drift Audit — gap report entre código e DB

## Objetivo
Varrer todos os hooks e queries do frontend que referenciam tabelas/colunas do Supabase e comparar com o schema real (migrations), produzindo um relatório de todas as colunas e tabelas que existem no código mas faltam no banco.

## Acceptance Criteria
- [ ] AC1: Grep de todos os `.from('tabela')` e `.select(...)` em `src/hooks/`, `src/components/`, `supabase/functions/`
- [ ] AC2: Listagem das colunas encontradas por tabela vs o que as migrations definem
- [ ] AC3: Gap report: colunas referenciadas no código mas ausentes nas migrations aplicadas
- [ ] AC4: Identificar tabelas referenciadas mas inexistentes (ex-kiwify)
- [ ] AC5: Saída estruturada que possa alimentar diretamente a SD-02

## Escopo

**IN:**
- `src/hooks/*.ts`
- `src/components/**/*.tsx`
- `supabase/functions/**/*.ts`
- `supabase/migrations/*.sql` (baseline do schema real)

**OUT:**
- Código da aplicação (não modificar)
- Migrações anteriores (só leitura)

## Contexto Técnico
Problema conhecido: `meetings` table foi criada em `20251005205003` sem `title`, `people_id`, `meeting_link`, `description`. 
A migration `20260726200000_meetings_missing_columns.sql` foi criada mas pode ainda não ter sido aplicada.
`settings_users` usa `nome`/`ativo` mas código antigo usava `name`/`active`.
`kiwify_lead_products` não existe — todas refs devem ser catalogadas.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer |
| Iniciado   | 2026-07-26 |
| Concluído  | — |
| Output     | gap-report em docs/smart-memory/agents/data-engineer/schema-gap-report.md |
