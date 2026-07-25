---
title: "ALTIORA-09: Filtros e busca avançada no pipeline Altiora (UC03)"
type: story
status: backlog
epic: ALTIORA-C
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, filtros, busca, frontend]
related: ["[[ALTIORA-02]]", "[[ALTIORA-10]]", "[[ALTIORA-08]]"]
---

# ALTIORA-09: Filtros e busca avançada no pipeline Altiora (UC03)

## Objetivo
Garantir que os filtros da toolbar do pipeline Altiora incluam as dimensões específicas do negócio (Closer, origem, etapa, produto, reunião agendada) e que a busca textual cubra nome, e-mail e telefone do cliente.

## Acceptance Criteria
- [ ] AC1: `NegociosToolbar` exibe filtros adicionais quando o pipeline Altiora está ativo: **Closer** (select multi com todos os Closers ativos), **Origem** (Avenue / Indicação / Manual), **Produto** (select com produtos cadastrados).
- [ ] AC2: Busca textual por nome, e-mail ou telefone retorna resultados em < 500ms para até 500 referrals ativos (aceito com debounce de 300ms já existente).
- [ ] AC3: Filtro por etapa (já existente como `stageFilter`) funciona corretamente com todas as 13 etapas do pipeline Altiora.
- [ ] AC4: Combinação de múltiplos filtros reduz a lista corretamente (AND lógico entre filtros diferentes).
- [ ] AC5: Ao limpar todos os filtros, o estado retorna ao padrão `statusFilter = 'sem-perdidos'` e nenhum filtro fica "travado".

## Escopo

**IN:**
- Adicionar filtros de Closer e Origem ao `NegociosToolbar` — condicionais ao pipeline Altiora
- Garantir que `useNegociosPipeline` / `useNegociosByStage` aceite `closerFilter` e `origemFilter` como parâmetros de query

**OUT:**
- Salvar visões de filtro (FA-01 do UC03 — V2)
- Criação de novos hooks de query do zero (estender os existentes)

## Contexto Técnico
- `src/components/negocios/NegociosToolbar.tsx` — toolbar de filtros existente
- `src/hooks/useNegociosOptimized.ts` → `useNegociosPipeline` — adicionar parâmetros de filtro
- `src/pages/Negocios.tsx` — orquestração de estados de filtro; adicionar `closerFilter` e `origemFilter`
- Supabase query: `.eq('closer_id', closerFilter)` / `.eq('source', origemFilter)` ao filtro existente

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
