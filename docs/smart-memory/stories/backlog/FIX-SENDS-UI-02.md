---
title: "Story FIX-SENDS-UI-02: Corrigir timezone em scheduled_at ao criar disparo agendado"
type: story
status: backlog
epic: SENDS
complexity: S
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, ui, timezone, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]"]
---

# Story FIX-SENDS-UI-02: Corrigir timezone em scheduled_at ao criar disparo agendado

## Objetivo

Garantir que `scheduled_at` seja enviado com timezone explícito (UTC ISO string) ao criar ou atualizar um disparo agendado, evitando interpretação ambígua pelo Postgres que pode causar disparo 3h antes ou depois do horário pretendido.

## Acceptance Criteria

- [ ] AC1: Ao criar disparo agendado para "09:00" com usuário em GMT-3, `scheduled_at` no banco armazena `12:00:00+00` (UTC correto).
- [ ] AC2: O valor exibido na UI de detalhe do disparo mostra o horário no timezone local do usuário.
- [ ] AC3: Não há regressão no fluxo de criação de disparo imediato (não agendado).

## Escopo

**IN:**
- Corrigir montagem de `scheduled_at` em `CriarDisparo.tsx` para usar `new Date(...).toISOString()`
- Verificar se `CriarDisparoModal.tsx` tem o mesmo padrão e corrigir se sim

**OUT:**
- Mudança no schema ou edge functions
- Implementação de agendamento server-side via pg_cron (escopo de FIX-SENDS-01)

## Contexto Técnico

**Bug raiz:** `src/pages/CriarDisparo.tsx` — montagem de `scheduled_at`.

```typescript
// Atual (ambíguo):
sendData.scheduled_at = `${scheduledDate}T${scheduledTime}:00`;

// Fix (UTC explícito):
sendData.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
```

`new Date('2026-05-01T09:00:00')` em browser GMT-3 retorna `Date` representando `12:00:00 UTC`. `.toISOString()` emite `2026-05-01T12:00:00.000Z` — sem ambiguidade para o Postgres.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
