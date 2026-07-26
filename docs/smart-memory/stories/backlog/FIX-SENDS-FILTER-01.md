---
title: "Story FIX-SENDS-FILTER-01: Corrigir filtro person_status ignorado em filter-leads-for-send"
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

# Story FIX-SENDS-FILTER-01: Corrigir filtro person_status ignorado em filter-leads-for-send

## Objetivo

Corrigir colisão de predicados SQL em `filter-leads-for-send` que faz o filtro `person_status` ser completamente ignorado, causando audiências erradas em campanhas que filtram por contatos inativos ou arquivados.

## Acceptance Criteria

- [ ] AC1: Quando `person_status = ['inactive']` é passado como filtro, a query retorna apenas pessoas com `status = 'inactive'` (não zero resultados).
- [ ] AC2: Quando `person_status = ['active', 'inactive']` é passado, retorna pessoas com qualquer dos dois status.
- [ ] AC3: Quando `person_status` não é passado (omitido), o comportamento padrão mantém-se: apenas `status = 'active'` é incluído.
- [ ] AC4: Teste adversarial: passar `person_status = ['archived']` retorna apenas arquivados, não zero.
- [ ] AC5: Nenhum outro filtro existente regride (Q-fields, score, UTM, stage, etc.) — `npm run test` passa.

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
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
