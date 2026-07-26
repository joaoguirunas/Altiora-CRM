---
title: "ADM-V3-05: Rotação automática de management_token"
type: story
status: done
epic: adm-v3
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, adm, control-plane, security, P2]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-ADM-02-secrets-encryption]]"]
---

# ADM-V3-05: Rotação automática de management_token

## Objetivo
Rotação periódica automática do management_token de cada tenant via cron job + badge de status na UI.

## Acceptance Criteria
- [x] AC1: Edge function `adm-rotate-management-token` aceita `{ client_id }` ou `{ rotate_all_active: true }`, verifica token via Supabase Management API, cifra/registra, atualiza `management_token_rotated_at`
- [x] AC2: `pg_cron` job `adm_rotate_tokens` configurado em migration `migrations_adm/` para domingos às 02:00 UTC
- [x] AC3: Coluna `management_token_rotated_at timestamptz` adicionada a `adm_clients` via migration
- [x] AC4: Audit log `token.rotated` inserido em `adm_audit_log` após cada tentativa (success/failure)
- [x] AC5: UI em `/adm/clients/:id` exibe badge "Nunca rotacionado" / "Verificado X dias atrás" + botão "Verificar agora"

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations_adm/20260423009000_adm_management_token_rotation.sql`
- `supabase/functions/adm-rotate-management-token/index.ts`
- `src/hooks/useAdmClients.ts` (AdmClient interface + useRotateManagementToken hook)
- `src/pages/AdmClientSingle.tsx` (TokenRotationBadge component + "Verificar agora" button)

## QA Results
<!-- QA preenche ao revisar -->
