---
name: patterns-pipeline-labels
description: Utilitário pipelineLabels.ts — como centralizar terminologia Altiora vs outros pipelines.
metadata:
  type: project
---

# Pattern: Pipeline Labels (ALTIORA-04)

**Arquivo:** `src/utils/pipelineLabels.ts`

## API
```ts
isAltioraPipeline(pipelineName: string): boolean
getEntityLabel(pipelineName: string): string       // "Referral" | "Negócio"
getEntityLabelPlural(pipelineName: string): string // "Referrals" | "Negócios"
ALTIORA_PIPELINE_NAME_PATTERN = 'altiora'
```

## Uso nos componentes
- **Negocios.tsx:** `const entityLabel = getEntityLabel(selectedPipeline?.name ?? '')`
  - Passa via `entityLabel` prop para `NegociosToolbar` e `NovoNegocioModal`
  - Atualiza `document.title` com `entityLabelPlural`
- **NegocioSidebar.tsx:** lookup do pipeline via `pipelines.find(p => p.id === pipelineId)`, depois `getEntityLabel(pipeline.name)`
- **useUpdateNegocio:** aceita `options?: { entityLabel?: string }` para toasts condicionais
- **NegocioSingle.tsx:** calcula `negocioEntityLabel` e passa ao `useUpdateNegocio`

**Why:** Evitar strings hardcoded duplicadas ao adicionar contexto Altiora à UI genérica.
**How to apply:** Sempre usar `getEntityLabel(pipeline.name)` em vez de strings hardcoded "Negócio"/"Referral".
