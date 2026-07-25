---
title: "ALTIORA-14: Registrar realização e comparecimento da reunião (UC23)"
type: story
status: backlog
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, reuniao, comparecimento, frontend]
related: ["[[ALTIORA-13]]", "[[ALTIORA-15]]", "[[ALTIORA-17]]"]
---

# ALTIORA-14: Registrar realização e comparecimento da reunião (UC23)

## Objetivo
Permitir ao Closer marcar uma reunião como realizada, registrar comparecimento/no-show do cliente e solicitar o próximo passo ou reagendamento ao concluir.

## Acceptance Criteria
- [ ] AC1: Card de reunião com horário passado exibe botão "Registrar resultado" com status das opções: Realizada (cliente compareceu), No-show (cliente não compareceu), Cancelada. Ao selecionar, abre drawer de detalhes.
- [ ] AC2: Drawer de "Realizada" solicita: Resultado geral (textarea), Próximo passo (redireciona para modal de Próxima Ação de ALTIORA-11) — campos obrigatórios.
- [ ] AC3: Drawer de "No-show" solicita: Motivo (select: sem aviso, avisou antes, problema técnico, outro) + Ação (Reagendar / Encerrar como Perdido). Se "Reagendar", abre modal de ALTIORA-13.
- [ ] AC4: Registro salva `status` e `compareceu` na tabela de agendamentos/reuniões existente e insere em `lead_interactions` com tipo `meeting_completed` ou `meeting_noshow`.
- [ ] AC5: Reunião realizada de R1 dispara automaticamente a sugestão de preencher o formulário de R1 (link para ALTIORA-15) via toast/banner na ficha do referral.

## Escopo

**IN:**
- Drawer "Registrar resultado" na aba de Reuniões da ficha do referral
- Atualização de status na tabela de agendamentos
- Registro em `lead_interactions`
- Sugestão de preencher formulário pós-reunião (R1/R2/R3)

**OUT:**
- Formulários de R1/R2/R3 em si (cobertos em ALTIORA-15/17/18)
- Integração com Google Calendar para marcar evento como concluído (V2)

## Contexto Técnico
- `src/components/negocios/NegocioReunioes.tsx` — aba de reuniões existente; estender com botão "Registrar resultado"
- Tabela de agendamentos: verificar `agendamentos` (ou `meetings`) — campos `status`, `compareceu`, `resultado`
- `useAgendamentosSimple` hook — verificar se suporta mutação de status

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
