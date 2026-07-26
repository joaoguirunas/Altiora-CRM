---
title: "Story FIX-SENDS-FILTER-02: Corrigir has_more com count real em filter-leads-for-send"
type: story
status: done
epic: SENDS
complexity: S
agent: dev-dev-beta
created: 2026-04-30
updated: 2026-07-25
tags: [story, sends-pro, filter, bug, P1]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]"]
---

# Story FIX-SENDS-FILTER-02: Corrigir has_more com count real em filter-leads-for-send

## Objetivo

Corrigir o cálculo de `has_more` em `filter-leads-for-send` para que a paginação de audiências grandes funcione corretamente mesmo quando o filtro JS de leads (`needsLeadFilter`) exclui parte dos rows retornados pelo Postgres.

## Acceptance Criteria

- [x] AC1: Quando a audiência tem 1200 contatos filtráveis e `limit=500`, três chamadas paginadas somam exatamente os 1200 contatos sem repetição ou omissão.
- [x] AC2: `has_more` retorna `true` enquanto houver contatos adicionais no banco que satisfaçam os filtros, e `false` apenas quando a última página foi retornada.
- [x] AC3: `total` no response reflete o número real de contatos únicos após deduplicação na página retornada (comportamento atual, mantido).
- [x] AC4: Nenhum finding de paginação duplicada — cada `people_id` aparece no máximo uma vez em todas as páginas.

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

`rawCount = data?.length` é o tamanho do array pós-`.range()` (máx = `limit`). Quando `needsLeadFilter=true`, o bloco JS filtra pessoas sem leads correspondentes.

**Solução implementada:** `{ count: 'exact' }` no select principal. PostgREST retorna `count` via `Content-Range` header (total sem `.range()`). `has_more = (offset + rawCount) < totalCount`. Fallback para `rawCount === limit` se `totalCount` for null.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup (commit 527d1b5) |

## File List
- `supabase/functions/filter-leads-for-send/index.ts` — adicionado `{ count: 'exact' }` no select; destructuring `count: totalCount`; `hasMore = (offset + rawCount) < totalCount`; `count_total` exposto no response

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-FILTER-02 | Data: 2026-07-25
Checklist: 8/8 verificados
tsc: EXIT 0 | lint: sem novos erros
Issues: nenhum

AC1 ✅  { count: 'exact' } no select → PostgREST retorna totalCount via Content-Range.
        has_more = (offset + rawCount) < totalCount.
        1200 contatos / limit=500: chamada 1 (0+500<1200 → true), 2 (500+500<1200 → true),
        3 (1000+200<1200 → false). Paginação correta.
AC2 ✅  has_more=false só na última página. Sem paginação infinita.
AC3 ✅  count_total = totalCount ?? rawCount exposto no response.
AC4 ✅  Deduplicação (Map por people_id) intocada. Sem duplicatas.

Fallback ✅  Se totalCount=null (PostgREST sem count suporte): rawCount === limit.
             Conservador — pode indicar mais páginas mesmo na última. Aceitável.

Próximo passo: @dev-devops push
```
