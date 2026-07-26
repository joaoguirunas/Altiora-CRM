---
title: "BI-VOICE-01: Edge function gemini-live-token (ephemeral, per-tenant cost isolation)"
type: story
status: done
epic: bi-voice
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-24
updated: 2026-04-24
tags: [story, bi-voice, edge-function, gemini, security, rate-limit]
related: ["[[BI-VOICE-00]]", "[[../../decisions/ADR-BI-VOICE-01-gemini-live-architecture]]"]
---

# BI-VOICE-01: Edge function gemini-live-token (ephemeral, per-tenant cost isolation)

## Objetivo
Implementar edge function que gera ephemeral token Gemini Live para o browser, autenticada por JWT do usuário e isolando custo por tenant via leitura da Gemini API key configurada em `settings_ai_providers`.

## Acceptance Criteria
- [x] AC1: Edge function `gemini-live-token` valida JWT via `supabase.auth.getUser(token)`; rejeita 401 se inválido.
- [x] AC2: Lê `tenant_id` do `app_metadata.tenant_id` (server-verified, não passado por body).
- [x] AC3: Busca Gemini API key via `getProviderKey('gemini', supabase)`. Se não configurada → `412` com `{ error: 'gemini_not_configured', message: '...' }`.
- [x] AC4: Chama Google API `POST /v1alpha/auth_tokens?key={key}` com `uses=1, expireTime, sessionResumption`; retorna `{ token, expires_at, model_id }`.
- [x] AC5: Rate limit por tenant: max 20 tokens/hora via `bi_voice_token_log` + count query. Excedido → `429` com `retry_after_seconds`.
- [x] AC6: Token tem `uses=1` e `expireTime = now()+60s` (single-use, 60s TTL).
- [x] AC7: Response inclui `X-Gemini-Model` e `X-Token-TTL` headers.
- [x] AC8: Logs estruturados JSON em fire-and-forget (sem vazar key): `tenant_id, user_id, issued_at, expires_at, status`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | 2026-04-24 |
| Concluído  | 2026-04-24 |
| Branch     | feat/bi-voice-01-gemini-live-token |

## File List

- `supabase/functions/gemini-live-token/index.ts` — edge fn completa
- `supabase/migrations/20260424002000_bi_voice_token_log.sql` — tabela + índices + RLS + pg_cron cleanup diário

## Resultado

**Commit:** `adef507d`

**AC1-2 (Auth + tenant):** getUser(token) com o Bearer do header; tenant_id de `user.app_metadata.tenant_id`.

**AC3 (Provider key):** `getProviderKey('gemini', supabase)` do `_shared/ai_providers.ts` (BI-VOICE-00). 412 se null.

**AC4 (Google API):** POST `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key={key}` com body `{ uses: 1, expireTime: ISO8601, sessionResumption: { handle: '' } }`. 502 em erro de provider.

**AC5 (Rate limit):** COUNT em `bi_voice_token_log` onde `tenant_id = ? AND issued_at >= now()-1h`. 429 se >= 20. Constante `MAX_TOKENS_PER_HOUR_PER_TENANT = 20` no topo do arquivo para tuning fácil.

**AC6 (TTL):** `TOKEN_TTL_SECONDS = 60` — `expireTime = now()+60s`, `uses: 1`.

**AC7 (Headers):** `X-Gemini-Model: gemini-2.5-flash-native-audio-preview-12-2025`, `X-Token-TTL: 60`.

**AC8 (Audit log):** INSERT em `bi_voice_token_log` fire-and-forget + `console.log(JSON.stringify({...}))` sem API key.

**config.toml:** `verify_jwt = true` é default — sem entrada adicional necessária.

## QA Results
<!-- QA preenche ao revisar -->
