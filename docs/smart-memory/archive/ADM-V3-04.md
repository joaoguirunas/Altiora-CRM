---
title: "ADM-V3-04: Cache server-side em adm-client-config"
type: story
status: backlog
epic: adm-v3
complexity: M
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, adm, control-plane, performance, P3]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-AUTH-01-hostname-bootstrap]]"]
---

# ADM-V3-04: Cache server-side em adm-client-config

## Objetivo
Reduzir a carga no control plane DB durante bursts de tráfego (ex: múltiplos usuários do mesmo tenant recarregando o app) adicionando cache server-side na edge function `adm-client-config` via Supabase KV ou materialized approach.

## Acceptance Criteria
- [ ] AC1: `adm-client-config` usa `Deno.KV` (Deno Deploy KV disponível em Supabase Edge Functions) para cachear resultado por `host` com TTL de 5 minutos — mesmo TTL do cache client-side em `sessionStorage`
- [ ] AC2: Cache miss ou TTL expirado → SELECT em `adm_clients` (comportamento atual) → resultado salvo no KV antes de retornar
- [ ] AC3: Cache invalidado quando `adm_clients` é atualizado — trigger Postgres `adm_clients_cache_invalidate` insere em tabela `adm_cache_invalidations(host, invalidated_at)` que é consumida por job de limpeza, OU `useUpdateAdmClient` chama endpoint `adm-client-config?action=purge&host={slug}.revos.growthsales.ai` para forçar purge
- [ ] AC4: Métricas: header `X-Cache: HIT|MISS` na resposta — monitorável via Supabase Function logs
- [ ] AC5: Fallback graceful: se Deno KV não disponível (erro de acesso), a edge fn ignora o cache e serve direto do DB — sem 500

## Escopo

**IN:**
- Modificação de `supabase/functions/adm-client-config/index.ts` com lógica de Deno KV
- Endpoint de purge (query param `action=purge`) com validação de `Authorization: Bearer {service_role}`
- Hook `useUpdateAdmClient` chama purge após atualização bem-sucedida (fire-and-forget)

**OUT:**
- Redis/Upstash (requer billing externo — Deno KV é nativo)
- Cache de `enabled_modules` separado do resto (payload completo é cacheado)
- Cache para as outras edge functions

## Contexto Técnico
Deep-dive §9 débito #5: "`adm-client-config` sem cache server-side — cada bootstrap de SPA hits o DB. SPA cacheia 5min em `sessionStorage`, mas burst de tráfego pode pressionar." `Deno.openKv()` está disponível em Supabase Edge Functions (runtime Deno Deploy). Key: `['adm-client-config', host]`; valor: o JSON de resposta; `expireIn: 5 * 60 * 1000` (ms). Para o purge: `useUpdateAdmClient` em `src/hooks/useAdmClients.ts` já tem hook de mutation — adicionar `onSuccess` que chama `invokeControlPlane('adm-client-config', { action: 'purge', host: slug + '.revos.growthsales.ai' })`. O `custom_domain` também pode precisar de purge — passar ambos se existirem.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/adm-client-config-cache |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
