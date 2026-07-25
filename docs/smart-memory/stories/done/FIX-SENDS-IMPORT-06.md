---
title: "Story FIX-SENDS-IMPORT-06: Reintroduzir input estático de lead_control no ImportListaTab"
type: story
status: done
epic: SENDS
complexity: S
agent: dev-dev-gamma
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, import, lead-control, regression, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-IMPORT-01]]", "[[FIX-SENDS-IMPORT-05]]"]
---

# Story FIX-SENDS-IMPORT-06: Reintroduzir input estático de lead_control no ImportListaTab

## Objetivo

Restaurar a capacidade do usuário definir um valor estático único de `lead_control` (origem/controle do negócio) aplicado a todos os contatos importados via UI do `ImportListaTab`, recurso perdido em SENDS-IMPORT-01 quando o preset selector foi removido — mantendo o backend e o hook intactos (já suportam o campo).

## Acceptance Criteria

- [ ] AC1: Quando `createLeads === true`, um input de texto opcional rotulado "Origem / Controle (opcional)" aparece no painel de "Lead creation options" no estado `mapping`, abaixo do seletor de pipeline/etapa.
- [ ] AC2: Quando `createLeads === false`, o input não é renderizado (o campo não tem efeito sem criação de leads — alinhado ao backend que só usa `lead_control` quando `create_leads=true`).
- [ ] AC3: O valor digitado é enviado como `lead_control` no payload de `importarLista({...})` em `handleConfirmMapping`. String vazia (`""`) é normalizada para `null` antes de enviar (não enviar string vazia ao backend).
- [ ] AC4: Se `field_mapping.lead_control` está mapeado (coluna CSV → controle), o valor por linha continua tendo precedência sobre o valor estático — comportamento de `effectiveControl = rowLeadControl || lead_control || null` na edge function (linha 479) é preservado.
- [ ] AC5: Reset de import (botão "Voltar" via `handleReset`) limpa o `leadControlValue` para `''` junto com os demais estados.
- [ ] AC6: Toggle de `createLeads` para `false` não limpa automaticamente `leadControlValue` — o valor é preservado para o caso do usuário religar o toggle. (Apenas o input some da UI; estado fica.)

## Escopo

**IN:**
- Adicionar estado `leadControlValue: string` em `src/components/disparos/ImportListaTab.tsx` com `useState('')`.
- Adicionar `<Input>` (ui/input) dentro do bloco `{createLeads && (...)}` (atual L140-181), abaixo do grid de pipeline/etapa, com `value={leadControlValue}`, `onChange={(e) => setLeadControlValue(e.target.value)}` e `placeholder="ex.: Evento X, Campanha Y"`.
- Passar `lead_control: leadControlValue.trim() || null` no payload de `importarLista({...})` dentro de `handleConfirmMapping` (L80-89).
- Incluir `leadControlValue` no array de deps de `handleConfirmMapping` (`useCallback`).
- Limpar `leadControlValue` em `handleReset` para `''`.

**OUT:**
- Mudança na assinatura de `useImportarLista` ou no tipo `UseImportarListaInput` — já aceita `lead_control?: string | null`.
- Mudança no `FieldMapper` — `lead_control` continua disponível como mapeamento por coluna no dropdown "Dados do Negócio".
- Mudança na edge function `sends-import-contacts` — já lê `lead_control` no body (L52, L103) e aplica `effectiveControl` (L479).
- Reintrodução do preset selector ou template selector removidos em SENDS-IMPORT-01 — apenas o input estático isolado é restaurado.
- Validação de comprimento máximo do `lead_control` (deixa para futura story de hardening de input).

## Contexto Técnico

**Regressão raiz:** commit `16fdb996` (`feat(sends-import): simplificar ImportListaTab — remover presets e templates [Story SENDS-IMPORT-01]`). Junto com a remoção dos presets, foi removida a passagem de `lead_control: leadControl ?? undefined` no payload — o estado `leadControl` foi inteiramente removido do componente.

**Estado atual:**
- `lead_control` ainda existe como mapeamento de coluna no dropdown do FieldMapper (`leadBase` — `FieldMapper.tsx` L348-350). Funciona para mapear uma coluna CSV → controle por linha.
- `useImportarLista.UseImportarListaInput.lead_control?: string | null` ainda existe (`src/hooks/useImportarLista.ts` L27).
- Edge function `sends-import-contacts/index.ts` ainda destrutura `lead_control` do body (L103) e aplica `effectiveControl = rowLeadControl || lead_control || null` (L479).
- Apenas o `ImportListaTab` deixou de passar o valor estático.

**Impacto operacional:** usuários que querem marcar uma fonte/controle igual para todos os contatos de um import (ex.: "Evento Lançamento Q2", "Lista Webinar Abril") perdem a capacidade via UI. O único workaround é preencher uma coluna no CSV com o valor repetido em todas as linhas — fricção desnecessária.

**Localização do fix em ImportListaTab.tsx:**

1. **Estado** (após L37):
```typescript
const [leadControlValue, setLeadControlValue] = useState('');
```

2. **Input** (dentro do bloco `{createLeads && (...)}`, após o grid de pipeline/etapa em L181):
```tsx
<div className="space-y-1.5">
  <Label className="text-[12px] text-muted-foreground">
    Origem / Controle (opcional)
  </Label>
  <Input
    value={leadControlValue}
    onChange={(e) => setLeadControlValue(e.target.value)}
    placeholder="ex.: Evento X, Campanha Y"
    className="h-[32px] text-[12px]"
  />
</div>
```

3. **Payload** (dentro de `handleConfirmMapping`, L82-89):
```typescript
importarLista(
  {
    rows,
    field_mapping: mapping,
    channel,
    create_leads: createLeads,
    pipeline_id: createLeads ? pipelineId : null,
    stage_id: createLeads ? stageId : null,
    lead_control: leadControlValue.trim() || null,
    send_id: sendId,
  },
  // ...
);
```

4. **Reset** (`handleReset`):
```typescript
setLeadControlValue('');
```

**Módulos afetados:**
- `src/components/disparos/ImportListaTab.tsx` — única alteração
- `src/hooks/useImportarLista.ts` — sem mudança
- `supabase/functions/sends-import-contacts/index.ts` — sem mudança

**Constraints:**
- Manter coerência com o estilo Tailwind do bloco existente (h-[32px], text-[12px], gap, etc.).
- Não exibir o input fora do contexto `createLeads === true` — `lead_control` sem `create_leads` é no-op no backend.
- Trim antes de enviar; string vazia vira `null` para evitar gravar control vazio em `leads.control`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-04-30 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List

- `src/components/disparos/ImportListaTab.tsx` — estado `leadControlValue`, input "Origem / Controle", payload `lead_control`, reset incluído

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-IMPORT-06 | Data: 2026-04-30 | QA: Axikar
Checklist: 8/8 verificados
Issues: nenhum
Próximo passo: @dev-devops push
```

**Detalhamento por AC:**
- AC1: Input "Origem / Controle (opcional)" adicionado em `src/components/disparos/ImportListaTab.tsx:186-194`, dentro do bloco `{createLeads && (...)}`, abaixo do grid pipeline/etapa. Estilo Tailwind coerente (h-[32px], text-[12px]).
- AC2: Input renderiza somente quando `createLeads === true` (gateado por `{createLeads && (...)}` na L143).
- AC3: Payload em `handleConfirmMapping` envia `lead_control: createLeads && leadControlValue.trim() ? leadControlValue.trim() : null` (L91). String vazia → null; adicional gate em `createLeads` é defesa em profundidade alinhada ao backend.
- AC4: Backend `sends-import-contacts/index.ts:476-479` mantém `effectiveControl = rowLeadControl || lead_control || null` — precedência da coluna por linha sobre o estático preservada.
- AC5: `setLeadControlValue('')` em `handleReset` (L77).
- AC6: Toggle `createLeads` para `false` não chama `setLeadControlValue` — apenas o bloco UI desmonta. Estado preservado para religar.

**Cross-cutting:**
- `leadControlValue` adicionado às deps do `useCallback` (L101).
- Hook `useImportarLista.UseImportarListaInput.lead_control?: string | null` já existia — sem mudança de assinatura.
- Typecheck: limpo.

**Files reviewed:**
- `src/components/disparos/ImportListaTab.tsx` (L4, L39, L77, L91, L101, L143-196)
