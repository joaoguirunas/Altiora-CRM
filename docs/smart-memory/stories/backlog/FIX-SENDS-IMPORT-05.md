---
title: "Story FIX-SENDS-IMPORT-05: Campos personalizados de negócio/lead visíveis no FieldMapper sem createLeads"
type: story
status: backlog
epic: SENDS
complexity: S
agent: dev-dev-gamma
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, import, field-mapper, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-IMPORT-02]]", "[[FIX-SENDS-IMPORT-06]]"]
---

# Story FIX-SENDS-IMPORT-05: Campos personalizados de negócio/lead visíveis no FieldMapper sem createLeads

## Objetivo

Permitir que campos personalizados de negócio/lead (entity_type='negocio' ou 'lead') apareçam no dropdown do `FieldMapper` quando um pipeline está selecionado, mesmo sem o toggle "Criar negócios no CRM" ativo — destravando o mapeamento prévio desses campos no fluxo de import CSV.

## Acceptance Criteria

- [ ] AC1: Com `pipelineId !== null` e `createLeads === false`, os campos do grupo "Campos Extras — Negócio" (lead/deal fields personalizados) aparecem no dropdown do `FieldMapper` para todas as colunas do CSV.
- [ ] AC2: Com `pipelineId === null` (independente de `createLeads`), o grupo "Campos Extras — Negócio" continua oculto — a ausência de pipeline justifica esconder os campos.
- [ ] AC3: Com `pipelineId !== null` e `createLeads === true`, o comportamento atual é preservado — os campos aparecem normalmente.
- [ ] AC4: Mapeamentos `lead_extra:*` enviados ao backend com `create_leads=false` continuam sendo silenciosamente ignorados pela edge function `sends-import-contacts` (linha 297 já gateia em `if (create_leads && lead_extra && ...)`) — nenhuma regressão na lógica de import.
- [ ] AC5: Auto-detecção de campos `lead_extra` em `autoDetectedExtras` (FieldMapper.tsx L382+) continua funcionando para CSVs com headers que casam com nomes/aliases dos lead fields.
- [ ] AC6: Não há regressão visual no agrupamento do dropdown — a ordem dos grupos (`base → crm_extra → lead_base → lead_extra → score → q_field → company_struct`) permanece igual.

## Escopo

**IN:**
- Alterar a gate em `src/components/disparos/FieldMapper.tsx` linha 351 de `(createLeads && pipelineId)` para `pipelineId` (truthy check único).
- Revisar a `useMemo` deps array (L374) — `createLeads` pode ser removido do array de deps desde que não seja mais lido dentro do memo, mantendo coerência com lint rules.
- Validar manualmente via DevTools que o dropdown renderiza os lead_extras com `createLeads=false` e pipeline selecionado.

**OUT:**
- Mudança no comportamento da edge function `sends-import-contacts` — backend já trata corretamente o caso `create_leads=false` ignorando `lead_extra`.
- Mudança no `ImportListaTab` (estado, props passadas ao FieldMapper, etc.) — `pipelineId` já é passado independente de `createLeads`.
- Refatoração da estrutura de grupos do dropdown ou do tipo `CrmOption`.
- Tratamento de `lead_extra` em `autoDetectedExtras` — já é detectado independente da gate visual; a story não precisa ajustar lógica de auto-detect.

## Contexto Técnico

**Bug raiz:** `src/components/disparos/FieldMapper.tsx` — linhas 351-357.

**Código atual:**
```typescript
const leadExtras: CrmOption[] = (createLeads && pipelineId)
  ? leadDealFields.map((f) => ({
      value: `lead_extra:${f.key}`,
      label: f.name,
      group: 'Campos Extras — Negócio',
    }))
  : [];
```

**Problema:** A gate dupla `createLeads && pipelineId` esconde os campos personalizados de negócio do dropdown enquanto o usuário não ativar o toggle "Criar negócios no CRM". Para usuários que querem inspecionar os campos disponíveis antes de decidir ligar o toggle, ou que usam o pipeline apenas para contexto de organização, esses campos ficam invisíveis.

**Por que mostrar é seguro:** `supabase/functions/sends-import-contacts/index.ts` linha 297:
```typescript
if (create_leads && lead_extra && Object.keys(lead_extra).length > 0 && pipeline_id) {
```
O backend só processa `lead_extra` quando `create_leads=true`. Mapeamentos enviados com `create_leads=false` são silenciosamente descartados — então mostrar os campos na UI é puramente cosmético/UX, sem efeito colateral no import.

**Fix:**
```typescript
const leadExtras: CrmOption[] = pipelineId
  ? leadDealFields.map((f) => ({
      value: `lead_extra:${f.key}`,
      label: f.name,
      group: 'Campos Extras — Negócio',
    }))
  : [];
```

**Justificativa da nova gate:** sem pipeline selecionado, o conjunto `leadDealFields` não tem contexto (campos são scoped a um pipeline), então faz sentido manter o gate por `pipelineId`. Com pipeline ativo, mostrar os campos é a UX correta — independente de `createLeads`.

**Módulos afetados:**
- `src/components/disparos/FieldMapper.tsx` — única alteração
- `src/components/disparos/ImportListaTab.tsx` — sem mudança (já passa `pipelineId` para FieldMapper)
- `supabase/functions/sends-import-contacts/index.ts` — sem mudança (gate `create_leads` já funciona)

**Constraints:**
- Manter compatibilidade com auto-detecção em `autoDetectedExtras` (L382+) — não depende da gate visual.
- Sem mudança nos tipos `FieldMappingConfig` ou `CrmOption`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-04-30 |
| Concluído  | 2026-04-30 |
| Branch     | main (commit b2800baf) |

## File List

- `src/components/disparos/FieldMapper.tsx` — gate `leadExtras` alterada de `(createLeads && pipelineId)` para `pipelineId`

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-IMPORT-05 | Data: 2026-04-30 | QA: Axikar
Checklist: 8/8 verificados
Issues: nenhum
Próximo passo: @dev-devops push
```

**Detalhamento por AC:**
- AC1: Gate em `src/components/disparos/FieldMapper.tsx:351` trocada de `(createLeads && pipelineId)` para `pipelineId`. Lead extras agora aparecem com `pipelineId !== null` independente de `createLeads`.
- AC2: `pipelineId === null` mantém `leadExtras = []` (ternário preservado).
- AC3: `pipelineId + createLeads=true` segue funcionando — superset do AC1.
- AC4: Backend `supabase/functions/sends-import-contacts/index.ts:297` mantém gate `if (create_leads && lead_extra...)` — lead_extra é silenciosamente descartado quando `create_leads=false`. Sem regressão.
- AC5: `autoDetectedExtras` (L382-451) preserva sua gate própria `if (createLeads && pipelineId)` na linha 404. Auto-detect continua condicional ao toggle, conforme intenção.
- AC6: Ordem dos grupos preservada em FieldMapper.tsx:373 (`base, crmExtras, leadBase, leadExtras, scoreOpts, qFieldOpts, companyStructOpts`).

**Cross-cutting:**
- `createLeads` removido das deps do `useMemo` em FieldMapper.tsx:374 — coerente com lint rules (não usa mais createLeads no escopo do memo).
- Typecheck: limpo.
- Lint: 2 warnings preexistentes (`leadDealFields` deps) NÃO introduzidos pelo fix — já presentes no commit `fb044b31`.

**Files reviewed:**
- `src/components/disparos/FieldMapper.tsx` (L351, L374)
