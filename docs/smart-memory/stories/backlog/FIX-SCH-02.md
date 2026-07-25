---
title: "FIX-SCH-02: Double-booking, Zoom refresh e RLS em meeting_evaluations"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-22
tags: [story, schedule-pro, debt, P2]
related: ["[[../../project/modules/schedule-pro]]"]
---

# FIX-SCH-02: Double-booking, Zoom refresh e RLS em meeting_evaluations

## Objetivo
Prevenir double-booking quando GCal não está importado, implementar refresh de tokens Zoom, e adicionar RLS tenant-scoped em `meeting_evaluations`.

## Acceptance Criteria
- [ ] AC1: Slots ocupados por reuniões no GCal (não importadas no sistema) são bloqueados no public booking
- [ ] AC2: Token Zoom renovado automaticamente antes de expirar (refresh_token flow)
- [ ] AC3: `meeting_evaluations` tem policy RLS garantindo isolamento por `tenant_id`
- [ ] AC4: Booking público não permite double-booking em nenhum cenário testado

## Escopo

**IN:**
- Consulta a GCal para verificar disponibilidade real antes de confirmar booking
- Zoom token refresh (edge fn ou cron)
- Migration: adicionar RLS policy a `meeting_evaluations`

**OUT:**
- Refactor do fluxo de booking end-to-end
- Integração com outros calendários (Outlook, etc.)

## Contexto Técnico
Schedule PRO usa capability tokens (ADR-SP-01) para public booking. Problema: se o organizador tem reuniões no GCal que não foram importadas no sistema, slots aparecem como livres. Zoom sem refresh causa falhas após token expirar. `meeting_evaluations` sem RLS expõe avaliações cross-tenant. Ver `docs/smart-memory/project/modules/schedule-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/schedule-double-booking-zoom-rls |

## File List

## QA Results
