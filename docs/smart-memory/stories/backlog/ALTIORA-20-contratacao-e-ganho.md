---
title: "ALTIORA-20: Acompanhar contratação e registrar Ganho (UC28/UC29)"
type: story
status: backlog
epic: ALTIORA-E
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, contratacao, ganho, frontend]
related: ["[[ALTIORA-18]]", "[[ALTIORA-21]]", "[[ALTIORA-24]]"]
---

# ALTIORA-20: Acompanhar contratação e registrar Ganho (UC28/UC29)

## Objetivo
Permitir ao Closer atualizar manualmente o andamento do processo de contratação (documentos, exames, entrevista financeira, underwriting) e registrar o negócio como Ganho quando a emissão for confirmada.

## Acceptance Criteria
- [ ] AC1: Na ficha do referral em etapa "Em contratação", seção "Acompanhamento de Contratação" exibe checklist: Documentos coletados (toggle + data), Exames médicos (toggle + data, com opção "Não aplicável"), Entrevista financeira realizada (toggle + data), Underwriting aprovado (toggle + data). Cada item salva individualmente ao ser marcado.
- [ ] AC2: Closer pode marcar qualquer item do checklist como "Não aplicável" com observação — item aparece riscado e não bloqueia o avanço para Ganho.
- [ ] AC3: Botão "Registrar Ganho" aparece somente após pelo menos 1 item do checklist estar marcado (ou todos como não aplicável). Ao clicar, abre modal com: Data de emissão (date — obrigatório), Valor do prêmio confirmado (numeric — obrigatório), Parceiro emissor (text — obrigatório).
- [ ] AC4: Ao confirmar Ganho, referral move para etapa "Ganho", `leads.status = 'won'`, `leads.value` atualizado com valor do prêmio, e `lead_interactions` recebe registro `type = 'referral_won'` com todos os dados de fechamento.
- [ ] AC5: Emissão ainda não confirmada (data de emissão não preenchida) bloqueia o botão "Registrar Ganho" com tooltip explicativo — referral permanece em "Em contratação".

## Escopo

**IN:**
- Seção "Acompanhamento de Contratação" com checklist na ficha do referral
- Modal "Registrar Ganho" com campos obrigatórios
- Transição automática para etapa "Ganho" ao confirmar

**OUT:**
- Correção de dados pós-fechamento (Gestor/Admin acessa via ALTIORA-22)
- Métricas de ganhos por período (cobre ALTIORA-24)

## Contexto Técnico
- Campos de contratação em `lead_field_definitions`: `docs_coletados`, `docs_coletados_at`, `exames_medicos`, `exames_medicos_at`, `entrevista_financeira`, `entrevista_financeira_at`, `underwriting`, `underwriting_at`, `data_emissao`, `valor_premio`, `parceiro_emissor`
- `useUpdateNegocio` — hook para atualizar `value` e `status = 'won'`
- Etapa "Ganho" = position 12 no pipeline Altiora — usar id da etapa
- Checklist: persistir em `lead_field_values` individualmente; UI em formato lista com toggle + date input inline

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
