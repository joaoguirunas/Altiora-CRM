---
title: "CLEAN-SENDS-01: Tipos gerados para sends_contacts + FK em stage_ids/template_id"
type: story
status: done
priority: P3
complexity: S
agent: dev-dev-gamma
created: 2026-04-22
updated: 2026-04-22
tags: [story, sends-pro, debt, P3]
related: ["[[../../project/modules/sends-pro]]"]
---

# CLEAN-SENDS-01: Tipos gerados para sends_contacts + FK em stage_ids/template_id

## Objetivo
Garantir type safety completo para `sends_contacts` e adicionar constraints de FK para `stage_ids` e `template_id` na tabela de sends.

## Acceptance Criteria
- [ ] AC1: Tipos TypeScript gerados para `sends_contacts` (via supabase gen types ou tipos manuais corretos)
- [ ] AC2: `stage_ids` com FK para tabela de stages (ou constraint de validação se array)
- [ ] AC3: `template_id` com FK para tabela de templates
- [ ] AC4: Nenhuma regressão no filter builder de SENDS

## Escopo

**IN:**
- Regenerar ou escrever tipos para `sends_contacts`
- Migration: adicionar FK `template_id → templates.id`
- Migration: validação de `stage_ids` (array FK não suportado nativamente — usar trigger ou CHECK)

**OUT:**
- Refactor do filter builder
- Mudança no modelo de segmentação

## Contexto Técnico
`sends_contacts` é usado no filter builder dinâmico mas sem tipos gerados — código usa `any` ou tipos manuais incompletos. `stage_ids` (array) e `template_id` sem FK causam inconsistências silenciosas quando stages ou templates são deletados. Ver `docs/smart-memory/project/modules/sends-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List

- `supabase/migrations/20260423015000_sends_fk_constraints.sql` — FK template_id + CHECK stage_ids
- `src/hooks/useSendContacts.ts` — remove `(supabase as any)` cast; usa `SendContact[]` como tipo de retorno; `row: any` → inferência implícita com cast final `as SendContact[]`

## Acceptance Criteria

- [x] AC1: Tipos TypeScript para sends_contacts já existiam nos tipos gerados — cast any removido
- [x] AC2: stage_ids com validação via CHECK constraint (validate_stage_ids function)
- [x] AC3: template_id com FK → whatsapp_templates.id (ON DELETE SET NULL)
- [x] AC4: Nenhuma regressão no filter builder de SENDS

## QA Results
