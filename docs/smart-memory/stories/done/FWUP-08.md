---
title: "Story FWUP-08: Corrigir validação de timing CallPro + unificar contrato canal 'ligacao'"
type: story
status: backlog
epic: FWUP
complexity: M
priority: P1
agent: dev-dev-alpha
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, components, validation, callpro, p1]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-02]]"]
---

# Story FWUP-08: Corrigir validação de timing CallPro + unificar contrato canal 'ligacao'

## Objetivo
Resolver dois bugs relacionados em `CallProFollowupsConfig` e `FollowupModal`: (1) `|| true` na linha 114 do CallPro anula validação de timing zerado; (2) canal `ligacao` é tratado como N8N no FollowupModal/StageFollowupsCard mas como AS Discador no AgendamentoFollowupModal — gestor não sabe qual sistema vai disparar.

## Acceptance Criteria
- [x] **AC1:** `CallProFollowupsConfig.tsx` — condição `|| true` removida; validação bloqueia submissão com timing 0/0/0 sem toggle ativo.
- [x] **AC2:** Toggle "Disparo imediato" adicionado; quando ativado, timing fields ficam disabled (opacity-40 + pointer-events-none) e form mantém 0/0/0.
- [x] **AC3:** `FollowupModal.tsx` e `StageFollowupsCard.tsx:93` — textos "via N8N" removidos do canal `ligacao`; desc atualizada para "Discador Atende Simples".
- [x] **AC4:** `FollowupModal` renderiza seletor de fila `call_pro_as_queues` quando canal=`ligacao`.
- [x] **AC5:** Validação bloqueia save de ligação sem `as_queue_id` via `toast.error()`.
- [x] **AC6:** Footer `VariablePicker` atualizado — descreve resolução por channel handler correto.
- [x] **AC7:** `AgendamentoFollowupModal` — `alert()` substituído por `toast.error()` (import sonner adicionado).

## Escopo

**IN:**
- Fix do `|| true` + toggle explícito "Disparo imediato"
- Adicionar seletor `as_queue_id` no FollowupModal quando canal=ligacao
- Migrar `useFollowups` payload pra incluir `as_queue_id` em `leads_stages_followups`
- Migration adicionando coluna `as_queue_id` em `leads_stages_followups` (FK opcional)
- Atualizar textos N8N → channel-handler-correto
- Trocar `alert()` por `toast` no AgendamentoFollowupModal

**OUT:**
- Reformular UX completa do canal ligacao (escopo de design system)
- Implementar webhook customizado por followup de stage (escopo separado se demandado)

## Contexto Técnico

**Arquivos afetados:**
- `src/components/config/CallProFollowupsConfig.tsx:114`
- `src/components/followups/FollowupModal.tsx:316-323, validação`
- `src/components/followups/StageFollowupsCard.tsx:93`
- `src/components/followups/VariablePicker.tsx:208`
- `src/components/followups/AgendamentoFollowupModal.tsx:114, 117, 121`
- `src/hooks/useFollowups.ts` — payload + tipo
- `supabase/migrations/` — `as_queue_id` em `leads_stages_followups`

**Decisão arquitetural:** canal `ligacao` = AS Discador como single source of truth para ambas dimensões (stage + meeting). Se algum tenant precisar de N8N pra ligações, deve usar canal `webhook` explícito (ou criar novo canal `ligacao_n8n`).

**Bloqueado por:** FWUP-02 (estabilizar `meetings_followups` schema antes de adicionar coluna similar em `leads_stages_followups`).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main (commit 9aa73cbe) |

## File List
- `src/components/config/CallProFollowupsConfig.tsx` — || true removido, toggle Disparo imediato adicionado
- `src/components/followups/FollowupModal.tsx` — seletor AS queue + validação + desc N8N removida
- `src/components/followups/StageFollowupsCard.tsx` — texto "via N8N" removido
- `src/components/followups/VariablePicker.tsx` — footer text atualizado
- `src/components/followups/AgendamentoFollowupModal.tsx` — alert() → toast.error() + import sonner
- `src/hooks/useFollowups.ts` — as_queue_id em StageFollowup, DbFollowup, FollowupMutationInput, buildInsert
- `supabase/migrations/20260427060000_fwup08_leads_stages_followups_as_queue.sql` — criado

## QA Results

```
VEREDICTO: PASS
Story: FWUP-08 | Data: 2026-04-27 | Auditor: Axikar
Checklist: 7/7 ACs verificados.
Issues: nenhum
Verificações:
- CallProFollowupsConfig.tsx: zero ocorrências de `|| true`. Toggle "Disparo imediato" presente em linha 199 (Label htmlFor="rule-immediate").
- FollowupModal.tsx: zero ocorrências de "via N8N" / `alert(`. Selector AS queue em linhas 340-341 (canal=ligacao). Validação as_queue_id em linha 135.
- AgendamentoFollowupModal.tsx: zero `alert(` — substituído por toast.error().
- StageFollowupsCard.tsx: "via N8N" removido.
- VariablePicker.tsx: footer atualizado.
- Migration 20260427060000_fwup08 adiciona as_queue_id (FK opcional para call_pro_as_queues) + índice parcial.
- useFollowups.ts inclui as_queue_id em StageFollowup, DbFollowup, FollowupMutationInput, buildInsert.
Próximo passo: @dev-devops push
```
