---
title: "ALTIORA-04: Terminologia UI — \"Negócio\" → \"Referral\" no pipeline Altiora"
type: story
status: active
epic: ALTIORA-A
complexity: S
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, terminologia, frontend, i18n]
related: ["[[ALTIORA-02]]", "[[ALTIORA-06]]", "[[ALTIORA-08]]"]
---

# ALTIORA-04: Terminologia UI — "Negócio" → "Referral" no pipeline Altiora

## Objetivo
Substituir o termo "Negócio" por "Referral" em todos os textos visíveis da UI quando o contexto for o pipeline Altiora, sem alterar o código de outros pipelines.

## Acceptance Criteria
- [x] AC1: Quando o pipeline Altiora está selecionado, o botão "Novo Negócio" exibe "Novo Referral"; title da página e breadcrumbs exibem "Referrals".
- [x] AC2: Toasts de sucesso/erro ("Negócio criado", "Negócio atualizado") exibem "Referral criado", "Referral atualizado" no contexto Altiora.
- [x] AC3: Sidebar da ficha e modais usam "Referral" no título quando o lead pertence ao pipeline Altiora.
- [x] AC4: Outros pipelines continuam exibindo "Negócio" — a troca é condicional ao `pipeline_id` do pipeline Altiora (ou a um campo `label_override` em `leads_pipelines`).
- [x] AC5: Sem strings hardcoded duplicadas — usar constante ou função `getEntityLabel(pipelineId)` para centralizar a lógica.

## Escopo

**IN:**
- Função utilitária `getEntityLabel(pipelineId): string` em `src/utils/pipelineLabels.ts`
- Aplicação nos componentes: `Negocios.tsx`, `NegocioSidebar.tsx`, `NovoNegocioModal.tsx` e toasts de `useNegocios.ts`

**OUT:**
- Alteração de nomes de variáveis internas ou hooks (sem valor para o usuário e alto risco)
- Tradução completa da UI (escopo de internacionalização futuro)
- Renomear rotas de URL (sem impacto no Altiora V1)

## Contexto Técnico
- `src/pages/Negocios.tsx` — título e botão "Novo Negócio"
- `src/components/negocios/NovoNegocioModal.tsx` — título do dialog
- `src/components/negocios/NegocioSidebar.tsx` — título da ficha
- `src/hooks/useNegocios.ts` — mensagens de toast
- Identificar o `pipeline_id` do pipeline Altiora via constante `ALTIORA_PIPELINE_SLUG` ou consulta ao contexto de pipeline selecionado

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Nova (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/utils/pipelineLabels.ts` — criado (utilitário central: `getEntityLabel`, `getEntityLabelPlural`, `isAltioraPipeline`)
- `src/pages/Negocios.tsx` — modificado (importa e computa `entityLabel`, passa para toolbar e modal, atualiza `document.title`)
- `src/components/negocios/NegociosToolbar.tsx` — modificado (prop `entityLabel` no botão "Novo Negócio")
- `src/components/negocios/NovoNegocioModal.tsx` — modificado (prop `entityLabel` no título do dialog)
- `src/components/negocios/NegocioSidebar.tsx` — modificado (seção "Negócio" usa `entityLabel` do pipeline do lead)
- `src/hooks/useNegocios.ts` — modificado (`useUpdateNegocio` aceita `options.entityLabel` para toasts condicionais)
- `src/pages/NegocioSingle.tsx` — modificado (passa `entityLabel` ao `useUpdateNegocio`)

## QA Results
<!-- QA preenche ao revisar -->
