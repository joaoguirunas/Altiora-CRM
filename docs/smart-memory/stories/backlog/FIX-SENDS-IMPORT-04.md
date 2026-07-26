---
title: "Story FIX-SENDS-IMPORT-04: Dedup e insert em bulk para suportar imports de >1000 contatos"
type: story
status: backlog
epic: SENDS
complexity: L
agent: dev-dev-delta
created: 2026-04-30
updated: 2026-04-30
tags: [story, sends-pro, import, performance, bug, P2]
related: ["[[../../project/audit-sends-pro]]", "[[SENDS-FIX-01]]", "[[FIX-SENDS-IMPORT-03]]"]
---

# Story FIX-SENDS-IMPORT-04: Dedup e insert em bulk para suportar imports de >1000 contatos

## Objetivo

Refatorar o loop de processamento de `sends-import-contacts` para fazer dedup e insert em batch (bulk), eliminando o padrão N+1 queries que causa timeout da edge function em imports com mais de 1000 contatos.

## Acceptance Criteria

- [ ] AC1: Import de 5000 contatos (CSV) completa dentro do timeout de 150s da Supabase Edge Function.
- [ ] AC2: Import de 5000 contatos com 80% existentes e `create_leads=true` cria os leads corretos para todos (novos e existentes, respeitando FIX-SENDS-IMPORT-03).
- [ ] AC3: Deduplicação por phone/email continua funcionando corretamente em bulk — sem duplicatas criadas.
- [ ] AC4: `sends_import_sessions.processed` é atualizado em intervalos regulares durante o processamento — não apenas no final.
- [ ] AC5: Se a função timeout ou falha no meio do processamento, `sends_import_sessions.status` é marcado como `failed` (não fica em `processing` indefinidamente).
- [ ] AC6: Campos `q_field`, `crm_extra`, `lead_extra`, `score_cat`, `company_struct` continuam sendo processados corretamente.

## Escopo

**IN:**
- Dedup em bulk: `SELECT id, whatsapp, phone, email FROM clients_people WHERE whatsapp IN [...] OR email IN [...]` antes do loop individual
- Insert de novas pessoas em bulk: `INSERT INTO clients_people (...) VALUES (...),(...) ON CONFLICT DO NOTHING`
- `lead_field_values` em bulk com upsert multi-row
- Tratamento de timeout: marcar sessão como `failed` se função não completar

**OUT:**
- Mudança na interface da edge function (input/output permanece igual)
- Migração de dados existentes
- Mudança no frontend (useImportarLista permanece igual)

## Contexto Técnico

**Bug raiz:** `supabase/functions/sends-import-contacts/index.ts` — loop principal L318-536.

Para cada row: ~5-8 queries individuais. Para 5000 rows: ~25.000-40.000 queries. A Supabase Edge Function tem timeout de 150s — o tempo médio de roundtrip para Supabase postgres via edge fn é ~3-5ms, então 25.000 queries = 75-125s mínimo sem considerar processamento.

**Arquitetura bulk:**

```
Fase 1 — Bulk dedup (1-2 queries para TODO o batch):
  SELECT id, whatsapp, phone, email FROM clients_people
  WHERE whatsapp = ANY($phones) OR email = ANY($emails)

Fase 2 — Classificar rows em existing/new

Fase 3 — Bulk INSERT novas pessoas (1 query):
  INSERT INTO clients_people (...) VALUES (...) RETURNING id, whatsapp, email

Fase 4 — Bulk upsert lead_field_values (1 query por campo)

Fase 5 — Bulk INSERT leads para new + existing sem lead (1 query)
```

**Complexidade:** O mapeamento row→people_id precisa ser mantido em memória via Map para aplicar `lead_field_values` corretos a cada pessoa. A implementação exige cuidado com o mapeamento telefone→row para associar o `id` retornado à row correta.

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
