---
title: "ALTIORA-11: Registrar primeiro contato e definir próxima ação (UC18/UC19)"
type: story
status: backlog
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, contato, proxima-acao, frontend]
related: ["[[ALTIORA-08]]", "[[ALTIORA-10]]", "[[ALTIORA-12]]"]
---

# ALTIORA-11: Registrar primeiro contato e definir próxima ação (UC18/UC19)

## Objetivo
Permitir ao Closer registrar o primeiro contato com o cliente (data, canal, resultado) e definir a próxima ação (tipo, descrição, responsável, prazo), atualizando automaticamente a etapa para "Contato iniciado" no primeiro registro.

## Acceptance Criteria
- [ ] AC1: Na ficha do referral, botão "Registrar contato" abre um modal/drawer com campos: Data/hora do contato (date-time picker, default = agora), Canal (select: WhatsApp, Ligação, E-mail), Resposta do cliente (select: Respondeu, Não respondeu, Número errado), Resultado (textarea). Ao salvar, insere em `lead_interactions(type='first_contact', ...)` e move a etapa para "Contato iniciado" se ainda em "Encaminhado ao comercial".
- [ ] AC2: Data de contato anterior à data de handoff do referral gera erro inline "Data anterior ao recebimento do referral" e não salva.
- [ ] AC3: Após registrar contato, o sistema solicita automaticamente "Definir próxima ação" (modal encadeado ou seção destacada na ficha) com campos: Tipo (Ligação, Reunião, E-mail, Tarefa), Descrição (text), Responsável (select Closers), Prazo (date picker — obrigatório se a etapa exigir).
- [ ] AC4: Próxima ação salva atualiza `leads.next_action_type`, `leads.next_action_description`, `leads.next_action_due_at` — card no kanban reflete o prazo imediatamente (ALTIORA-03).
- [ ] AC5: Segundo registro de contato NÃO move a etapa novamente — apenas insere nova interação no histórico.

## Escopo

**IN:**
- Modal "Registrar Contato" com campos acima
- Modal/seção "Próxima Ação" encadeado após contato
- Atualização automática de etapa para "Contato iniciado"
- Atualização dos campos `next_action_*` em `leads`

**OUT:**
- Integração WhatsApp (canal listado mas sem automação no V1)
- Agendamento de reunião via Google Calendar (cobre ALTIORA-13)

## Contexto Técnico
- Tabela `lead_interactions` — verificar schema existente (tipo, descrição, data, actor_id, lead_id)
- `src/components/negocios/NegocioInteracoes.tsx` — atualmente com mock data; substituir por dados reais
- Campos `next_action_*` em `leads`: adicionar via migration se não existirem (ALTIORA-03 pode cobrir)
- Etapa "Contato iniciado" = etapa de `position = 3` no pipeline Altiora — usar id da etapa, não posição hardcoded

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
