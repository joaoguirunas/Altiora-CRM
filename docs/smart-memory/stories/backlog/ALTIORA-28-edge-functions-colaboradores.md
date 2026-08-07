---
title: "ALTIORA-28: google-cal-upsert-event — convidar colaboradores adicionais"
type: story
status: active
epic: ALTIORA-D
complexity: S
agent: dev-architect
created: 2026-08-07
updated: 2026-08-07
tags: [story, altiora, reuniao, edge-function, google-calendar, colaboradores]
related: ["[[ALTIORA-27-modal-multi-colaboradores]]", "[[ALTIORA-29-invite-multi-colaboradores]]", "[[../../decisions/ADR-ALTIORA-01-reunioes-multiplos-colaboradores]]"]
---

# ALTIORA-28: google-cal-upsert-event — convidar colaboradores adicionais

> **Revisão 2026-08-07:** escopo reduzido a Google Calendar por decisão do dono do produto. MS Teams
> e Zoom **não** entram nesta story (ver ADR-ALTIORA-01, "Revisão de escopo"). Se o produto pedir
> isso depois, é extensão localizada em `ms-teams-upsert-event`/`zoom-upsert-event` reaproveitando a
> mesma tabela `meeting_collaborators` — sem mudança de schema.

## Objetivo
Fazer com que colaboradores adicionais de uma reunião (`meeting_collaborators`) sejam efetivamente convidados no evento do Google Calendar, sem alterar quem é o organizador (dono do token OAuth usado para criar o evento).

## Acceptance Criteria
- [ ] AC1: `google-cal-upsert-event` (action `create` e `update`) busca `meeting_collaborators` do `meeting_id`, resolve `settings_users.email` de cada um, e os adiciona em `attendees[]` do payload (primary connection), junto do organizador e do cliente — sem impacto no fluxo quando não há colaboradores (array vazio = comportamento atual, 100% retrocompatível).
- [ ] AC2: Se um colaborador não tiver e-mail válido em `settings_users`, a função **não falha** a criação do evento — loga warning e segue sem esse colaborador específico (mesmo padrão de graceful degradation já usado nessa function para `token_refresh_failed`/`create_failed`).
- [ ] AC3: Quando o organizador da reunião é um Super Admin diferente do Closer do lead (ver ALTIORA-27), a function segue usando `meeting.users_id` normalmente para resolver a connection primária — nenhuma mudança de lógica é necessária aqui além do que já existe, só é preciso confirmar que a query de `connections` (linha ~122-129 de `index.ts`) já filtra por `user_id: consultorId = meeting.users_id`, que passa a ser "quem quer que o Super Admin tenha escolhido".
- [ ] AC4: Testes manuais documentados no Dev Agent Record cobrindo: (a) reunião sem colaboradores (regressão — comportamento idêntico ao atual), (b) reunião com 2 colaboradores, (c) reunião organizada por um Super Admin diferente do Closer do lead, com 1 colaborador.

## Escopo

**IN:**
- Query de `meeting_collaborators` + join `settings_users.email` em `google-cal-upsert-event/index.ts`
- Ajuste de `primaryAttendees`/`attendees` no payload de create/update

**OUT:**
- `ms-teams-upsert-event` e `zoom-upsert-event` — fora de escopo desta wave (decisão explícita do produto, 2026-08-07)
- OAuth próprio por colaborador (colaborador nunca é dono/organizador do evento — ver ADR-ALTIORA-01)
- Verificação de conflito de agenda do colaborador
- Notificação in-app ao colaborador (pode ser story futura)

## Contexto Técnico
- `supabase/functions/google-cal-upsert-event/index.ts` — `primaryAttendees` hoje é `[{email: primary.google_email}, {email: clientEmail}]` (linha ~302, repetido em `update`, linha ~342); estender lendo `meeting_collaborators`.
- A function já resolve `consultorId = meeting.users_id` (linha ~115) e busca `connections` por esse id (linha ~122) — nenhuma mudança necessária aí, só confirmar que continua correto quando `users_id` é um Super Admin (ver AC3).
- Depende de ALTIORA-26 (tabela existir); pode ser feita em paralelo com ALTIORA-27 lendo direto da tabela.

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | — |
| Iniciado | — |
| Concluído | — |
| Branch | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
