---
title: "Story FIX-SENDS-UI-01: Não sobrescrever started_at ao retomar disparo pausado"
type: story
status: backlog
epic: SENDS
complexity: S
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, ui, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]"]
---

# Story FIX-SENDS-UI-01: Não sobrescrever started_at ao retomar disparo pausado

## Objetivo

Corrigir o `DisparoControls` para que retomar um disparo pausado não sobrescreva o `started_at` original, preservando as métricas de duração de campanha.

## Acceptance Criteria

- [ ] AC1: Ao clicar "Retomar" em campanha pausada, `started_at` no banco permanece o valor original (não é atualizado).
- [ ] AC2: Ao clicar "Iniciar" em campanha nova (status='draft' ou 'scheduled'), `started_at` é setado corretamente com o horário atual.
- [ ] AC3: O componente `PerformanceCard` exibe duração de campanha correta mesmo após pausa/retomada.

## Escopo

**IN:**
- Corrigir `handleStart` em `DisparoControls.tsx` para diferenciar start de resume
- Resume: payload inclui apenas `{ status: 'running' }` sem `started_at`

**OUT:**
- Mudança em outros controles de disparo
- Mudança no schema ou hooks

## Contexto Técnico

**Bug raiz:** `src/components/disparos/DisparoControls.tsx` — linhas 23-35.

```typescript
// Fix:
const handleStart = () => {
  const isResume = send.status === 'paused';
  updateSend(
    {
      id: send.id,
      data: isResume
        ? { status: 'running' }
        : { status: 'running', started_at: new Date().toISOString() },
    },
    { onSuccess: () => { toast.success(...); startFirstBatch({ sendId: send.id }); } }
  );
};
```

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
