---
title: "AUDIT-FIX-10: P1 Database — Schema legado crm_* e 101 DROPs sem IF EXISTS"
type: story
status: done
epic: AUDIT-FIX
complexity: XL
agent: dev-architect + dev-data-engineer
created: 2026-04-26
updated: 2026-04-26
tags: [story, database, p1, adr-needed]
related: ["[[../../audit/database]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-10: P1 Database — Schema legado crm_* e migrations frágeis

## Objetivo
Definir e executar estratégia de migração do schema legado crm_* para o moderno, e corrigir DROPs sem IF EXISTS.

## ⚠️ ADR necessária antes de implementar
**Decisão:** migrar dados crm_* → moderno / manter dual com sync / descontinuar moderno

## Acceptance Criteria
- [ ] AC1: ADR aprovada com estratégia de schema definida
- [ ] AC2: `RealtimeContext` filtra corretamente (tenant_id não NULL)
- [ ] AC3: 101 DROPs sem IF EXISTS convertidos nos de maior risco
- [ ] AC4: Edge functions que usam schema legado identificadas e plano de migração documentado

## Issues resolvidos
- P1-23: DROPs sem IF EXISTS
- P1-24: Schema dual sem sincronização
- P1-25: Realtime recebe 0 eventos em tabelas com tenant_id NULL

## Status
⏳ Backlog — aguarda ADR (dev-architect)
