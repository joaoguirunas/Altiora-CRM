---
title: "AUDIT-FIX-04: P0 Database — Migrations duplicadas e RLS crm_*"
type: story
status: done
epic: AUDIT-FIX
complexity: M
agent: dev-data-engineer
created: 2026-04-26
updated: 2026-04-26
tags: [story, database, p0, sprint-1]
related: ["[[../../audit/database]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-04: P0 Database — Migrations duplicadas e RLS crm_*

## Objetivo
Corrigir timestamps de migrations duplicados e verificar/corrigir RLS em tabelas crm_* legadas.

## Acceptance Criteria
- [ ] AC1: Nenhum par de migrations com timestamp idêntico e conteúdo diferente
- [ ] AC2: SQL de diagnóstico de RLS produzido e documentado
- [ ] AC3: Se `USING(true)` confirmado em tabelas crm_* de dados sensíveis, migration de correção criada
- [ ] AC4: `supabase db diff` não reporta conflito de migrations

## Escopo

**IN:**
- `supabase/migrations/` — renomear migrations com timestamp duplicado
- Nova migration de RLS se necessário (protocolo: dry-run antes de apply)

**OUT:**
- Schema legado → moderno migration (AUDIT-FIX-10)
- 101 DROPs sem IF EXISTS (P1-23, sprint seguinte)

## Status
🔄 Em execução — dev-data-engineer
