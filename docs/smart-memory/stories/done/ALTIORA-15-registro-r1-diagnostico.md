---
title: "ALTIORA-15: Registrar diagnóstico da R1 (UC24)"
type: story
status: backlog
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, r1, diagnostico, frontend]
related: ["[[ALTIORA-14]]", "[[ALTIORA-16]]", "[[ALTIORA-12]]"]
---

# ALTIORA-15: Registrar diagnóstico da R1 (UC24)

## Objetivo
Disponibilizar ao Closer um formulário de diagnóstico pós-R1 com campos do playbook Altiora, suporte a preenchimento manual completo (fallback Elephan) e registro persistente vinculado ao referral.

## Acceptance Criteria
- [ ] AC1: Na ficha do referral em etapa "R1 realizada", seção "Diagnóstico R1" exibe campos: Situação patrimonial (select: acima de R$300k, R$150k-R$300k, abaixo de R$150k), Renda mensal estimada (numeric), Perfil de risco (select: conservador, moderado, arrojado), Produtos de interesse (multiselect: previdência, seguro de vida, investimentos, proteção patrimonial), Objeções identificadas (textarea), Score de interesse (1-5 stars), Data prevista da R2 (date picker), Observações adicionais (textarea).
- [ ] AC2: Todos os campos são editáveis pelo Closer; ao salvar, persiste em `lead_field_values` para os campos definidos no ALTIORA-01 (entity = `lead`, pipeline = Altiora).
- [ ] AC3: Se dados da Elephan estiverem disponíveis (flag `elephan_data_available` no referral), os campos compatíveis são pré-preenchidos com os dados importados — Closer pode revisar e corrigir qualquer campo.
- [ ] AC4: "Data prevista da R2" salva em `leads.next_action_due_at` com tipo "R2 agendada" e aparece no card do kanban.
- [ ] AC5: Formulário exibido somente quando referral está na etapa "R1 realizada" ou posterior — nas etapas anteriores, seção exibe "Preencher após a R1".

## Escopo

**IN:**
- Seção "Diagnóstico R1" na ficha do referral (nova aba ou seção expandível)
- Campos de diagnóstico persistidos em `lead_field_values`
- Pré-preenchimento com dados Elephan quando disponível (fallback manual total)

**OUT:**
- Integração real com API Elephan (V2 — V1 é totalmente manual)
- Formulário de R2 (cobre ALTIORA-17)
- Análise Finvity (cobre ALTIORA-16)

## Contexto Técnico
- `lead_field_definitions` e `lead_field_values` — campos criados no ALTIORA-01; usar hooks `useLeadFieldDefinitionsByEntity` / `useLeadFieldValuesByEntity`
- Filtrar campos do grupo "diagnóstico_r1" por `metadata.group = 'r1'` ou nome prefixado
- Condição de visibilidade: verificar `stage_position >= posição de R1 realizada`

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
