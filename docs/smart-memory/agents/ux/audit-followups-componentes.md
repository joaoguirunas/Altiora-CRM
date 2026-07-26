---
title: Auditoria de Componentes React — Followup
date: 2026-04-27
author: dev-dev-alpha (Novik)
---

# Auditoria de Componentes React — Followup

## Sumário de Status

| Componente | Status | Problema Principal |
|---|---|---|
| `AgendamentoFollowupModal` | FUNCIONAL | OK — handlers e mutations reais |
| `AgendamentoFollowupsCard` | FUNCIONAL | OK — CRUD completo |
| `FollowupEmailEditor` | FUNCIONAL | OK — Tiptap integrado |
| `FollowupModal` | PARCIAL | `template_name` nunca refletido ao editar; ligação sem handler de fila |
| `MultiSelectScoreMatrix` | QUEBRADO | Acessa `matrix.objective_id/.investment_id/.framing_id` — campos que não existem em `ScoreMatrix` |
| `ScoreMatrixSelector` | QUEBRADO | Mesma causa — campos legados inexistentes na interface atual |
| `StageFollowupsCard` | FUNCIONAL | OK — CRUD completo |
| `VariablePicker` | FUNCIONAL | OK — componente puro, sem dependências de dados |
| `WhatsappTemplatePickerModal` | FUNCIONAL | `json_data.language` pode ser undefined silenciosamente |
| `CallProFollowupsConfig` | PARCIAL | Colisão de tabela com `useAgendamentosFollowups` (ambos usam `meetings_followups`) |
| `StagesConfig` | FUNCIONAL | OK — CRUD + drag-and-drop funcionando |
| `PipelinesConfig` | FUNCIONAL | OK — CRUD + reorder com dnd-kit |

---

## 1. AgendamentoFollowupModal

**Arquivo:** `src/components/followups/AgendamentoFollowupModal.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Modal para criar/editar follow-ups de agendamento (pre/pos reunião) por canal.

**O que funciona:**
- `handleSubmit` constrói payload completo e chama `useCreateAgendamentoFollowup` / `useUpdateAgendamentoFollowup` (linha 141-153)
- Validação de guard por canal antes do submit (linhas 113-123)
- `useEffect` popula form corretamente ao abrir em modo edição (linhas 81-105)
- Seletor de fila AS para canal `ligacao` via `useCallProASQueues` (linha 70)
- `WhatsappTemplatePickerModal` integrado e callback correto com 3 campos: `id`, `name`, `uuid` (linha 361)

**Achados / Ressalvas:**
- Validação de `as_queue_id` para canal `ligacao` não é feita — user pode salvar sem fila configurada (não há `alert()` para esse caso)
- `alert()` usado diretamente (linhas 114, 117, 121) — inconsistente com o restante do app que usa `toast` de sonner

---

## 2. AgendamentoFollowupsCard

**Arquivo:** `src/components/followups/AgendamentoFollowupsCard.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Card de listagem e gerenciamento de followups por `MeetingStatus`.

**O que funciona:**
- Lista, edita, copia e exclui via `useDeleteAgendamentoFollowup` com confirmação `AlertDialog` (linha 188)
- `openCopy` cria cópia zerando `id` — corretamente abre modal em modo criar (linha 54)
- Preview de fila AS para canal `ligacao` via join de `asQueues` (linhas 141-145)

**Achados:**
- `openCopy` passa `{ ...f, id: '' }` como `AgendamentoFollowup`, mas o tipo exige `id: string` e empty string não é tratado como "novo" no modal — depende do guard `!!(followup?.id)` em `AgendamentoFollowupModal:76`. Funciona, mas é frágil.

---

## 3. FollowupEmailEditor

**Arquivo:** `src/components/followups/FollowupEmailEditor.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Editor Tiptap rich-text compacto para corpo de e-mail de followup.

**O que funciona:**
- Editor Tiptap com extensões: StarterKit, Placeholder, Link, Underline, TextAlign (linhas 38-50)
- `onUpdate` propaga HTML ao parent via `onChange` (linha 62)
- Sync bidirecional: `useEffect` atualiza editor quando `content` prop muda externamente (linhas 66-70)
- `BubbleMenu` funcional (linhas 195-213)
- `VariablePicker` integrado — insere via `insertContent` no cursor (linhas 87-89)

**Achados:**
- CSS injetado via `<style>` inline (linhas 219-231) — funciona mas pode vazar para outros componentes se houver múltiplas instâncias na mesma página

---

## 4. FollowupModal

**Arquivo:** `src/components/followups/FollowupModal.tsx`
**Status:** PARCIAL

**Funcionalidade declarada:** Modal para criar/editar followups de etapa (pipeline stage), com suporte a canal, timing, score, etapa destino e controle N8N.

**O que funciona:**
- `handleSubmit` constrói payload e chama `useCreateFollowup` / `useUpdateFollowup` (linhas 141-149)
- Validação por canal (linhas 115-124)
- Etapa de destino e campo `control` salvos corretamente no payload (linhas 138-139)
- `ScoreMatrixSelector` integrado para filtragem por score (linha 242)

**O que está QUEBRADO / INCOMPLETO:**

1. **`template_name` nunca salvo ao carregar followup existente (linha 97):**
   ```ts
   template_name: followup.template_id ?? '',  // deveria ser o nome real, não o ID
   ```
   `StageFollowup` não tem campo `template_name` no hook — display do botão de template ao editar mostrará o ID técnico no lugar do nome amigável.

2. **Canal `ligacao` sem handler de fila ou webhook** (linha 316-323): Exibe apenas texto informativo "N8N será responsável", mas não coleta `as_queue_id` nem webhook URL. Se o hook de criação precisar de configuração adicional para esse canal, o payload estará incompleto.

3. **`onSelect` do `WhatsappTemplatePickerModal` não recebe o 3º argumento `uuid`** (linha 435):
   ```ts
   onSelect={(id, name) => { upd({ template_id: id, template_name: name }); ... }}
   ```
   O modal passa 3 parâmetros `(id, name, uuid)` mas aqui só 2 são capturados — `whatsapp_template_id` nunca é populado no `StageFollowup` via este modal.

---

## 5. MultiSelectScoreMatrix

**Arquivo:** `src/components/followups/MultiSelectScoreMatrix.tsx`
**Status:** QUEBRADO

**Funcionalidade declarada:** Seletor multi-score com badges de objetivo/investimento/segmento para filtrar followups.

**O que está QUEBRADO:**

Acessa campos inexistentes na interface `ScoreMatrix` (linhas 65-67 e 109-111):
```ts
const objective = objectives.find(o => matrix.objective_id?.includes(o.id));
const investment = investments.find(i => matrix.investment_id?.includes(i.id));
const framing = framings.find(f => matrix.framing_id?.includes(f.id));
```

A interface atual de `ScoreMatrix` (`src/hooks/useScoreMatrix.ts:16-29`) não possui os campos `objective_id`, `investment_id` ou `framing_id`. O modelo foi migrado para `category_selections: Record<string, string[]>` (formato dinâmico). Todos os badges de objetivo/investimento/segmento sempre renderizarão `undefined` — os badges não aparecerão.

**Dependências usadas corretamente** (`useScoreObjectives`, `useScoreInvestments`, `useScoreFramings`): os hooks existem e funcionam, mas são inutilizados porque os campos de correlação (`objective_id` etc.) não existem em `ScoreMatrix`.

**Impacto:** O componente renderiza, a seleção e remoção de scores funciona, mas toda a UI de badges informacionais fica em branco — UX severamente degradada.

---

## 6. ScoreMatrixSelector

**Arquivo:** `src/components/followups/ScoreMatrixSelector.tsx`
**Status:** QUEBRADO

**Funcionalidade declarada:** Select single de score matrix com badges de objetivo/investimento/segmento.

**O que está QUEBRADO:**

Mesma causa do `MultiSelectScoreMatrix` — acessa campos legados inexistentes (linhas 72-75):
```ts
const objective = objectives.find(o => matrix.objective_id?.includes(o.id));
const investment = investments.find(i => matrix.investment_id?.includes(i.id));
const framing = framings.find(f => matrix.framing_id?.includes(f.id));
```

O valor `'N/A'` é exibido para todos os badges (linhas 89, 93, 97) porque `objective`, `investment`, `framing` sempre são `undefined`.

**O que funciona:** A seleção em si (`value`/`onValueChange`) funciona — o score é selecionado e salvo. O problema é apenas na visualização dos labels descritivos.

---

## 7. StageFollowupsCard

**Arquivo:** `src/components/followups/StageFollowupsCard.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Card de listagem de followups de uma etapa do funil, com agrupamento por score.

**O que funciona:**
- Lista followups separados em "Gerais" e "Por Score" (linhas 41-42)
- CRUD completo: editar, copiar, excluir via `useDeleteFollowup` (linhas 98-127)
- Badge de score via join com `useScoreMatrix` (linhas 49, 76-81)
- `FollowupModal` com `stageId` pre-populado (linha 188)

**Achados:**
- `leadsCount` prop aceita mas só é exibida se `> 0` — não há indicador quando zero leads (pode confundir)

---

## 8. VariablePicker

**Arquivo:** `src/components/followups/VariablePicker.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Popover com lista de variáveis de template organizadas por tab.

**O que funciona:**
- 4 tabs: Lead, Pessoa, Empresa, Agendamento — com variáveis estáticas hardcoded (linhas 26-110)
- `onInsert` chamado ao clicar na variável (linha 187)
- `insertAtTextareaCursor` utility exportada e funcional (linhas 218-239)
- Nenhuma dependência externa de dados — componente puro

**Achados:**
- Variáveis são hardcoded estáticas. Se o N8N mudar as chaves esperadas, esse componente não reflete automaticamente — acoplamento implícito com o schema do webhook.

---

## 9. WhatsappTemplatePickerModal

**Arquivo:** `src/components/followups/WhatsappTemplatePickerModal.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Modal de seleção de template WhatsApp com preview expandido.

**O que funciona:**
- Filtra apenas templates com `status === 'approved'` (linhas 30-32)
- Busca por nome e ID (linhas 34-37)
- `handleSelect` chama `onSelect(template.id_template, template.nome, template.id)` com 3 args (linha 40-42)
- Preview expandível via `WhatsappTemplateDetails` (linha 154)

**Achados:**
- `template.json_data?.language` (linha 128) nunca existe na interface `WhatsappTemplate` — o campo está como `languageCode` (linha 26 do hook). Badge de idioma nunca renderiza.
- `json_data?.data`, `json_data?.meta` etc. são campos arbitrários do Gupshup sem tipagem — acesso via `[key: string]` é unsafe mas funciona em runtime.

---

## 10. CallProFollowupsConfig

**Arquivo:** `src/components/config/CallProFollowupsConfig.tsx`
**Status:** PARCIAL

**Funcionalidade declarada:** Config de regras de follow-up de reunião via webhook N8N, com histórico de disparos.

**O que funciona:**
- CRUD completo de `FollowupRule` via `useFollowupRules`, `useCreateFollowupRule`, `useUpdateFollowupRule`, `useDeleteFollowupRule` (linhas 413-415)
- Histórico de disparos da fila via `useFollowupQueue` com filtro de status (linhas 423-425)
- `handleToggle` para ativar/desativar regra sem abrir form (linha 450)

**Problema CRÍTICO — Colisão de tabela:**

`useCallProFollowups.ts:83` e `useAgendamentosFollowups.ts:101` **ambos apontam para a tabela `meetings_followups`**, mas com schemas diferentes:
- `useCallProFollowups` lê campos `name`, `webhook_url`, `channel` (modelo webhook N8N)
- `useAgendamentosFollowups` lê campos `type`, `message`, `template_id`, `as_queue_id` (modelo canal/template)

Isso significa que as duas telas (`CallProFollowupsConfig` e `AgendamentoFollowupsCard`) gerenciam a mesma tabela com modelos incompatíveis. Um registro criado por um pode ser lido pelo outro como dado corrompido.

**Outros achados:**
- `isValid` na `RuleForm` tem lógica morta: `|| true` na condição de timing (linha 114) — nunca bloqueia salvar com 0/0/0
- Canal `whatsapp` no enum `FollowupChannel` aqui vs `whatsapp_template` em `useFollowups.ts` — nomenclaturas divergentes entre os dois sistemas

---

## 11. StagesConfig

**Arquivo:** `src/components/config/StagesConfig.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Config de etapas de pipeline com drag-and-drop para reordenação e color picker inline.

**O que funciona:**
- CRUD completo via `usePipelines` — `criarStage`, `atualizarStage`, `deletarStage` (linha 26)
- Drag-and-drop com `@hello-pangea/dnd` — reordenação sequencial com update de `ordem` (linhas 104-128)
- Color picker inline com update `onBlur` e rollback em caso de erro (linhas 86-99)
- `localStages` com `isReordering` flag para evitar reset durante drag (linhas 32-34)

**Achados:**
- `deletarStage` faz soft-delete (`ativo: false`) em vez de DELETE real (linha 79) — semanticamente inconsistente com o label "Excluir"
- Drag reordena com N chamadas sequenciais ao banco (uma por stage) em vez de batch — lento para pipelines com muitas etapas

---

## 12. PipelinesConfig

**Arquivo:** `src/components/config/PipelinesConfig.tsx`
**Status:** FUNCIONAL

**Funcionalidade declarada:** Config de pipelines com drag-and-drop, toggle ativo/inativo e visualização de etapas.

**O que funciona:**
- CRUD completo via `usePipelines` — `criarPipeline`, `atualizarPipeline`, `deletePipeline`, `reordenarPipelines` (linha 198)
- Drag-and-drop com `@dnd-kit/core` — otimista local com rollback em erro (linhas 206-221)
- Toggle ativo/inativo sem form (linha 277)
- Navegação para `StagesConfig` inline sem router (linhas 301-303)

**Achados:**
- Prop `selectedTenantId` declarada mas nunca usada (`_selectedTenantId`) (linha 188) — dead prop
- `pipeline: any` e `stages: any[]` em `SortablePipelineRowProps` (linhas 36-37) — tipos ausentes

---

## Achados Transversais

### A. Colisão de tabela `meetings_followups`
`useCallProFollowups` e `useAgendamentosFollowups` operam sobre a mesma tabela DB com modelos completamente diferentes. Isso é o maior risco de integridade de dados no módulo.

### B. `ScoreMatrix` sem campos legacy `objective_id`/`investment_id`/`framing_id`
`MultiSelectScoreMatrix` e `ScoreMatrixSelector` usam campos que existiam em versão anterior do schema. A migração para `category_selections: Record<string,string[]>` não foi propagada nesses dois componentes.

### C. `FollowupModal` perde `whatsapp_template_id` ao salvar
O callback `onSelect` só captura 2 dos 3 parâmetros do `WhatsappTemplatePickerModal`. O UUID do template nunca é salvo para followups de etapa — somente o `id_template` textual.

### D. Inconsistência de canal: `whatsapp` vs `whatsapp_template`
`CallProFollowupsConfig` usa `channel: 'whatsapp'`, enquanto `FollowupModal` usa `canal: 'whatsapp_template'`. Os dois sistemas não são interoperáveis.

### E. `template_name` fantasma em `FollowupModal`
`StageFollowup` (hook) não expõe `template_name`. Ao editar um followup existente, o display do template mostrará o ID técnico em vez do nome amigável.
