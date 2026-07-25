---
title: "Story FWUP-05: FollowupModal — capturar UUID do template e exibir nome amigável"
type: story
status: backlog
epic: FWUP
complexity: S
priority: P1
agent: dev-dev-alpha
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, components, whatsapp, p1]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-04]]"]
---

# Story FWUP-05: FollowupModal — capturar UUID do template e exibir nome amigável

## Objetivo
Corrigir dois bugs em `FollowupModal` (stage followups): (1) `whatsapp_template_id` (UUID FK) nunca é salvo porque o callback de seleção captura apenas 2 dos 3 args; (2) ao editar followup existente, o botão de template mostra o ID técnico em vez do nome amigável.

## Acceptance Criteria
- [x] **AC1:** Linha 435 do `FollowupModal.tsx` atualizada para `onSelect={(id, name, uuid) => { upd({ template_id: id, template_name: name, whatsapp_template_id: uuid }); setTplPicker(false); }}`.
- [x] **AC2:** `FormState` inclui campo `whatsapp_template_id: string` e é incluído no `payload` do `handleSubmit`.
- [x] **AC3:** `useEffect` carrega `template_name` resolvendo via lookup em `whatsappTemplates` (via `useWhatsappTemplates`) em vez de fallback para `template_id`.
- [x] **AC4:** Ao reabrir um followup editável com template selecionado, o botão exibe o nome amigável (lookup por `id_template`) e não o ID técnico.
- [x] **AC5:** `useUpdateFollowup` recebe e persiste `whatsapp_template_id` via `buildInsert` — campo incluído no PATCH.
- [x] **AC6:** Migration `20260427050000_fwup05_leads_stages_followups_waid_index.sql` garante coluna uuid com FK + índice (idempotente via DO $$ block).
- [x] **AC7:** `StageFollowup`, `DbFollowup`, `FollowupMutationInput` em `useFollowups.ts` incluem `whatsapp_template_id`.

## Escopo

**IN:**
- Refactor de `FollowupModal.tsx` — callback de 3 args + carregamento de template_name via lookup
- Atualizar tipo `StageFollowup` em `useFollowups.ts`
- Atualizar payload do mutate em `useCreateFollowup` e `useUpdateFollowup`
- Índice em `whatsapp_template_id` se faltar

**OUT:**
- Migrar `template_id` legado (texto) para deprecação — sucessor `whatsapp_template_id` UUID coexiste no DB
- Mudanças no `WhatsappTemplatePickerModal` (já passa 3 args corretamente)
- UI nova para gestão de templates

## Contexto Técnico

**Arquivos afetados:**
- `src/components/followups/FollowupModal.tsx:97, 435`
- `src/hooks/useFollowups.ts` — tipo `StageFollowup`
- `supabase/migrations/` — índice se necessário

**Causa raiz:** divergência entre `WhatsappTemplatePickerModal` (que passa `(id, name, uuid)` na linha 40-42) e o consumer `FollowupModal` (que captura só 2). Bug introduzido quando o picker foi atualizado para devolver UUID mas o consumer não foi.

**Bloqueado por:** FWUP-04 (mesmo dev-alpha; coordenar ordem para evitar conflitos no mesmo arquivo).

**Independente do schema:** funciona com schema canônico FWUP-03 já estabilizado.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main (commit afa4b08e) |

## File List
- `src/components/followups/FollowupModal.tsx` — modificado (onSelect 3 args, template_name lookup, whatsapp_template_id em FormState + payload)
- `src/hooks/useFollowups.ts` — modificado (whatsapp_template_id em StageFollowup, DbFollowup, FollowupMutationInput, buildInsert)
- `supabase/migrations/20260427050000_fwup05_leads_stages_followups_waid_index.sql` — criado

## QA Results

```
VEREDICTO: PASS
Story: FWUP-05 | Data: 2026-04-27 | Auditor: Axikar
Checklist: 7/7 ACs verificados.
Issues: nenhum
Verificações:
- FollowupModal.tsx:477 onSelect captura 3 args: (id, name, uuid) → upd({ template_id, template_name, whatsapp_template_id }).
- FormState (linhas 46, 64, 109) inclui `whatsapp_template_id` com hydrate de followup.
- Payload do handleSubmit (linha 147) inclui whatsapp_template_id condicional ao canal.
- useEffect (linhas 101-103) faz lookup de template_name via `whatsappTemplates.find(t => t.id_template === followup.template_id)`.
- Migration 20260427050000_fwup05_leads_stages_followups_waid_index.sql garante FK + índice.
Próximo passo: @dev-devops push
```
