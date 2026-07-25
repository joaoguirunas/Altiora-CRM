---
title: "ALTIORA-10: Minha Carteira — visão filtrada pelo Closer autenticado (UC17)"
type: story
status: active
epic: ALTIORA-D
complexity: M
agent: dev-dev-alpha
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, closer, carteira, frontend]
related: ["[[ALTIORA-07]]", "[[ALTIORA-09]]", "[[ALTIORA-11]]"]
---

# ALTIORA-10: Minha Carteira — visão filtrada pelo Closer autenticado (UC17)

## Objetivo
Implementar a visão "Minha Carteira" que exibe ao Closer autenticado somente os referrals atribuídos a ele, organizados por etapa com destaque para pendências e próximas ações.

## Acceptance Criteria
- [x] AC1: Closer autenticado acessa pipeline Altiora e vê **apenas** referrals com `altiora_closer_id = profile.id` — auto-aplicado via useEffect em Negocios.tsx quando `isComercial && isAltiora`.
- [ ] AC2: A visão exibe agrupamento por etapa (mesmas 13 colunas do kanban), com contador por etapa e ordenação por `next_action_due_at ASC` (mais urgente primeiro). — **PENDENTE**: ordenação next_action_due_at depende de migration não aplicada; agrupamento por etapa já funciona via Kanban existente.
- [ ] AC3: Referrals sem próxima ação definida aparecem em seção destacada "Sem próxima ação" com badge de alerta. — **PENDENTE**: depende de migration next_action_*.
- [ ] AC4: Referrals redistribuídos desaparecem automaticamente da carteira do Closer anterior. — Implementado via Realtime subscription em useNegociosPipeline; ao trocar altiora_closer_id o lead sai da view filtrada.
- [x] AC5: Gestor Comercial e Admin visualizam o seletor "Ver carteira de:" na toolbar — Select de Closers (user_type='comercial') integrado na NegociosToolbar, condicional a `isAltiora && isManager`.

## Escopo

**IN:**
- Filtro automático `altiora_closer_id = profile.id` aplicado quando `user_type = 'comercial'` + pipeline Altiora
- Seletor de Closer para Gestor/Admin na toolbar
- Filtro propagado: Negocios → KanbanBoard → useNegociosByStage → query Supabase

**OUT:**
- Visão de lista alternativa (o kanban existente é suficiente para V1)
- Alertas de SLA (cobre ALTIORA-25)
- Métricas individuais do Closer (cobre ALTIORA-24)

## Contexto Técnico
- RLS em `leads`: verificar se já há política que restringe Closer ao seu próprio `closer_id` — se não, criar via migration
- `src/hooks/useNegociosOptimized.ts` — `closerIdFilter` adicionado em NegocioFilters e na query
- `src/hooks/useAuth.ts` → `profile.id` para obter o UUID do Closer autenticado
- `src/pages/Negocios.tsx` — useEffect auto-aplica `closerIdFilter = user.profile.id` para Closers

## Notas de implementação
- AC1 e AC5 implementados com infraestrutura de filtro completa
- AC2 e AC3 dependem de migration `next_action_*` — pendente Arch
- AC4 funciona por efeito colateral do Realtime + filtro: quando altiora_closer_id muda, a query do Closer anterior retorna zero registros para aquele lead

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 (AC1+AC5 ✅; AC2+AC3 pendente migration; AC4 via Realtime) |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/hooks/useNegociosOptimized.ts` — modificado (closerIdFilter em NegocioFilters + query eq)
- `src/components/negocios/KanbanBoard.tsx` — modificado (closerIdFilter prop → useNegociosByStage)
- `src/components/negocios/NegociosToolbar.tsx` — modificado (isAltiora, closerIdFilter, onCloserIdFilterChange props + Select Closers)
- `src/pages/Negocios.tsx` — modificado (closerIdFilter state, useEffect auto-apply, props para KanbanBoard e NegociosToolbar)

## QA Results
<!-- QA preenche ao revisar -->
