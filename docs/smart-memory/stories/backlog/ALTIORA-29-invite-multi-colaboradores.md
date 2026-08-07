---
title: "ALTIORA-29: Convite ao cliente cita colaboradores adicionais (2+ responsáveis)"
type: story
status: active
epic: ALTIORA-D
complexity: S
agent: dev-architect
created: 2026-08-07
updated: 2026-08-07
tags: [story, altiora, reuniao, invite, colaboradores]
related: ["[[ALTIORA-28-edge-functions-colaboradores]]", "[[../../decisions/ADR-ALTIORA-01-reunioes-multiplos-colaboradores]]"]
---

# ALTIORA-29: Convite ao cliente cita colaboradores adicionais

> **Revisão 2026-08-07:** o template (`buildAltioraInvite`) permanece genérico/multi-provedor de
> propósito (é usado pelas 3 edge functions para texto idêntico), mas nesta wave só quem **passa**
> dados de colaborador para ele é `google-cal-upsert-event` — MS Teams e Zoom não ganham a query de
> `meeting_collaborators` (fora de escopo, ver ADR-ALTIORA-01). Se compartilharem organizador/tipo
> de reunião sem colaborador, o convite sai idêntico ao de hoje nos três provedores.

## Objetivo
Quando uma reunião tem colaboradores adicionais, o convite enviado ao cliente via Google Calendar deve citar todos de forma natural, sem virar um texto burocrático de lista.

## Acceptance Criteria
- [x] AC1: `buildAltioraInvite` (`_shared/altiora-invite-template.ts`) ganha parâmetro opcional `colaboradores?: Array<{ nome: string | null }>`. Quando vazio/ausente, comportamento é idêntico ao atual (retrocompatível — não quebra reuniões sem colaborador, nem o uso do template por `ms-teams-upsert-event`/`zoom-upsert-event`, que seguem chamando sem esse parâmetro).
- [x] AC2: Assinatura do convite passa de `"{consultorNome} — Altiora Advisory Group"` para `"{consultorNome} e {colaborador1} — Altiora Advisory Group"` (2 pessoas) ou `"{consultorNome}, {colaborador1} e {colaborador2} — Altiora Advisory Group"` (3+), sempre citando o organizador primeiro.
- [x] AC3: Apenas `google-cal-upsert-event` passa a resolver `meeting_collaborators` → nomes via `settings_users.nome` e repassar para `buildAltioraInvite` — mesma query já adicionada em ALTIORA-28, sem nova chamada ao banco. `ms-teams-upsert-event` e `zoom-upsert-event` não são tocadas nesta story.
- [x] AC4: Teste unitário/manual documentado: convite com 0, 1 e 2 colaboradores gera assinatura gramaticalmente correta em português ("e" antes do último, vírgula entre os demais).

## Escopo

**IN:**
- Extensão de `buildAltioraInvite` e das 3 edge functions que a chamam

**OUT:**
- Telefone/WhatsApp de colaboradores no convite (mantém apenas o do organizador, `consultorTelefone` — evitar poluir o convite com múltiplos contatos)
- Qualquer mudança em `useAltioraClosers`/`useAtribuirCloser`/`leads.altiora_closer_id`

## Contexto Técnico
- `supabase/functions/_shared/altiora-invite-template.ts` — função `buildAltioraInvite`, linha ~119 monta a assinatura (`paragraphs.push(assinatura ? ... : 'Altiora Advisory Group')`).
- Depende de ALTIORA-28 (query de colaboradores já implementada nas edge functions) — esta story só estende o template e o ponto de chamada.
- Ver ADR-ALTIORA-01 para o racional de manter o convite simples (não listar telefone de todos).

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | Rex (dev-dev-beta) |
| Iniciado | 2026-08-07 |
| Concluído | 2026-08-07 |
| Branch | worktree-agent-aa3280e6ebb522cc3 |

Testes manuais/unitários (AC4) — `supabase/functions/_shared/altiora-invite-template.test.ts`, `deno test`:
- 0 colaboradores (undefined e array vazio) → assinatura idêntica ao legado (`"{consultorNome} — Altiora Advisory Group"`).
- 1 colaborador → `"{consultorNome} e {colaborador} — Altiora Advisory Group"`.
- 2 colaboradores → `"{consultorNome}, {colaborador1} e {colaborador2} — Altiora Advisory Group"`.
- Colaborador com nome vazio/null é ignorado sem quebrar a assinatura.
- Sem `consultorNome` mas com colaboradores → assinatura só com os colaboradores.
- Nem `consultorNome` nem colaboradores → fallback genérico `"Altiora Advisory Group"`.
- Títulos R1/R2/R3 confirmados intactos (Wealth Planning Discovery/Presentation, IUL Implementation).
- 9/9 testes passaram (`deno test --allow-env supabase/functions/_shared/altiora-invite-template.test.ts`).

## File List
- `supabase/functions/_shared/altiora-invite-template.ts` (modificado — parâmetro `colaboradores`, helper `joinNamesNaturally`)
- `supabase/functions/_shared/altiora-invite-template.test.ts` (novo — cobertura AC4)
- `supabase/functions/google-cal-upsert-event/index.ts` (modificado — repassa `colaboradores` resolvidos em ALTIORA-28, ver story irmã)

## QA Results
<!-- QA preenche ao revisar -->
