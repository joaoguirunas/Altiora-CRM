---
title: "Story FIX-SENDS-UI-02: Corrigir timezone em scheduled_at ao criar disparo agendado"
type: story
status: done
epic: SENDS
complexity: S
agent: dev-dev-alpha
created: 2026-04-30
updated: 2026-07-25
tags: [story, sends-pro, ui, timezone, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]"]
---

# Story FIX-SENDS-UI-02: Corrigir timezone em scheduled_at ao criar disparo agendado

## Objetivo

Garantir que `scheduled_at` seja enviado com timezone explícito (UTC ISO string) ao criar ou atualizar um disparo agendado, evitando interpretação ambígua pelo Postgres que pode causar disparo 3h antes ou depois do horário pretendido.

## Acceptance Criteria

- [x] AC1: Ao criar disparo agendado para "09:00" com usuário em GMT-3, `scheduled_at` no banco armazena `12:00:00+00` (UTC correto).
- [x] AC2: O valor exibido na UI de detalhe do disparo mostra o horário no timezone local do usuário.
- [x] AC3: Não há regressão no fluxo de criação de disparo imediato (não agendado).

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
| Agente     | Novik (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List
- `src/components/disparos/CriarDisparoModal.tsx` — modificado (scheduled_at → .toISOString())
- `src/pages/CriarDisparo.tsx` — já estava correto (verificado, sem alteração necessária)

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-UI-02 | Data: 2026-07-25
Checklist: 8/8 verificados
tsc: EXIT 0 | lint: sem novos erros
Issues: nenhum

AC1 ✅  CriarDisparoModal.tsx linha 101: new Date(`${date}T${time}:00`).toISOString()
        Browser em GMT-3: "09:00" local → "12:00:00.000Z" UTC. Sem ambiguidade Postgres.
AC2 ✅  UI exibe horário local naturalmente via Date formatting do browser.
AC3 ✅  Fluxo de disparo imediato não toca scheduled_at — sem regressão.
        CriarDisparo.tsx verificado: já correto, sem alteração necessária.

Próximo passo: @dev-devops push
```
