---
title: "ALTIORA-18: Registrar R3 e decisão final — avançar ou encerrar (UC27)"
type: story
status: backlog
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, r3, fechamento, frontend]
related: ["[[ALTIORA-17]]", "[[ALTIORA-19]]", "[[ALTIORA-20]]"]
---

# ALTIORA-18: Registrar R3 e decisão final — avançar ou encerrar (UC27)

## Objetivo
Permitir ao Closer registrar o resultado da R3 com estrutura confirmada e levar o referral para "Em contratação" (se avançar) ou iniciar o fluxo de encerramento como Perdido (se não avançar).

## Acceptance Criteria
- [ ] AC1: Na ficha do referral em etapa "R3 realizada/fechamento" ou posterior, seção "Resultado da R3" exibe: Estrutura confirmada (select: previdência, seguro de vida, investimentos, combo, pendente), Valor estimado (numeric, opcional), Comparecimento (sim/não), Resultado geral (textarea — obrigatório), Decisão do cliente (select: Avançar para contratação, Não avançar, Continuar negociação).
- [ ] AC2: Ao selecionar "Avançar para contratação" e salvar, o referral move automaticamente para a etapa "Em contratação" sem drag-and-drop manual.
- [ ] AC3: Ao selecionar "Não avançar", o sistema redireciona para o modal de encerramento como Perdido (ALTIORA-19) com o campo "etapa da perda" pré-preenchido.
- [ ] AC4: "Continuar negociação" salva o resultado e mantém o referral na etapa atual com solicitação de próxima ação (UC19 / ALTIORA-11).
- [ ] AC5: Campos de resultado da R3 incompletos (resultado vazio, decisão não selecionada) impedem conclusão e destacam os campos obrigatórios.

## Escopo

**IN:**
- Seção "Resultado da R3" na ficha do referral
- Transição automática para "Em contratação" ao avançar
- Redirecionamento para fluxo de Perdido ao não avançar
- Persistência em `lead_field_values`

**OUT:**
- Formulário de acompanhamento de contratação (cobre ALTIORA-20)
- Campos de R1/R2 (cobertos em ALTIORA-15/17)

## Contexto Técnico
- Campos R3 em `lead_field_definitions`: `estrutura_confirmada_r3`, `valor_estimado_r3`, `resultado_r3`, `decisao_cliente_r3`
- Transição de etapa via `useUpdateNegocioStage` ou `useUpdateNegocio` com `leads_stages_id` = id de "Em contratação"
- Etapa "Em contratação" = position 11 no pipeline Altiora — usar id da etapa, não posição hardcoded

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
