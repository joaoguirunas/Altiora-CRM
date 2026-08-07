---
title: "ALTIORA-27: Modal de agendamento — organizador livre (Super Admin) e colaboradores adicionais"
type: story
status: active
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-08-07
updated: 2026-08-07
tags: [story, altiora, reuniao, ui, colaboradores, super-admin]
related: ["[[ALTIORA-26-db-meeting-collaborators]]", "[[ALTIORA-28-edge-functions-colaboradores]]", "[[../../decisions/ADR-ALTIORA-01-reunioes-multiplos-colaboradores]]"]
---

# ALTIORA-27: Modal — organizador livre (Super Admin) e colaboradores adicionais

> **Revisão 2026-08-07:** escopo ampliado após feedback do dono do produto. Não é mais só "Closer +
> colaboradores extras" — Super Admin também pode escolher livremente **quem organiza** a reunião
> (não só o Closer do lead), além de adicionar colaboradores (inclusive outros Super Admins). Ver
> ADR-ALTIORA-01, seção "Revisão de escopo".

## Objetivo
Para Closer comum: manter o comportamento atual (organizador = ele mesmo/Closer do lead), com opção de adicionar 1+ colegas como colaboradores da reunião. Para Super Admin: permitir escolher livremente o organizador (default = ele mesmo) e adicionar qualquer usuário ativo (incluindo outro Super Admin) como colaborador — tudo isso sem alterar `leads.altiora_closer_id`.

## Acceptance Criteria
- [x] AC1 (Closer comum): comportamento idêntico ao atual — organizador é sempre `closerId` recebido via props (ficha do referral), sem campo de escolha. Modal ganha apenas o campo opcional/colapsado "Colaboradores adicionais (exceção)" — multi-select de closers ativos via `useAltioraClosers`, excluindo o próprio organizador da lista.
- [x] AC2 (Super Admin — `super_adm === true` via `useAuth`): modal ganha campo "Organizador" (Select, não multi-select) pré-preenchido com o próprio Super Admin, editável para qualquer `settings_users` ativo — populado por novo hook `useAltioraInternalUsers()` (todos os usuários internos ativos, sem filtro de `user_type`, diferente de `useAltioraClosers` que só traz closers). Campo "Colaboradores adicionais" também usa `useAltioraInternalUsers()` para Super Admin (permite selecionar outro Super Admin), excluindo quem já foi escolhido como organizador.
- [x] AC3: Campo de colaboradores é colapsado/opcional por padrão (ex: link "+ Adicionar colaborador") em ambos os perfis — reforça que é exceção, não o fluxo padrão.
- [x] AC4: Ao criar a reunião (`useCreateAltioraMeeting`), `closerId` passa a ser semanticamente "organizerId" no payload (o valor efetivo salvo em `meetings.users_id`) — para Closer comum é sempre o closer da ficha; para Super Admin é o valor escolhido no Select do AC2. Colaboradores selecionados são persistidos em `meeting_collaborators` (role `co_host`) logo após o insert em `meetings`, antes do sync de calendário.
- [x] AC5: Ao reagendar (`useUpdateAltioraMeeting`), a lista de colaboradores existente é carregada e editável (adicionar/remover) via diff (insert dos novos, delete dos removidos). Trocar o organizador de uma reunião já criada fica **fora de escopo** desta story (reagendamento não decide "quem" recomeça o evento no Google Calendar — evitar reescrever o dono do token no meio do fluxo; se necessário, cancelar e recriar).
- [x] AC6: Ficha do referral (seção de reuniões / `AltioraReunioes.tsx`) exibe: organizador (sempre, como hoje) + badges com nome dos colaboradores extra, quando existirem. Card do Kanban NÃO muda (organizador/colaborador de reunião não é o Closer do lead — não deve aparecer ali).

## Escopo

**IN:**
- Campo "Organizador" (Select) visível só para Super Admin, com default = ele mesmo
- Multi-select de colaboradores no modal de agendar/reagendar, para ambos os perfis (fonte de dados diferente por perfil — closers vs. todos os internos)
- Novo hook `useAltioraInternalUsers()` em `src/hooks/useAltioraClosers.ts` (ou arquivo próprio) — reaproveitar padrão de `useAltioraClosers` sem o filtro `user_type='closer'`
- Hooks: estender `useAltioraMeetings.ts` (`CreateAltioraMeetingParams`/`UpdateAltioraMeetingParams` ganham `collaboratorIds?: string[]`; novo hook `useMeetingCollaborators(meetingId)` para leitura)
- Exibição na ficha do referral (seção de reuniões)

**OUT:**
- Mudança em `leads.altiora_closer_id`, Kanban card, `useAltioraClosers`/`useAtribuirCloser`
- Trocar organizador de reunião já criada (reagendamento não cobre isso — ver AC5)
- Sync com Google Calendar como attendee (ALTIORA-28) — MS Teams/Zoom permanecem fora do escopo (ver ADR-ALTIORA-01)
- Verificação de conflito de agenda para colaboradores (segue limitação conhecida do ADR)

## Contexto Técnico
- Depende de ALTIORA-26 (tabela `meeting_collaborators`) já aplicada.
- `src/hooks/useAuth.ts` — `super_adm: boolean` já existe no perfil do usuário logado; usar para gate condicional do campo "Organizador".
- `src/hooks/useAltioraMeetings.ts` — `CreateAltioraMeetingParams`, `useCreateAltioraMeeting`, `useUpdateAltioraMeeting`.
- `src/hooks/useAltioraClosers.ts` — `useAltioraClosers()` já retorna `{id, name, email, fuso_horario}[]` filtrado por `user_type='closer'`; **novo** `useAltioraInternalUsers()` deve ser a mesma query sem esse filtro (`.eq('active', true).is('deleted_at', null)` apenas).
- `src/components/negocios/AltioraAgendarReuniaoModal.tsx` — modal alvo da mudança de UI; hoje recebe `closerId` fixo via prop — precisa virar estado interno editável apenas quando `super_adm === true`.
- Ver ADR-ALTIORA-01 para o racional completo (organizador livre só para Super Admin; Closer comum sem mudança de comportamento).

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | Nova (dev-dev-alpha) |
| Iniciado | 2026-08-07 |
| Concluído | 2026-08-07 |
| Branch | worktree-agent-a67f1afb972749ed5 (worktree isolado) |

## File List
- `src/hooks/useAltioraClosers.ts` — adicionado `useAltioraInternalUsers()` (todos os usuários internos ativos, sem filtro `user_type`)
- `src/hooks/useAltioraMeetings.ts` — adicionado `MeetingCollaborator`, `useMeetingCollaborators()`; `CreateAltioraMeetingParams`/`UpdateAltioraMeetingParams` ganham `collaboratorIds?: string[]`; persistência em `meeting_collaborators` no create (insert) e update (diff insert/delete); invalidação de query de colaboradores
- `src/components/negocios/AltioraAgendarReuniaoModal.tsx` — campo "Organizador" (Select) para Super Admin ao criar (default = ele mesmo), somente leitura ao reagendar; seção colapsada "+ Adicionar colaborador" (multi-select via Command/Popover) para ambos os perfis; conflito de agenda passa a checar o organizador efetivo
- `src/components/negocios/AltioraReunioes.tsx` — `MeetingCard` exibe badges com nome dos colaboradores extra (via `useMeetingCollaborators`)

**Notas de implementação:**
- Cast `sbUntyped = supabase as unknown as SupabaseClient` usado para `meeting_collaborators` (ainda fora dos tipos gerados), seguindo o padrão de `NovoReferralModal.tsx`.
- Não houve necessidade de renomear o campo `closerId` no payload — mantido por compatibilidade, documentado via JSDoc como "organizador efetivo".
- Trocar organizador de reunião já existente permanece fora de escopo (AC5) — campo aparece somente leitura no modo reagendamento.

## QA Results
<!-- QA preenche ao revisar -->
