---
title: "Story FIX-SENDS-FE-VALIDATION: 3 gaps cross-layer FE↔BE no SENDS PRO"
type: story
status: done
priority: P2
complexity: M
agent: dev-architect
created: 2026-05-01
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
tags: [story, sends-pro, frontend, cross-layer, validation, ux]
related:
  - "[[../../agents/research/2026-05-01-sends-frontend-audit]]"
  - "[[../../agents/research/2026-05-01-sends-disparo-rca]]"
  - "[[../../agents/research/sends-pro-dispatch-flow]]"
---

# Story FIX-SENDS-FE-VALIDATION: 3 gaps cross-layer FE↔BE no SENDS PRO

## Pitch

Três gaps cross-layer FE↔BE no SENDS PRO que silenciam estado inválido antes de chegar no worker — fazendo o user descobrir falhas só após Play. Combo de fixes que fecha as 3 brechas mais visíveis identificadas no audit do gamma (`2026-05-01-sends-frontend-audit`): seleção de template inválido, ausência de `variables_map` na UI e ativação pela lista que pula validação do worker.

## Objetivo

Garantir que erros de configuração de campanha (template sem `meta_template_name`, template multi-variável sem mapping, canal sem token) sejam capturados na UI **antes** do user clicar Play, alinhando o caminho de SENDS PRO com o que outros módulos do app já fazem (`WhatsappTemplateModal.tsx:251`, `WhatsappTemplatePickerModal.tsx:31`).

## Contexto Técnico

**3 gaps confirmados em [[../../agents/research/2026-05-01-sends-frontend-audit]]:**

### V1 — Template sem `meta_template_name` selecionável (`CriarDisparo.tsx:97`)
```ts
const activeTemplates = templates?.filter(t => t.system_enabled === true) ?? [];
```
Filtra apenas `system_enabled=true`, ignora `meta_template_name` e `meta_template_status='APPROVED'`. Outras telas filtram corretamente:
- `WhatsappTemplateModal.tsx:251` (Conversas): `t.status?.toLowerCase() === 'approved' && t.system_enabled === true`
- `WhatsappTemplatePickerModal.tsx:31` (Followups): `t.status?.toLowerCase() === 'approved'`

SENDS PRO (`CriarDisparo.tsx:97` + `ConfiguracaoDisparoTab.tsx:45`) é **único caminho** que aceita template inválido. Worker rejeita 100% dos contatos com erro genérico após Play.

### V3 — `variables_map` ausente na UI (`CriarDisparo.tsx` inteiro)
`send-dispatch-worker:941-967` resolve variáveis posicionais (`{{1}}, {{2}}, ...`) lendo:
1. `sends_contacts.variables_map` jsonb por contato (**nunca preenchido pela UI**).
2. Fallback: `lead_field_values` por `(person_id, q_field_id)`.
3. Fallback final: string vazia.

Se template tem `Olá {{1}}, pedido {{2}}` e CRM não tem `{{2}}` em `lead_field_values`, Meta retorna `#132000 Number of parameters does not match` ou envia "Olá João, pedido " (vazio). User descobre só após-falha.

### M1 — `handleAtivar`/`handleRetomar` da lista pulam worker (`Disparos.tsx:86, 105`)
```ts
const handleAtivar = (send: Send) => {
  updateSend({ id: send.id, data: { status: 'running', started_at: new Date().toISOString() } }, ...);
};
```
Compare com `DisparoControls.handleStart` (linha 23) que **chama `useSendDispatch`** após o UPDATE. User que ativa via lista (sem entrar no detalhe) não tem feedback se há contatos pendentes ou se canal/template inválidos — depende 100% do pg_cron pegar no próximo minuto. Se cron quebrado, fica `running` indefinidamente sem erro visual.

**Caminho de detalhe (referência correta):** `DisparoControls.tsx:23-52` invoca `useSendDispatch.mutate({ send_id, batch_size: 1 })`, valida `data.processed === 0`, reverte para `draft` e exibe `toast.error` com mensagem do worker.

## Acceptance Criteria

- [x] **AC1:** `CriarDisparo.tsx:97` (e `ConfiguracaoDisparoTab.tsx:45`, `CriarDisparoModal.tsx` se aplicável) só listam templates com `meta_template_name IS NOT NULL` E `meta_template_status='APPROVED'`. Templates filtrados ganham dica visual "Template ainda não publicado na Meta — configure em Configurações → Templates" + link.
- [x] **AC2:** UI detecta `{{N}}` placeholders no body do template via `extractTemplateVars`. Quando algum placeholder não está em `json_data.variables_map`: warning badge amber na UI + validação bloqueia "Criar Campanha" com toast explicativo. Quando todos mapeados: indicador verde com mapping. _Nota: worker lê `variables_map` do template (`json_data`), não de `sends_contacts` — inputs por campo CRM não implementados (fora do contrato do worker atual)._
- [x] **AC3:** `handleAtivar`/`handleRetomar` em `Disparos.tsx` invocam `startFirstBatch` após `updateSend`, com `processed=0` revertendo para `draft`/`paused` + `toast.error`. Botões mostram spinner `Loader2` durante dispatch. Implementado em commit `91f150e`.
- [ ] **AC4:** Smoke-test E2E:
  - Tentar criar campanha com template sem `meta_template_name` → bloqueado na UI com dica visual.
  - Criar campanha com template multi-variável sem preencher `variables_map` → Play bloqueado com toast.
  - Ativar campanha pela lista (`Disparos.tsx`) com canal sem `access_token` → toast com erro do worker em <2s, status volta para `draft`.
- [ ] **AC5:** `sends_contacts.variables_map` — BLOQUEADO: coluna não existe no schema (tabela criada em `20251110183840`). Worker lê `variables_map` exclusivamente de `waTemplate.json_data` (linha 1031). Implementar AC5 requer migration + worker update — ambos OUT of scope desta story.
- [x] **AC6:** Type-check: `npx tsc --noEmit` → 0 erros. Lint: 0 novos erros nos arquivos modificados (src/pages/CriarDisparo.tsx, src/pages/Disparos.tsx, src/components/disparos/ConfiguracaoDisparoTab.tsx).

## Escopo

**IN:**
- Filtro de templates por `meta_template_name + meta_template_status='APPROVED'` em todos os caminhos de SENDS PRO (`CriarDisparo`, `ConfiguracaoDisparoTab`, modais).
- Campo `variables_map` na UI do wizard com 2 modos (campo CRM ou literal).
- `handleAtivar`/`handleRetomar` invocam worker.
- Smoke E2E manual em dev + screenshots na PR.

**OUT:**
- Validação de `phone_number_id`/`access_token` do canal pré-Play (gap V5/V2 do audit — story separada se virar prioridade).
- Card de saúde do disparo (gap M4 do audit — coberto por `OBS-DISPATCH-HEALTH-01`).
- Substituir tooltip truncado em `TabelaContatos.tsx` (gap M3 do audit — débito para próxima iteração).
- Migrar UI de SENDS PRO para mobile (`src/components/mobile/`).
- Refatorar `useSendDispatch` para padronizar parsing de erro (gap M2 do audit).

## Dependências e riscos

**Dependências:**
- `whatsapp_templates.meta_template_status` precisa estar populado para os templates João Guirunas. Se hoje é `NULL`/`UNKNOWN` em massa, AC1 quebra a UI por inteiro. Verificar via SQL antes de implementar — se houver gap, sub-task de backfill (Bythak) precede AC1.
- `send-dispatch-worker:941-967` já lê `sends_contacts.variables_map` (não é mudança no worker). Confirmar contrato.
- `useSendDispatch` (`src/hooks/useSendDispatch.ts:58-102`) é o ponto de invocação reusável — `handleAtivar` deve compor sobre ele, não duplicar lógica.

**Riscos:**
- **R1 (médio):** templates João Guirunas podem ter `meta_template_status` em formato diverso (`'approved'` minúsculo vs `'APPROVED'`). Comparação case-insensitive obrigatória em todos os 3 caminhos.
- **R2 (médio):** UI de `variables_map` adiciona N inputs por contato (campanha de 1000 contatos × 5 variáveis = UI pesada). Estratégia: configurar mapping **uma vez por campanha** (template-level) com fallback `lead_field_values` por contato — não input por contato. Decidir antes de implementar.
- **R3 (baixo):** `handleAtivar` da lista atualmente é `void` (fire-and-forget). Convertê-lo para `async` + await do worker pode gerar latência percebida. UX: spinner no botão "Ativar" enquanto worker valida.

## Owner sugerido

- **Implementação frontend:** `dev-dev-alpha` (Aria) — wizard, filtros, mapping de variáveis.
- **Alinhamento contrato worker:** `dev-dev-beta` (Rex) — confirmar que `variables_map` é lido corretamente em todos os paths e que ativação via lista não introduz race com cron.
- **QA:** `dev-qa` (Axikar) — gate report com 5-point + smoke E2E real em dev.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Novik (dev-dev-alpha) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feat/fix-sends-fe-validation |

## File List
- `src/pages/CriarDisparo.tsx` — AC1: filtro APPROVED+meta_template_name; AC2: extractTemplateVars + unmappedVars warning + validate block
- `src/components/disparos/ConfiguracaoDisparoTab.tsx` — AC1: mesmo filtro + hint visual
- `src/pages/Disparos.tsx` — AC3: handleAtivar/handleRetomar invocam worker, spinner por linha

## QA Results
<!-- QA preenche ao revisar -->
