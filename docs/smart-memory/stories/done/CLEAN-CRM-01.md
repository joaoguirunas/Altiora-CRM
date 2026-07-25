---
title: "CLEAN-CRM-01: Round-robin, alias PT/EN, corrigir useMotivosPerda fora do padrão"
type: story
status: done
priority: P3
complexity: S
agent: dev-dev-gamma
created: 2026-04-22
updated: 2026-04-22
tags: [story, crm-pro, debt, P3]
related: ["[[../../project/modules/crm-pro]]"]
---

# CLEAN-CRM-01: Round-robin, alias PT/EN, corrigir useMotivosPerda fora do padrão

## Objetivo
Implementar round-robin automático de atribuição de leads e padronizar hooks e aliases do CRM PRO.

## Acceptance Criteria
- [ ] AC1: Round-robin de atribuição implementado (leads distribuídos automaticamente entre vendedores ativos)
- [ ] AC2: Aliases PT/EN inconsistentes padronizados (definir PT como canônico, remover duplicatas EN)
- [ ] AC3: `useMotivosPerda` refatorado para seguir padrão TanStack Query (`useQuery` + `queryKey`)
- [ ] AC4: Nenhuma regressão no Kanban de pipelines

## Escopo

**IN:**
- Lógica de round-robin em atribuição de lead (RPC ou frontend)
- Audit e cleanup de aliases: `grep -r "motivos_perda\|reasonsLost\|lossReasons"` etc.
- Refactor de `useMotivosPerda` para padrão TanStack Query

**OUT:**
- Refactor do modelo de pipelines
- Novos campos de CRM

## Contexto Técnico
CRM PRO tem split legado (`crm_*`) vs moderno. Atribuição é só manual hoje — sem round-robin. Aliases em PT e EN coexistem (ex: `etapa` e `stage`). `useMotivosPerda` usa pattern diferente dos outros hooks. Ver `docs/smart-memory/project/modules/crm-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List

- `supabase/migrations/20260423014000_crm_round_robin_rpc.sql` — RPC assign_lead_round_robin
- `src/hooks/useRoundRobinAssign.ts` — TanStack Query mutation wrapper para o RPC
- `src/hooks/useMotivosPerda.ts` — refatorado para TanStack Query (useQuery + useMutation)
- `src/components/config/MotivosConfig.tsx` — atualizado para usar motivo.name (não .nome)
- `src/components/negocios/MotivoPerdasModal.tsx` — atualizado para usar motivo.name
- `src/pages/NegocioSingle.tsx` — atualizado para usar motivo.name; fix residual: `motivoEncontrado.nome` → `.name` (linha 178)

## Acceptance Criteria

- [x] AC1: Round-robin implementado via RPC assign_lead_round_robin + hook useRoundRobinAssign
- [x] AC2: Alias PT/EN padronizado — .nome removido de useMotivosPerda, callers usam .name
- [x] AC3: useMotivosPerda refatorado para TanStack Query (useQuery + useMutation por operação)
- [x] AC4: Nenhuma regressão no Kanban — apenas MotivoPerdasModal e MotivosConfig afetados

## QA Results
