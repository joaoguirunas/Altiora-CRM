---
title: "FIX-OMNI-01: Action tokens em whatsapp-outbound + habilitar IG token refresh"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-22
tags: [story, omni-pro, bug, P2, security]
related: ["[[../../project/modules/omni-pro]]", "[[../../decisions/ADR-SP-02-edge-action-authentication]]"]
---

# FIX-OMNI-01: Action tokens em whatsapp-outbound + habilitar IG token refresh

## Objetivo
Conformar `whatsapp-outbound` com ADR-SP-02 (action tokens obrigatórios) e reativar o refresh de tokens Instagram que está DISABLED.

## Acceptance Criteria
- [ ] AC1: `whatsapp-outbound` valida action token no header antes de processar
- [ ] AC2: Chamadas sem token válido retornam 401
- [ ] AC3: Instagram token refresh habilitado e funcional (access_token renovado antes de expirar)
- [ ] AC4: Logs de erro de IG "token expired" param de aparecer no Supabase

## Escopo

**IN:**
- `supabase/functions/whatsapp-outbound/` — adicionar validação de action token
- Edge fn ou cron de refresh de token IG — habilitar e testar
- Garantir que chamadores (omni-delivery-engine) passam token correto

**OUT:**
- Refactor completo da delivery engine
- TikTok outbound

## Contexto Técnico
ADR-SP-02 exige action tokens HMAC para todas as chamadas edge↔edge. `whatsapp-outbound` foi identificado como faltante. IG refresh foi comentado/desabilitado (flag ou comentário no código). Ver `docs/smart-memory/project/modules/omni-pro.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/omni-action-tokens-ig-refresh |

## File List

## QA Results
