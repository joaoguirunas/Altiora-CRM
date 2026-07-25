---
title: "FIX-BI-01: OAuth token refresh para integrações BI + localizar edge fn TikTok sync"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-analyst
created: 2026-04-22
updated: 2026-04-22
tags: [story, bi-pro, bug, P2]
related: ["[[../../project/modules/bi-pro]]"]
---

# FIX-BI-01: OAuth token refresh para integrações BI + localizar edge fn TikTok sync

## Objetivo
Garantir que tokens OAuth das integrações BI (Meta, Google, TikTok) sejam renovados automaticamente antes de expirar, e identificar/criar a edge fn de sync TikTok.

## Acceptance Criteria
- [ ] AC1: Tokens Meta Ads e Google Ads têm refresh automático implementado (cron ou on-demand)
- [ ] AC2: Edge fn de TikTok sync identificada ou criada — sync de dados de campanha funcional
- [ ] AC3: Dashboard BI não exibe dados desatualizados por token expirado
- [ ] AC4: Expiração de token gera alerta/notificação ao usuário (não silêncio)

## Escopo

**IN:**
- Identificar onde tokens OAuth ficam armazenados (provavelmente `tenant_integrations` ou similar)
- Implementar refresh antes de chamadas de sync (verificar `expires_at`)
- Criar/localizar `supabase/functions/tiktok-sync/` ou equivalente
- Adicionar pg_cron para refresh periódico se não existir

**OUT:**
- Refactor do dashboard de BI
- Novas métricas ou fontes de dados

## Contexto Técnico
Deep-dive bi-pro flagou: "OAuth tokens sem refresh; TikTok sync edge fn não localizada". Meta e Google já têm fluxo OAuth mas sem renovação automática. Ver `docs/smart-memory/project/modules/bi-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-analyst (lyra) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/bi-oauth-refresh-tiktok-sync |

## File List

## QA Results
