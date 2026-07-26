---
title: "Story FIX-SENDS-IMPORT-03: Criar lead para contatos existentes quando create_leads=true"
type: story
status: backlog
epic: SENDS
complexity: M
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, import, crm, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]", "[[SENDS-IMPORT-01]]"]
---

# Story FIX-SENDS-IMPORT-03: Criar lead para contatos existentes quando create_leads=true

## Objetivo

Corrigir o `sends-import-contacts` para criar leads também para contatos que já existem no banco (dedup encontrou match) quando `create_leads=true` é passado, garantindo que 100% da audiência importada entre no CRM — não apenas os contatos novos.

## Acceptance Criteria

- [ ] AC1: Import com `create_leads=true` e 100% de contatos já existentes no banco resulta em leads criados para todos eles no pipeline/stage especificado.
- [ ] AC2: Lead NÃO é duplicado se já existir no mesmo pipeline para aquele contato (`people_id + pipeline_id` já tem lead) — apenas cria se não existir.
- [ ] AC3: Import com `create_leads=true` e contatos mistos (50% novos, 50% existentes) cria leads para ambos os grupos.
- [ ] AC4: Import com `create_leads=false` continua sem criar leads para nenhum contato (invariante).
- [ ] AC5: `lead_extra` fields são aplicados ao lead criado para contatos existentes, da mesma forma que para novos.
- [ ] AC6: A contagem de `new_people` e `existing_people` na sessão permanece correta — a criação de lead não afeta essa contagem.

## Escopo

**IN:**
- Adicionar bloco de criação de lead no caminho `existingPersonId` do loop principal em `sends-import-contacts/index.ts`
- Verificação de existência de lead no pipeline antes de criar (evitar duplicata)
- Aplicar `lead_extra` fields e `score_matrix_id` ao lead criado para existentes (paridade com fluxo de pessoa nova)

**OUT:**
- Mudança na lógica de dedup (permanece igual)
- Criação de leads para o caso `create_leads=false`
- Mudança na interface/contrato da edge function

## Contexto Técnico

**Bug raiz:** `supabase/functions/sends-import-contacts/index.ts` — linha 419 (`continue` no bloco `existingPersonId` antes de qualquer verificação de `create_leads`).

O bloco de pessoa existente (L377-419) atualiza campos e faz `continue` sem verificar `create_leads`. O bloco de criação de lead (L474-519) está apenas no fluxo de pessoa nova.

**Fix no bloco existingPersonId, antes do `continue`:**
```typescript
// Após atualizar campos e score (L400-417), antes do continue:
if (create_leads && pipeline_id && stage_id) {
  const { count: existingLeadCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('people_id', existingPersonId)
    .eq('leads_pipelines_id', pipeline_id);

  if ((existingLeadCount ?? 0) === 0) {
    const rowLeadControl = field_mapping.lead_control
      ? row[field_mapping.lead_control]?.trim() || null : null;
    const effectiveControl = rowLeadControl || lead_control || null;

    const { data: newLead } = await supabase.from('leads').insert({
      people_id: existingPersonId,
      leads_pipelines_id: pipeline_id,
      leads_stages_id: stage_id,
      status: 'ativo',
      ...(effectiveControl ? { control: effectiveControl } : {}),
    }).select('id').single();

    if (newLead && lead_extra) {
      // aplicar lead_extra fields (mesmo padrão do fluxo de pessoa nova)
    }
  }
}
continue;
```

**Nota:** A query extra de count por contato ainda é N+1, mas é O(1) adicional por contato existente que precisa de lead — aceitável para esta story. A otimização bulk fica para FIX-SENDS-IMPORT-04.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
