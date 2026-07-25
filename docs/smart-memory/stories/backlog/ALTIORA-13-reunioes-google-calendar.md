---
title: "ALTIORA-13: Reuniões — agendar, reagendar e cancelar via Google Calendar (UC21/UC22)"
type: story
status: backlog
epic: ALTIORA-D
complexity: XL
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, reuniao, google-calendar, meet, fullstack]
related: ["[[ALTIORA-12]]", "[[ALTIORA-14]]", "[[ALTIORA-15]]"]
---

# ALTIORA-13: Reuniões — agendar, reagendar e cancelar via Google Calendar (UC21/UC22)

## Objetivo
Permitir ao Closer agendar R1, R2 e R3 diretamente do CRM via Google Calendar com criação automática de Google Meet, e reagendar/cancelar com sincronização bidirecional do evento.

## Acceptance Criteria
- [ ] AC1: Na ficha do referral, botão "Agendar R1" abre modal com campos: Data/hora (date-time picker com fuso horário do usuário), Duração (30/45/60/90 min), Participantes (e-mail do cliente pré-preenchido + opcionais). Ao confirmar, cria evento no Google Calendar do Closer autenticado com Google Meet link automático via OAuth existente.
- [ ] AC2: `link_meet_r1` (R1) / `link_meet_r2` (R2) / `link_meet_r3` (R3) é salvo automaticamente em `lead_field_values` após criação bem-sucedida do evento. O campo aparece na ficha e no card do kanban.
- [ ] AC3: Conflito de horário no calendário do Closer (evento existente no mesmo slot) exibe aviso "Conflito de agenda detectado" e não cria o evento — usuário pode confirmar forçado ou escolher outro horário.
- [ ] AC4: Botão "Reagendar" no card de reunião existente abre o mesmo modal pré-preenchido; ao confirmar, atualiza o evento existente no Google Calendar (PATCH, não cria novo) e atualiza o campo de data na reunião.
- [ ] AC5: **Fallback manual**: se a integração Google Calendar não estiver configurada ou falhar, o modal mantém campos de data/hora e link (input manual) — Closer insere o link do Meet criado externamente e salva sem integração.
- [ ] AC6: Cada agendamento/reagendamento/cancelamento insere registro em `lead_interactions` com tipo, data, ator e link do evento.

## Escopo

**IN:**
- Modal de agendamento de reunião (R1/R2/R3) com integração Google Calendar OAuth (infra existente)
- Criação de evento + Google Meet via Google Calendar API
- Reagendamento (PATCH) e cancelamento (DELETE/status cancelled) do evento
- Fallback manual quando integração indisponível
- Registro em `lead_interactions` e atualização dos campos `link_meet_*`

**OUT:**
- Registro de realização/comparecimento da reunião (cobre ALTIORA-14)
- Formulários específicos de R1/R2/R3 pós-reunião (cobertos em ALTIORA-15/17/18)
- Integração com calendário de terceiros (somente Google Calendar no V1)

## Contexto Técnico
- OAuth Google Calendar: verificar em `src/components/negocios/NegocioReunioes.tsx` — já usa `useAgendamentosSimple` e `NovaReuniaoWizardModal`; reutilizar esses componentes adaptando para o contexto Altiora
- `src/components/modals/NovaReuniaoWizardModal.tsx` — wizard existente de reunião; verificar se suporta R1/R2/R3 como tipos ou se precisa extensão
- Campos `link_meet_r1/r2/r3` criados no ALTIORA-01 em `lead_field_definitions`
- Tabela `agendamentos` ou `meetings` existente — verificar schema antes de criar nova

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | — |
| Branch     | feature/ALTIORA-05-07-13-email-closer-calendar |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
