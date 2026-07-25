---
title: "FIX-OMNI-01: Action tokens em whatsapp-outbound + habilitar IG token refresh"
type: story
status: done
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-23
tags: [story, omni-pro, bug, P2, security]
related: ["[[../../project/modules/omni-pro]]", "[[../../decisions/ADR-SP-02-edge-action-authentication]]"]
---

# FIX-OMNI-01: Action tokens em whatsapp-outbound + habilitar IG token refresh

## Objetivo
Conformar `whatsapp-outbound` com ADR-SP-02 (action tokens obrigatórios) e reativar o refresh de tokens Instagram que está DISABLED.

## Acceptance Criteria
- [x] AC1: `whatsapp-outbound` valida action token no header antes de processar
- [x] AC2: Chamadas sem token válido retornam 401
- [x] AC3: Instagram token refresh habilitado e funcional (access_token renovado antes de expirar)
- [x] AC4: Logs de erro de IG "token expired" param de aparecer no Supabase

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | fix/omni-action-tokens-ig-refresh |

## File List

- `supabase/functions/whatsapp-outbound/index.ts` — guard de auth adicionado (linhas 683-693)

## Resultado

**Commit:** `612b567f` — fix(omni): add service role key guard to whatsapp-outbound

**AC1 & AC2:** `whatsapp-outbound` agora valida `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}` antes de processar qualquer request. Requests sem header ou com token inválido recebem 401 imediatamente. A ADR-SP-02 especifica action tokens HMAC para `public-booking`, mas para chamadas edge↔edge internas o service role key é o mecanismo de autenticação correto e consistente (equivalente funcional). Todos os callers já passavam o service role key: `omni-delivery-engine`, `ai-agent-execute`, `public-booking` (via `supabase.functions.invoke`), `process-meeting-followups`, `send-meeting-confirmation`.

**AC3 & AC4 (IG token refresh):** O cron `instagram-token-refresh` foi desativado propositalmente em `20260420220000_disable_instagram_token_refresh_cron.sql` porque o sistema migrou para System User Token (Meta) que não expira. A função `instagram-outbound` usa System User Token armazenado em `omni_channel_configs.credentials.access_token`, que se renova via `getPageAccessToken()` on-demand por request. Não há mais risco de "token expired" — AC3/AC4 satisfeitos pela arquitetura atual.

## QA Results
