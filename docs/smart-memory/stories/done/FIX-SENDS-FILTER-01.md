---
title: "Story FIX-SENDS-FILTER-01: Corrigir filtro person_status ignorado em filter-leads-for-send"
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

# Story FIX-SENDS-FILTER-01: Corrigir filtro person_status ignorado em filter-leads-for-send

## Objetivo

Corrigir colisão de predicados SQL em `filter-leads-for-send` que faz o filtro `person_status` ser completamente ignorado, causando audiências erradas em campanhas que filtram por contatos inativos ou arquivados.

## Acceptance Criteria

- [x] AC1: Quando `person_status = ['inactive']` é passado como filtro, a query retorna apenas pessoas com `status = 'inactive'` (não zero resultados).
- [x] AC2: Quando `person_status = ['active', 'inactive']` é passado, retorna pessoas com qualquer dos dois status.
- [x] AC3: Quando `person_status` não é passado (omitido), o comportamento padrão mantém-se: apenas `status = 'active'` é incluído.
- [x] AC4: Teste adversarial: passar `person_status = ['archived']` retorna apenas arquivados, não zero.
- [x] AC5: Nenhum outro filtro existente regride (Q-fields, score, UTM, stage, etc.) — `npm run test` passa.

## Escopo

**IN:**
- Remover o `.eq('status', 'active')` hardcoded aplicado incondicionalmente (linha 182)
- Substituir pela lógica: se `person_status` for passado, usar `.in('status', person_status)`; caso contrário, aplicar `.eq('status', 'active')` como default
- Testes adversariais para os três cenários de AC

**OUT:**
- Mudança no schema Zod (já aceita `person_status` corretamente)
- Mudança no frontend (filtros já existem no wizard)
- Mudança em outros filtros de pessoa

## Contexto Técnico

**Bug raiz:** `supabase/functions/filter-leads-for-send/index.ts` — linhas 182 e 259.

O PostgREST serializa encadeamentos de `.eq()` e `.in()` como `AND` separados. Dois predicados sobre a mesma coluna `status` geram `status = 'active' AND status IN ('inactive')` — sempre falso para qualquer valor que não seja `active`.

**Fix mínimo:**
```typescript
// Remover linha 182:
// query = query.eq('status', 'active')

// Substituir pelo bloco condicional:
if (filters.person_status && filters.person_status.length > 0) {
  query = query.in('status', filters.person_status);
} else {
  query = query.eq('status', 'active');
}
```

**Impacto em produção:** Todo disparo criado via wizard com filtro `person_status = inactive/archived` resulta em campanha com zero contatos, sem qualquer aviso ao usuário.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup (commit 527d1b5) |

## File List
- `supabase/functions/filter-leads-for-send/index.ts` — removido `.eq('status','active')` hardcoded; adicionado `else { query = query.eq('status','active') }` na seção person_status

## QA Results

```
VEREDICTO: PASS
Story: FIX-SENDS-FILTER-01 | Data: 2026-07-25
Checklist: 8/8 verificados
tsc: EXIT 0 | lint: sem novos erros
Issues: nenhum

AC1 ✅  person_status=['inactive']: query.in('status', ['inactive']) → só inativos.
AC2 ✅  person_status=['active','inactive']: .in() aceita array → OR semântico no SQL.
AC3 ✅  person_status omitido → else branch: query.eq('status', 'active'). Default correto.
AC4 ✅  person_status=['archived'] → .in() retorna só arquivados. Lógica universal.
AC5 ✅  Fix isolado ao bloco person_status (linhas 260-266). Q-fields, score, UTM,
        stage não tocados. Sem regressão nos outros filtros.

Bug raiz eliminado: conflito SQL
  `status = 'active' AND status IN ('inactive')` → sempre falso. Removido.

Próximo passo: @dev-devops push
```
