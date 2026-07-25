---
title: "ALTIORA-09: Filtros e busca avançada no pipeline Altiora (UC03)"
type: story
status: active
epic: ALTIORA-C
complexity: M
agent: dev-dev-alpha
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, filtros, busca, frontend]
related: ["[[ALTIORA-02]]", "[[ALTIORA-10]]", "[[ALTIORA-08]]"]
---

# ALTIORA-09: Filtros e busca avançada no pipeline Altiora (UC03)

## Objetivo
Garantir que os filtros da toolbar do pipeline Altiora incluam as dimensões específicas do negócio (Closer, origem, etapa, produto, reunião agendada) e que a busca textual cubra nome, e-mail e telefone do cliente.

## Acceptance Criteria
- [x] AC1: `NegociosToolbar` exibe filtros adicionais quando o pipeline Altiora está ativo:
  - **Closer**: seletor "Ver carteira de:" na toolbar principal (implementado via ALTIORA-10)
  - **Origem** (avenue_email / manual / outros): select no popover "Filtros", condicional a `isAltiora`
  - **Produto**: select existente no popover (kiwifyProductOptions — já funcional)
- [x] AC2: Busca textual por nome, e-mail ou whatsapp — OR clause estendida com `clients_people.email.ilike` e `clients_people.whatsapp.ilike` (debounce 500ms em Negocios.tsx).
- [x] AC3: Filtro por etapa (`stageFilter`) funciona com todas as 13 etapas Altiora (infraestrutura validada em ALTIORA-02).
- [x] AC4: Combinação de múltiplos filtros reduz lista corretamente — AND lógico preservado; cada filtro appenda `.eq()` independente na query.
- [x] AC5: `handleClearFilters` e `clearSecondaryFilters` resetam todos os filtros incluindo `origemFilter` e `closerIdFilter`.

## Escopo

**IN:**
- Filtro Origem no popover (condicional ao pipeline Altiora)
- Busca textual estendida para email + whatsapp
- Propagação origemFilter: Negocios → KanbanBoard → useNegociosByStage → query

**OUT:**
- Salvar visões de filtro (FA-01 do UC03 — V2)
- Criação de novos hooks de query do zero (estendemos os existentes)

## Contexto Técnico
- `altiora_origem` field existe em `leads` (migration 20260725120000): `avenue_email | manual | outros`
- `clients_people.whatsapp` e `clients_people.email` existem na tabela com indexes
- OR clause no PostgREST aceita nested table references no formato `table.column.ilike.value`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 (todos AC ✅) |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/hooks/useNegociosOptimized.ts` — modificado (origemFilter em NegocioFilters + query eq; searchFilter estendido; altiora_origem em NegocioOptimized)
- `src/components/negocios/KanbanBoard.tsx` — modificado (origemFilter prop → useNegociosByStage)
- `src/components/negocios/NegociosToolbar.tsx` — modificado (origemFilter props; Select "Origem" no popover; clearSecondaryFilters atualizado)
- `src/pages/Negocios.tsx` — modificado (origemFilter state; handleClearFilters; props para toolbar e KanbanBoard)

## QA Results
<!-- QA preenche ao revisar -->
