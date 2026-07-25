---
title: "Story FWUP-07: Padronizar valores de meeting_status (eliminar 'não compareceu' divergente)"
type: story
status: review
epic: FWUP
complexity: S
priority: P1
agent: dev-data-engineer + dev-dev-alpha
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, schema, consistency, p1]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-02]]"]
---

# Story FWUP-07: Padronizar valores de meeting_status (eliminar 'não compareceu' divergente)

## Objetivo
Eliminar a divergência entre o CHECK constraint do banco (`'nao_compareceu'` sem acento, ASCII) e o tipo `MeetingStatus` no frontend (`'não compareceu'` com acento, espaço) que causa falha silenciosa ao criar regras de followup com esse status.

## Acceptance Criteria
- [ ] **AC1:** Auditoria de todos os usos de `MeetingStatus` no frontend mapeia onde a chave `'não compareceu'` aparece — convertida para `'nao_compareceu'` (canônico do DB) em todas as ocorrências.
- [ ] **AC2:** `STATUS_LABELS` em `AgendamentoFollowupModal.tsx` usa `'nao_compareceu'` como key e `'Não compareceu'` como label de exibição.
- [ ] **AC3:** Tipo `MeetingStatus` exportado por hook centralizado (`useMeetingStatus` ou em `src/types/`) com union type `'agendado' | 'compareceu' | 'nao_compareceu' | 'cancelado' | 'realizado'`.
- [ ] **AC4:** Migration de cleanup converte registros existentes em `meetings_followups` e `meeting_followup_queue` que tenham `'não compareceu'` (caso existam) para `'nao_compareceu'`.
- [ ] **AC5:** Teste manual: criar regra de followup para status "Não compareceu", salvar, recarregar — regra persiste e dispara corretamente em meeting com esse status.
- [ ] **AC6:** Lint rule (eslint custom ou grep CI) bloqueia introdução de string literal `'não compareceu'` em arquivos `.ts`/`.tsx`.

## Escopo

**IN:**
- Refactor de `STATUS_LABELS` em `AgendamentoFollowupModal.tsx`
- Centralizar tipo `MeetingStatus`
- Migration de cleanup para registros legados (raros mas possíveis)
- Verificar uso em `AgendamentoFollowupsCard`, `useAgendamentos`, edge fns relacionadas
- Lint rule de proteção

**OUT:**
- Mudança no CHECK constraint do DB (já está correto em `'nao_compareceu'`)
- Reformulação de UI/UX dos labels de status
- i18n completo de status (futuro)

## Contexto Técnico

**Arquivos afetados:**
- `src/components/followups/AgendamentoFollowupModal.tsx` — `STATUS_LABELS`
- `src/types/meeting.ts` (criar se não existir)
- Hooks: `useAgendamentos`, `useAgendamentosFollowups`, `useMeetingFollowupAutoSetup`
- Migrations: cleanup data se encontrar `'não compareceu'` no DB

**Histórico das migrations:**
- 20251005: CHECK aceitava `'nao_compareceu'`
- 20260309: alterou para `'não compareceu'` (com acento)
- 20260315: reverteu para `'nao_compareceu'` e adicionou `'realizado'`

Estado final do DB é `'nao_compareceu'`. Frontend ficou desatualizado.

**Bloqueado por:** FWUP-02 (estabilizar `meetings_followups` antes de tocar lógica de status).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Bythak (dev-data-engineer) — DB scope |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main |

## AC Status (DB scope — Bythak)

| AC | Descrição | Status |
|---|---|---|
| AC4 | Migration cleanup converte rows 'não compareceu' em meetings_followups | ✅ `20260427050000_fwup07_nao_compareceu_cleanup.sql` |
| AC4b | meeting_followup_queue não tem meeting_status — N/A | ✅ confirmado — campo não existe nesta tabela |
| AC1 | Auditoria — 16 arquivos convertidos para 'nao_compareceu' | ✅ commit c27863b8 (dev-dev-alpha) |
| AC2 | STATUS_LABELS usa 'nao_compareceu' como key | ✅ commit c27863b8 |
| AC3 | Tipo MeetingStatus centralizado em src/types/meeting.ts | ✅ commit c27863b8 |
| AC5 | Teste manual: criar regra, salvar, recarregar | ⏳ aguarda deploy |
| AC6 | Lint rule no-restricted-syntax em eslint.config.js | ✅ commit c27863b8 |

**Bônus:** trigger `handle_meeting_followup_queue` atualizado para normalizar `'não compareceu'` → `'nao_compareceu'` — corrige falha silenciosa de enfileiramento quando meetings.status chega com acento.

## File List

**DB (Bythak):**
- `supabase/migrations/20260427050000_fwup07_nao_compareceu_cleanup.sql`
- `supabase/migrations/rollbacks/20260427050000_fwup07_nao_compareceu_cleanup.rollback.sql`

**Frontend (Nova/dev-dev-alpha — FWUP-07):**
- `src/types/meeting.ts` — MeetingStatus centralizado (criado)
- `src/hooks/useAgendamentosFollowups.ts` — importa de types/meeting.ts, normalize/denormalize simplificados
- `src/hooks/useCallProFollowups.ts` — FollowupMeetingStatus atualizado, normalize/denormalize simplificados
- `src/hooks/useBIProSchedules.ts` — comparações atualizadas
- `src/hooks/useDashboardAgendamentos.ts` — comparações atualizadas
- `src/hooks/useStubsAll.ts` — tipo atualizado
- `src/components/config/CallProFollowupsConfig.tsx` — MEETING_STATUSES + EMPTY_FORM
- `src/components/followups/AgendamentoFollowupModal.tsx` — STATUS_LABELS key
- `src/components/followups/AgendamentoFollowupsCard.tsx` — STATUS_DESCRIPTIONS key
- `src/components/negocios/NegocioReunioes.tsx` — STATUS_BADGE + STATUS_LABEL keys
- `src/components/reunioes/CalendarioView.tsx` — switch cases
- `src/components/reunioes/CalendarioSemanalView.tsx` — switch cases
- `src/pages/Followups.tsx` — MEETING_STATUSES array + Records
- `src/pages/Reunioes.tsx` — STATUS_CONFIG + STATUS_BADGE + statusCounts + countMap + SelectItem
- `src/pages/ReuniaoSingle.tsx` — STATUS_BADGE + STATUS_ACCENT + STATUS_OPTIONS + canReschedule
- `eslint.config.js` — lint rule no-restricted-syntax

## QA Results

```
VEREDICTO: CONCERNS
Story: FWUP-07 | Data: 2026-04-27 | Auditor: Axikar
Aprovado com observações:
- [LOW] AC5 (teste manual de criação+save+reload de regra com status "Não compareceu") declaradamente pendente.
Verificações:
- Migration 20260427050000_fwup07 backfilla meetings_followups com 'não compareceu' → 'nao_compareceu', atualiza trigger handle_meeting_followup_queue para normalizar status legado, smoke test fail-fast.
- grep `'não compareceu'` em src/: zero matches em 16 arquivos atualizados.
- ESLint rule `no-restricted-syntax` ativa em eslint.config.js:27-31 bloqueando o literal.
- src/types/meeting.ts existe — tipo MeetingStatus centralizado.
- Trigger normaliza both 'agendada'/'agendado' e 'não compareceu'/'nao_compareceu'/'cancelada'/'cancelado' para evitar drift de enfileiramento (bonus além do escopo original).
Próximo passo: @dev-devops push
```
