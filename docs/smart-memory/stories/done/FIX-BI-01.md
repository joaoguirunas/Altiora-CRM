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
- [x] AC1: Tokens Meta Ads e Google Ads têm refresh automático implementado (cron ou on-demand)
- [x] AC2: Edge fn de TikTok sync identificada ou criada — sync de dados de campanha funcional
- [x] AC3: Dashboard BI não exibe dados desatualizados por token expirado
- [x] AC4: Expiração de token gera alerta/notificação ao usuário (não silêncio)

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
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List

- `supabase/functions/bi-sync-meta-ads/index.ts` — AC1: select agora inclui `token_expires_at`; bloco de verificação de expiração + extensão via `fb_exchange_token` usando `bi_settings.meta_app_id/secret`
- `src/hooks/useBIProAdAccounts.ts` — AC3/AC4: `syncAccount` propaga `tokenExpired: true`; `onError` exibe toast descritivo quando token expira
- `src/pages/Dashboard.tsx` — AC3: `handleMetaSync` pula contas com token expirado; AC4: banner de alerta persistente quando `token_expires_at <= now`
- **AC1 Google**: já implementado em `supabase/functions/bi-sync-google-ads/index.ts` (pré-existente)
- **AC2 TikTok**: `supabase/functions/tiktok-ads-sync/index.ts` já existe com `refreshTikTokAdsToken()` + pg_cron a cada 6h (pré-existente)

## QA Results
