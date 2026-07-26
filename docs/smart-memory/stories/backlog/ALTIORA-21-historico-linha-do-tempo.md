---
title: "ALTIORA-21: Linha do tempo e histórico do referral (UC04/RF-07)"
type: story
status: backlog
epic: ALTIORA-E
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, historico, audit, frontend]
related: ["[[ALTIORA-08]]", "[[ALTIORA-11]]", "[[ALTIORA-12]]"]
---

# ALTIORA-21: Linha do tempo e histórico do referral (UC04/RF-07)

## Objetivo
Exibir na ficha do referral uma linha do tempo cronológica com todos os eventos relevantes: mudanças de etapa, contatos registrados, reuniões, atribuições de Closer e encerramento/reabertura.

## Acceptance Criteria
- [ ] AC1: Aba "Histórico" na ficha do referral exibe eventos em ordem cronológica reversa (mais recente no topo) com: tipo de evento (ícone + label), descrição, ator (nome do usuário), data/hora relativa ("há 2h", "ontem").
- [ ] AC2: Tipos de evento exibidos: mudança de etapa (de → para), primeiro contato registrado, reunião agendada/realizada/no-show, atribuição/reatribuição de Closer, encerramento como Perdido, Ganho, Reabertura, campos críticos alterados (valor do prêmio, produto).
- [ ] AC3: Linha do tempo é carregada de `lead_interactions` e `lead_stage_history` — sem dados mockados.
- [ ] AC4: Histórico é imutável — nenhum evento pode ser deletado pela UI (apenas Admin via acesso direto ao banco em casos excepcionais).
- [ ] AC5: Linha do tempo carrega os últimos 50 eventos por padrão com botão "Ver mais" para paginação (sem scroll infinito no V1).

## Escopo

**IN:**
- Aba "Histórico" na `NegocioSidebar` com timeline de eventos
- Query em `lead_interactions` + `lead_stage_history` (join)
- Exibição de tipo, ator, descrição e data

**OUT:**
- Export do histórico (V2)
- Filtros na linha do tempo (V2)
- Edição de registros do histórico (fora de escopo — auditoria imutável)

## Contexto Técnico
- `src/components/negocios/NegocioInteracoes.tsx` — atualmente com mock data; substituir por query real de `lead_interactions`
- `lead_interactions` schema: verificar colunas existentes (type, description, actor_id, created_at, lead_id, metadata JSONB)
- `lead_stage_history` criado no ALTIORA-12 — fazer JOIN para exibir eventos de mudança de etapa
- Hook: `useLeadInteractions(leadId)` — criar ou adaptar o hook existente
- Paginar com `.range(0, 49)` + botão "Ver mais" com offset

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
