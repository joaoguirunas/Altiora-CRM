---
title: "ADR-SP-02: Action Tokens HMAC para autenticação edge↔edge em public-booking"
status: accepted
date: 2026-04-22
deciders: [dev-dev-beta, dev-architect]
tags: [adr, security, schedule-pro, edge-functions, tokens]
related: ["[[ADR-SP-01-capability-tokens-public-booking]]"]
---

# ADR-SP-02: Action Tokens HMAC para autenticação edge↔edge em public-booking

## Context

A edge function `public-booking` opera com `verify_jwt=false` — ela é chamada por leads não autenticados no fluxo de booking público (`/agendar/:leadId`). Internamente, ela precisa acionar sub-ações privilegiadas (sincronização com Google Calendar, envio de template WhatsApp de confirmação) após o lead confirmar um slot.

O problema: qualquer agente poderia chamar `public-booking?action=gcal_sync&meeting_id=X` para qualquer `meeting_id`, obtendo sincronização forçada de calendário ou envio de mensagens para outros leads. Não há JWT de usuário para verificar, nem IP fixo para allowlist (SPA roda no browser do lead).

Alternativas consideradas:
1. **Sem autenticação** — aceitável se as ações fossem idempotentes e sem efeito colateral, mas `gcal_sync` atualiza o evento no Google Calendar e `wa_confirm` envia mensagem real ao lead, tornando replay/IDOR um problema real.
2. **Rate limit por IP** — insuficiente; um atacante com muitos IPs pode varrer `meeting_id`s.
3. **Session cookie do booking** — requer state server-side e não funciona com edge function stateless.
4. **Action tokens HMAC de curta duração com uso único** — garante que o token foi emitido pelo servidor para aquele `meeting_id` específico, pode ser consumido apenas uma vez, e expira em 60s.

## Decision

Implementar **action tokens HMAC com garantia de uso único** via `issueActionToken` / `consumeActionToken` em `supabase/functions/_shared/capability/`.

Fluxo:
1. Após `book_meeting` RPC confirmar o agendamento, o cliente chama `POST public-booking {action:"issue_tokens", meeting_id}`.
2. `public-booking` verifica que `meeting.created_at > now() - 5min` (anti-IDOR para meetings antigos).
3. `issueActionToken` gera um JWT assinado com `SUPABASE_SERVICE_ROLE_KEY` (HMAC-SHA256) contendo `{action, resource_id: meeting_id, jti: uuid, exp: now+60s, tid: tenant_id}`.
4. Retorna dois tokens: `gcal_sync_token` e `wa_confirm_token`.
5. O cliente usa cada token numa chamada separada (`gcal_sync`, `wa_confirm`).
6. `consumeActionToken` valida assinatura + expiração + `action` match + `resource_id` match, depois faz `INSERT INTO action_token_consumed (jti) ON CONFLICT DO NOTHING RETURNING jti`. Se `RETURNING` vazio → token já consumido → 401.

A tabela `action_token_consumed` é `service_role only` — somente edge functions com `SUPABASE_SERVICE_ROLE_KEY` podem gravar. Um cron GC limpa tokens expirados periodicamente.

## Consequences

**Positivo:**
- Uso único garantido atomicamente via INSERT ON CONFLICT — sem race condition mesmo com requisições paralelas.
- Token expira em 60s — janela mínima de exploração mesmo se interceptado.
- Sem state server-side adicional além da tabela `action_token_consumed` (append-only, GC automático).
- Padrão reutilizável: outros fluxos públicos (ex: cancelamento público, reagendamento) podem usar o mesmo helper.

**Negativo / trade-offs:**
- Se `gcal_sync` falhar após o token ser consumido, o cliente não pode re-tentar com o mesmo token — precisa chamar `issue_tokens` novamente (meeting já foi criado, `5min guard` pode bloquear re-emissão se passou tempo suficiente). Mitigação: client tenta re-emissão e o guard de 5min só aplica para `issue_tokens`.
- `tenant_id` no payload do token usa `user_id` do meeting como `tid` por bug (linha 108 `public-booking`). Não afeta segurança (validação é por `resource_id`), mas semânticamente incorreto. Fix rastreado em story backlog.
- Rate limit de `public-booking` é in-memory — reinicia em cold start. Não é rate limit distribuído, mas efetivo na prática (30/min/IP por instância quente).

**Arquivos relevantes:**
- `supabase/functions/_shared/capability/` — `issueActionToken`, `consumeActionToken`
- `supabase/functions/public-booking/index.ts` — uso dos helpers
- `supabase/migrations/20260422001100_capability_token_tables.sql` — `action_token_consumed`
- `supabase/migrations/20260422001400_capability_token_gc_cron.sql` — GC cron
