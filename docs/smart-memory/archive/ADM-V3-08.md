---
title: "ADM-V3-08: UI badge de drift de schema por tenant na sidebar do ADM"
type: story
status: backlog
epic: adm-v3
complexity: S
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, adm, control-plane, ux, P3]
related: ["[[../../project/modules/adm-control-plane]]"]
---

# ADM-V3-08: UI badge de drift de schema por tenant na sidebar do ADM

## Objetivo
Exibir na listagem de clientes do ADM um badge visual indicando quando `db_version !== system_version` (drift de schema), permitindo ao super-admin identificar tenants desatualizados sem precisar verificar cada um individualmente.

## Acceptance Criteria
- [ ] AC1: `AdmClientRow` exibe badge "Desatualizado" (ícone `AlertTriangle`, cor `amber`) quando `client.db_version !== system_version` — `system_version` lido de `/version.json` via hook `useSystemVersion`
- [ ] AC2: Hook `useSystemVersion()` em `src/hooks/useAdmClients.ts` faz fetch de `{CONTROL_PLANE_URL}/storage/v1/object/public/app-assets/version.json` — resultado cacheado via `staleTime: 60_000`
- [ ] AC3: Badge "Atualizado" (ícone `CheckCircle2`, cor `green`) quando `db_version === system_version` e `db_version` não é null
- [ ] AC4: Badge "Nunca sincronizado" (cor `muted`) quando `db_version` é null ou `sync_status === 'never'`
- [ ] AC5: Clique no badge de "Desatualizado" aciona `useSyncClientNow.mutate(client.id)` com confirmação via `SyncConfirmDialog` existente

## Escopo

**IN:**
- Hook `useSystemVersion()` — fetch de `version.json` do storage do control plane
- Modificação de `AdmClientRow.tsx` para exibir badge de drift
- Modificação de `StatsBar` em `Adm.tsx` para exibir contagem de clientes desatualizados

**OUT:**
- Health check via conexão TCP (coberto por `useCheckHealth` + `adm-health-check` — diferente de drift de schema)
- Notificação automática para super-admin (alertas externos — fora de escopo)
- `db_version` tracking histórico

## Contexto Técnico
Deep-dive §9 stories candidatas item ADM-V3-09: "UI: badge na sidebar de drift de schema (`db_version !== system_version`) por cliente". `system_version` é o valor em `version.json` do storage `app-assets/` do control plane — o mesmo arquivo que `adm-health-check` consome (§5, step 3 do fluxo). `db_version` está em `adm_clients.db_version` (atualizado por `useSyncClientNow` após sync bem-sucedido via leitura de `/version.json`). O fetch de `version.json` pode ser feito diretamente do browser — URL pública (storage sem auth). `StatsBar` atualmente mostra total/sincronizados/em andamento/com erros — adicionar coluna "desatualizados" como 5º card.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/adm-schema-drift-badge |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
