---
title: "ALTIORA-10: Minha Carteira — visão filtrada pelo Closer autenticado (UC17)"
type: story
status: backlog
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, closer, carteira, frontend]
related: ["[[ALTIORA-07]]", "[[ALTIORA-09]]", "[[ALTIORA-11]]"]
---

# ALTIORA-10: Minha Carteira — visão filtrada pelo Closer autenticado (UC17)

## Objetivo
Implementar a visão "Minha Carteira" que exibe ao Closer autenticado somente os referrals atribuídos a ele, organizados por etapa com destaque para pendências e próximas ações.

## Acceptance Criteria
- [ ] AC1: Closer autenticado acessa a rota `/crm/altiora/carteira` (ou tab "Minha Carteira" no pipeline Altiora) e vê **apenas** referrals com `closer_id = auth.uid()` — verificado em teste com dois Closers diferentes que não veem referrals um do outro.
- [ ] AC2: A visão exibe agrupamento por etapa (mesmas 13 colunas do kanban), com contador por etapa e ordenação por `next_action_due_at ASC` (mais urgente primeiro).
- [ ] AC3: Referrals sem próxima ação definida aparecem em seção destacada "Sem próxima ação" com badge de alerta.
- [ ] AC4: Referrals que foram redistribuídos (o `closer_id` foi alterado para outro) desaparecem automaticamente da carteira do Closer anterior sem necessidade de reload manual (Realtime subscription ou invalidação de query).
- [ ] AC5: Gestor Comercial e Admin visualizam a mesma tela com um seletor "Ver carteira de:" (select de Closers) — sem o seletor, veem todos os referrals sem filtro de Closer.

## Escopo

**IN:**
- Filtro automático `closer_id = auth.uid()` aplicado quando `user_type = 'comercial'`
- Tab ou rota dedicada "Minha Carteira" no contexto do pipeline Altiora
- Ordenação por `next_action_due_at`
- Seletor de Closer para Gestor/Admin

**OUT:**
- Visão de lista alternativa (o kanban existente é suficiente para V1)
- Alertas de SLA (cobre ALTIORA-25)
- Métricas individuais do Closer (cobre ALTIORA-24)

## Contexto Técnico
- RLS em `leads`: verificar se já há política que restringe Closer ao seu próprio `closer_id` — se não, criar via migration
- `src/hooks/useNegociosOptimized.ts` — adicionar parâmetro `closerIdFilter` ao hook existente
- `src/hooks/useAuth.ts` → `profile.id` para obter o UUID do Closer autenticado
- `src/pages/Negocios.tsx` — adicionar lógica: se `user_type === 'comercial'`, setar `responsavelFilter = profile.id` automaticamente

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
