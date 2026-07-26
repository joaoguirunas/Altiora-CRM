---
title: "ALTIORA-17: Registrar informações da R2 — produto, objeções e data da R3 (UC26)"
type: story
status: backlog
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, r2, produto, frontend]
related: ["[[ALTIORA-16]]", "[[ALTIORA-18]]", "[[ALTIORA-14]]"]
---

# ALTIORA-17: Registrar informações da R2 — produto, objeções e data da R3 (UC26)

## Objetivo
Disponibilizar ao Closer o formulário pós-R2 com produto apresentado, objeções levantadas, nível de interesse do cliente e data prevista da R3.

## Acceptance Criteria
- [ ] AC1: Na ficha do referral em etapa "R2 realizada" ou posterior, seção "Resultado da R2" exibe: Produto apresentado (select: previdência, seguro de vida, investimentos, proteção patrimonial, combo), Objeções levantadas (textarea), Nível de interesse (select: alto, médio, baixo, sem interesse), Resultado geral (textarea), Data prevista da R3 (date picker — obrigatório quando nível de interesse é alto ou médio).
- [ ] AC2: Contexto da R1 (diagnóstico, score, produtos de interesse) é exibido em modo read-only acima do formulário como referência ao Closer.
- [ ] AC3: Alerta exibido quando Análise Finvity não foi registrada (ALTIORA-16) — mensagem "Análise Finvity pendente" com link para preencher; Closer pode prosseguir com confirmação explícita.
- [ ] AC4: Ao salvar, persiste campos em `lead_field_values` e atualiza `leads.next_action_due_at` com a data da R3 quando informada.
- [ ] AC5: Formulário disponível apenas quando referral está na etapa "R2 realizada" — exibe "Preencher após a R2" nas etapas anteriores.

## Escopo

**IN:**
- Seção "Resultado da R2" na ficha do referral
- Exibição do contexto da R1 em read-only
- Alerta de Finvity pendente com opção de confirmar para prosseguir
- Persistência em `lead_field_values`

**OUT:**
- Formulário de R3 (cobre ALTIORA-18)
- Dados Elephan para R2 (V2 — V1 é totalmente manual)

## Contexto Técnico
- Campos R2 em `lead_field_definitions`: `produto_apresentado_r2`, `objecoes_r2`, `interesse_r2`, `resultado_r2`, `data_prevista_r3`
- Exibir contexto R1: ler `lead_field_values` do mesmo `lead_id` para campos do grupo "r1"
- Verificar `link_finvity` em `lead_field_values` para condição de alerta

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
