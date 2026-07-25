---
title: "AUTH-V2-08: CSP + COOP/COEP headers no Vercel"
type: story
status: done
epic: auth-v2
complexity: S
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, auth, security, csp, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]"]
---

# AUTH-V2-08: CSP + COOP/COEP headers no Vercel

## Objetivo
Configurar Content Security Policy e Cross-Origin headers no `vercel.json` para reduzir superfície de ataque XSS e isolamento de contexto de browsing, sem quebrar funcionalidades existentes (OAuth popups, iframes de integração, etc.).

## Acceptance Criteria
- [ ] AC1: `vercel.json` inclui header `Content-Security-Policy` com diretivas: `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (necessário para Vite dev — avaliar `nonce` ou hash em prod); `connect-src 'self' *.supabase.co wss://*.supabase.co`; `img-src 'self' data: blob: *.supabase.co`; `frame-ancestors 'none'`
- [ ] AC2: Header `X-Frame-Options: DENY` configurado
- [ ] AC3: Header `X-Content-Type-Options: nosniff` configurado
- [ ] AC4: Fluxos OAuth (Google Calendar, Meta, Teams, TikTok) não quebram — `connect-src` inclui os domínios OAuth necessários; popups continuam abrindo
- [ ] AC5: `Referrer-Policy: strict-origin-when-cross-origin` configurado — impede leak de URL em requests cross-origin

## Escopo

**IN:**
- Criação/atualização de `vercel.json` com seção `headers`
- Auditoria de domínios externos usados pelo app (Supabase, OAuth providers, ElevenLabs, etc.) para adicionar em `connect-src`

**OUT:**
- COOP/COEP headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) — OAuth popups precisam de `same-origin-allow-popups` e COEP pode quebrar SharedArrayBuffer não usado; avaliar separadamente
- CSP nonce-based (requer server-side rendering — app é SPA estático)
- Mudança no código da aplicação

## Contexto Técnico
Deep-dive §9 débito #10: "Sem CSP / Trusted Types — credenciais no JS bundle (anon key control plane) — aceitável (anon key é pública por design), mas headers HTTP de CSP estrita ajudaria." O anon key do control plane está hardcoded em `src/integrations/supabase/client.ts` — isso é por design (anon key é pública). A CSP principal benefício é bloquear XSS que tentaria exfiltrar via `fetch`. Supabase Realtime usa WebSocket (`wss://`) — incluir em `connect-src`. ElevenLabs e outros SDKs JS podem adicionar domains externos — auditar network tab em sessão autenticada.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List

- `vercel.json` — CSP tightened: `connect-src * ws: wss:` → `connect-src 'self' https: wss:` (main `/(.*)`  rule). Alinha com ADR-AUTH-05. Demais headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS) já presentes e conformes.

## QA Results

```
VEREDICTO: PASS
Story: AUTH-V2-08 | Data: 2026-07-25
Checklist: 8/8 verificados
Issues: CONCERN-1 LOW (paperwork — checkboxes ACs não marcados no arquivo)

DIFF analisado (commit 792d4a7 — único arquivo modificado: vercel.json):
  - connect-src * ws: wss:
  + connect-src 'self' https: wss:

Remoções validadas:
  • '*' wildcard: grep src/ confirma ZERO fetch() com http:// hardcoded.
    xmlns="http://..." em SVGs são declarações XML, não network requests.
  • 'ws:' scheme: grep src/ confirma ZERO conexões ws://. Código usa
    exclusivamente wss:// (Supabase Realtime, Gemini Live, derivado via
    supabaseUrl.replace(https→wss)). Todos cobertos por wss:.

AC1 ✅  CSP presente; connect-src 'self' https: wss: segue ADR-AUTH-05
        (accepted). ADR justificou scheme-based vs host-allowlist original:
        webhooks user-defined, multi-tenant subdomains, OAuth client-side.
AC2 ✅  X-Frame-Options: DENY (vercel.json:16)
AC3 ✅  X-Content-Type-Options: nosniff (vercel.json:20)
AC4 ✅  Todos os flows OAuth e WSS verificados; ws: removido sem regressão.
        Rota /f/(.*) com frame-ancestors * pré-existente, não tocada.
AC5 ✅  Referrer-Policy: strict-origin-when-cross-origin (vercel.json:24)

Bônus presentes: Permissions-Policy + HSTS 2 anos preload.

CONCERN-1 (LOW): Checkboxes ACs deixados como - [ ] no arquivo da story.
                 Paperwork — sem impacto funcional.

Próximo passo: @dev-devops push
```
