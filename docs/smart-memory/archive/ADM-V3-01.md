---
title: "ADM-V3-01: Unificar catálogo de módulos — extrair ALL_MODULES para constante única"
type: story
status: backlog
epic: adm-v3
complexity: S
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, adm, control-plane, modules, refactor, P2]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-ADM-01-project-per-tenant]]"]
---

# ADM-V3-01: Unificar catálogo de módulos — extrair ALL_MODULES para constante única

## Objetivo
Eliminar a inconsistência entre as duas listas de módulos (`AdmModulesSection` com 9 e `AdmClientSingle` com 11) extraindo uma única constante `ALL_MODULES` que seja a fonte de verdade para ambas as páginas e para `useSystemModules`.

## Acceptance Criteria
- [ ] AC1: Arquivo `src/utils/modules.ts` (ou extensão de `src/utils/constants.ts`) exporta `ALL_MODULES: ModuleDefinition[]` com 11 entradas — confirmado contra `AdmClientSingle.ALL_MODULES` como base (inclui `clientes` e `score`)
- [ ] AC2: `AdmModulesSection` importa `ALL_MODULES` de `src/utils/modules.ts` — a lista local de 9 é removida; nenhuma discrepância de módulos exibidos
- [ ] AC3: `AdmClientSingle` importa `ALL_MODULES` de `src/utils/modules.ts` — remove a constante local `ALL_MODULES`
- [ ] AC4: `useSystemModules` usa a mesma lista para validar `module_key` dos módulos retornados pelo banco — `activeModules` filtra apenas keys que existem em `ALL_MODULES`
- [ ] AC5: `grep -r "ALL_MODULES" src/` retorna apenas `src/utils/modules.ts` e os imports dos consumidores — sem definições duplicadas

## Escopo

**IN:**
- Criação de `src/utils/modules.ts` com `ALL_MODULES` e tipo `ModuleDefinition { key, label, icon?, defaultEnabled }`
- Refactor de `AdmModulesSection.tsx` para importar da constante
- Refactor de `AdmClientSingle.tsx` para importar da constante
- Atualização de `useSystemModules.ts` para usar a constante como referência de keys válidas

**OUT:**
- Mudança no banco de dados (`settings_system_modules`)
- Adição ou remoção de módulos do produto
- Mudança na lógica de `enabled_modules = null` (todos habilitados) — comportamento mantido

## Contexto Técnico
Deep-dive §9 débito #1: "`AdmModulesSection` lista 9 módulos enquanto `AdmClientSingle.ALL_MODULES` lista 11 (`clientes`, `score` adicionais). Inconsistência de fonte de verdade." A convenção `enabled_modules = null` significa "todos habilitados" — `AdmModulesSection` auto-converte para `null` se todos os 9 checados, mas deveria ser 11. Isso pode mascarar módulos `clientes` e `score` desabilitados silenciosamente. `ModuleDefinition` deve incluir `defaultEnabled: boolean` para indicar se o módulo começa ativo num tenant novo.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | refactor/adm-unify-modules-catalog |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
