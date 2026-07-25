---
title: "Story FIX-SENDS-FILTER-02: Corrigir has_more com count real em filter-leads-for-send"
type: story
status: backlog
epic: SENDS
complexity: S
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, filter, bug, P1]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]"]
---

# Story FIX-SENDS-FILTER-02: Corrigir has_more com count real em filter-leads-for-send

## Objetivo

Corrigir o cálculo de `has_more` em `filter-leads-for-send` para que a paginação de audiências grandes funcione corretamente mesmo quando o filtro JS de leads (`needsLeadFilter`) exclui parte dos rows retornados pelo Postgres.

## Acceptance Criteria

- [ ] AC1: Quando a audiência tem 1200 contatos filtráveis e `limit=500`, três chamadas paginadas somam exatamente os 1200 contatos sem repetição ou omissão.
- [ ] AC2: `has_more` retorna `true` enquanto houver contatos adicionais no banco que satisfaçam os filtros, e `false` apenas quando a última página foi retornada.
- [ ] AC3: `total` no response reflete o número real de contatos únicos após deduplicação na página retornada (comportamento atual, mantido).
- [ ] AC4: Nenhum finding de paginação duplicada — cada `people_id` aparece no máximo uma vez em todas as páginas.

## Escopo

**IN:**
- Corrigir o cálculo de `has_more` na linha 385 de `filter-leads-for-send/index.ts`
- Adicionar `SELECT count(*)` separado (ou usar `.count('exact')` no select) para obter o total real antes da deduplicação JS
- Expor o `count_total` real no response para que o LiveCounterSidebar mostre contagem precisa

**OUT:**
- Mudança na lógica de deduplicação (Map por people_id permanece)
- Mudança no frontend além de consumir `count_total` se exposto

## Contexto Técnico

**Bug raiz:** `supabase/functions/filter-leads-for-send/index.ts` — linha 344-385.

`rawCount = data?.length` é o tamanho do array pós-`.range()` (máx = `limit`). Quando `needsLeadFilter=true`, o bloco JS filtra pessoas sem leads correspondentes. Se Postgres retorna 500 rows mas 200 não têm leads válidos, `contacts.length = 300 < limit = 500`, logo `has_more = rawCount === limit = (500 === 500) = true`. Isso é correto neste caso — mas se as próximas 500 rows também tiverem a mesma proporção de filtradas, o caller precisará de muitas chamadas para descobrir que acabaram os dados válidos.

O risco maior: se `needsLeadFilter=false` e há deduplicação de pessoas com múltiplos leads, pode retornar `has_more: false` prematuramente.

**Solução recomendada:** Adicionar query de count separada antes da query principal usando os mesmos filtros mas sem `.range()`:
```typescript
const { count: totalCount } = await supabase
  .from('clients_people')
  .select('*', { count: 'exact', head: true })
  // ...mesmos filtros...
```
Usar `totalCount` para calcular `has_more: (offset + contacts.length) < totalCount`.

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
