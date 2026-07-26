---
title: "CALL-PRO-01: Implementar word_spotting → AI Agent e mover BI stats para RPC"
type: story
status: done
priority: P2
complexity: M
agent: dev-analyst (lyra)
created: 2026-04-23
updated: 2026-04-23
tags: [story, call-pro, debt, P2, done]
related: ["[[../../project/modules/call-pro]]"]
---

# CALL-PRO-01: Implementar word_spotting → AI Agent e mover BI stats para RPC

## Objetivo
Completar a integração de word_spotting com o AI Agent do Call PRO e mover cálculos de stats de chamadas do client-side para um RPC server-side.

## Acceptance Criteria
- [x] AC1: Word_spotting detectado durante/após chamada armazena palavras-gatilho como tags prefixadas em `call_pro_calls.tags` (prefixo `word:`), disponíveis para BI e CallProCallDetail
- [x] AC2: Stats de chamadas calculados em RPC no Supabase — função `get_call_stats(date_from, date_to)` via migration `20260423017000`
- [x] AC3: `useCallProBIStats` refatorado para chamar RPC — zero lógica de agregação no React, zero fetch de linhas brutas
- [ ] AC4: Word_spotting funciona end-to-end: chamada → transcrição → palavras-gatilho → notificação/evento (validação QA — depende de webhook real)

## Decisões tomadas

**AC1 — word_spotting:** Optou-se por tag-based logging (`word:<termo>`) em vez de chamar `ai-agent-execute` diretamente. Motivo: `ai-agent-execute` é WhatsApp-first (requer buffer de mensagens `people_id`), chamar sem o buffer falharia silenciosamente. Tags ficam disponíveis em `CallProCallDetail` e analytics.

**AC2/AC3 — RPC:** `get_call_stats` usa `security definer` com RLS de `call_pro_calls` e `settings_users`. Retorna JSONB com estrutura exata de `CallBIData` — hook apenas faz cast, sem transformações.

## Arquivos modificados

- `supabase/functions/call-pro-webhook/index.ts` — case `call.word_spotting` implementado (CP-11)
- `supabase/migrations/20260423017000_call_pro_get_call_stats_rpc.sql` — RPC `get_call_stats`
- `src/hooks/useCallProBIStats.ts` — refatorado para `supabase.rpc('get_call_stats', ...)`
- `docs/smart-memory/stories/backlog/CALL-PRO-01.md` → moved to done

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-analyst (lyra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
