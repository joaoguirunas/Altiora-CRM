---
title: "ADM-V3-06: Índices em adm_audit_log para queries de paginação"
type: story
status: done
epic: adm-v3
complexity: S
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, adm, control-plane, performance, database, P2]
related: ["[[../../project/modules/adm-control-plane]]"]
---

# ADM-V3-06: Índices em adm_audit_log para queries de paginação

## Objetivo
Adicionar índices faltantes em `adm_audit_log` para que a paginação de 30 registros por página com filtros por `action`, `entity_type` e `created_at` não degrade com volume crescente.

## Acceptance Criteria
- [x] AC1: Migration `supabase/migrations_adm/` cria índice `adm_audit_log_created_at_idx ON adm_audit_log (created_at DESC)` — usado pelo ORDER BY implícito na paginação
- [x] AC2: Migration cria índice `adm_audit_log_actor_id_idx ON adm_audit_log (actor_id)` — filtro por usuário no `AdmAuditLogPanel`
- [x] AC3: Migration cria índice composto `adm_audit_log_action_entity_idx ON adm_audit_log (action, entity_type)` — filtros combinados no painel
- [ ] AC4: `EXPLAIN (ANALYZE, BUFFERS)` em query de paginação com 10.000 registros — requer execução no control plane (fora do escopo de migration authoring)
- [x] AC5: Índices criados com IF NOT EXISTS — não bloqueiam re-run nem INSERTs existentes

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations_adm/20260423010000_adm_audit_log_indexes.sql`

## QA Results
<!-- QA preenche ao revisar -->
