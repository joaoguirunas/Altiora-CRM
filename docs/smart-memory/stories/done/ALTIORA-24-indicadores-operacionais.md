---
title: "ALTIORA-24: Indicadores operacionais do funil Altiora (UC09)"
type: story
status: done
epic: ALTIORA-F
complexity: L
agent: dev-dev-alpha
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, indicadores, dashboard, frontend]
related: ["[[ALTIORA-20]]", "[[ALTIORA-21]]", "[[ALTIORA-23]]"]
---

# ALTIORA-24: Indicadores operacionais do funil Altiora (UC09)

## Objetivo
Criar uma tela de indicadores operacionais para Admin/RevOps e Gestor Comercial com as métricas do funil de referrals Altiora por período, Closer e origem.

## Acceptance Criteria
- [x] AC1: Página `/crm/altiora/indicadores` exibe cards com: Total referrals recebidos, Total atribuídos a Closers, Contato iniciado (%), R1s/R2s/R3s agendadas e comparecidas, Total ganhos e prêmio total, Total perdidos com motivos top 3.
- [x] AC2: Filtros disponíveis: período (semana atual, mês atual, mês anterior, custom range), Closer (select ou "Todos"), Origem.
- [x] AC3: Indicadores de R1/R2/R3 exibem tempo medido (taxa comparecimento %) sem rotular como SLA.
- [x] AC4: Dados insuficientes exibem "Sem dados para o período selecionado" sem estimativas.
- [x] AC5: Gestor vê todos os Closers com seletor; Closer autenticado vê apenas seus próprios indicadores sem seletor.

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
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/hooks/useAltioraMetrics.ts` — criado: hook de métricas com getPeriodoRange e queries leads+meetings
- `src/pages/AltioraIndicadores.tsx` — criado: página com filtros e grid de metric cards
- `src/App.tsx` — modificado: rota /crm/altiora/indicadores adicionada

## QA Results
<!-- QA preenche ao revisar -->
