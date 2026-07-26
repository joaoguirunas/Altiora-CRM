---
title: "ALTIORA-24: Indicadores operacionais do funil Altiora (UC09)"
type: story
status: backlog
epic: ALTIORA-F
complexity: L
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, indicadores, dashboard, frontend]
related: ["[[ALTIORA-20]]", "[[ALTIORA-21]]", "[[ALTIORA-23]]"]
---

# ALTIORA-24: Indicadores operacionais do funil Altiora (UC09)

## Objetivo
Criar uma tela de indicadores operacionais para Admin/RevOps e Gestor Comercial com as métricas do funil de referrals Altiora por período, Closer e origem.

## Acceptance Criteria
- [ ] AC1: Página `/crm/altiora/indicadores` (ou tab no pipeline) exibe cards com: Total de referrals recebidos no período, Total atribuídos a Closers, % Contato iniciado (≤ 48h do handoff), Total de R1s realizadas, Taxa de comparecimento R1, Total de R2s e R3s realizadas, Total de ganhos e prêmio total, Total de perdidos com motivos (top 3).
- [ ] AC2: Filtros disponíveis: período (semana atual, mês atual, mês anterior, custom range), Closer (select ou "Todos"), Origem (Avenue, Manual, Indicação).
- [ ] AC3: Indicadores dependentes de SLA (tempo para primeiro contato) apresentam o **tempo medido** em dias/horas sem rotular como "dentro do SLA" ou "fora do SLA" (SLA ainda não definido formalmente).
- [ ] AC4: Dados insuficientes (período sem referrals) exibem "Sem dados para o período selecionado" sem estimativas.
- [ ] AC5: Gestor Comercial vê indicadores de toda a equipe (todos os Closers); Closer autenticado vê apenas seus próprios indicadores sem seletor de Closer.

## Escopo

**IN:**
- Página/tab de indicadores com cards de métricas
- Filtros de período e Closer
- RPCs ou queries agregadas no Supabase (ex: `get_altiora_funnel_metrics(period, closer_id)`)

**OUT:**
- Gráficos avançados / Recharts (V2 — cards numéricos são suficientes para V1)
- Export de relatório (V2)
- Métricas de marketing / origem (V2 — apenas contagem por origem no V1)

## Contexto Técnico
- Dados em: `leads` (count, value), `lead_stage_history` (tempo por etapa), `lead_interactions` (first_contact_at)
- RPC sugerida: `get_altiora_metrics(p_tenant_id, p_closer_id, p_from, p_to)` retornando JSON com todos os indicadores
- Permissão: verificar `user_type` antes de renderizar a tela — bloquear acesso de Closers (redirecionar para carteira)
- UI base: usar cards `shadcn/ui` para métricas numéricas; não depende de biblioteca de charts no V1

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
