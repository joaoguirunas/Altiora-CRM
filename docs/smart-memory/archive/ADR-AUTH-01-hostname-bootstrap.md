---
title: "ADR-AUTH-01: Bootstrap dinâmico de tenant por hostname com cache sessionStorage"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, auth, tenant, bootstrap, multi-tenant, performance]
related: ["[[ADR-ADM-01-project-per-tenant]]", "[[ADR-AUTH-02-fallback-profile]]"]
---

# ADR-AUTH-01: Bootstrap dinâmico de tenant por hostname com cache sessionStorage

## Context

Com o modelo project-per-tenant (ADR-ADM-01), o SPA precisa saber qual `supabase_url` e `anon_key` usar antes de montar qualquer componente React. O problema: `src/integrations/supabase/client.ts` é importado de forma síncrona por toda a aplicação — não pode ser lazy-loaded ou usar Promises.

Opções para resolver o `{url, key}` correto:
1. **Build-time por tenant** — compilar um bundle diferente por cliente com as variáveis hardcoded. Impraticável: N tenants = N deploys.
2. **Runtime env var no servidor** — funciona para SSR, mas o rev-os é uma SPA estática no Vercel (sem servidor).
3. **Lookup síncrono no `client.ts`** — ler `sessionStorage` de forma síncrona antes de chamar `createClient()`. Funciona se o valor já estiver em sessionStorage.
4. **Bootstrap assíncrono antes de importar `App`** — `main.tsx` faz `await` de um fetch ao control plane, salva em `sessionStorage`, depois importa `App` dinamicamente. `client.ts` então lê sessão de forma síncrona.

## Decision

**Bootstrap assíncrono em `main.tsx` antes de `await import('./App')`**, com cache em `sessionStorage` por 5 minutos.

Fluxo:
1. `main.tsx` detecta hostname.
2. Se hostname pertence a domínios "main" (`localhost`, `revos.growthsales.ai`, `app.*`, `www.*`) → remove cache de `sessionStorage`; `client.ts` usa o fallback hardcoded do control plane.
3. Se subdomain ou custom domain cliente:
   - Verifica `sessionStorage._supabase_client_config` (cache hit com `host` match e `_cached_at < 5min`).
   - Cache miss / stale: `POST adm-client-config { host }` → salva `{client_id, supabase_url, anon_key, enabled_modules, _cached_at}` no `sessionStorage`.
4. `await import('./App')` — DEPOIS do bootstrap.
5. `client.ts` lê `sessionStorage._supabase_client_config` de forma síncrona ao importar e cria o `SupabaseClient` correto.

A **ordem é crítica**: a dynamic import de `App` deve ocorrer APÓS o `await` do bootstrap. Inverter a ordem faz `client.ts` ser executado antes da sessão estar populada, criando um client contra o control plane para todos os tenants.

Cache de 5min balanceia latência (não bater control plane em cada page reload) e staleness (mudanças de `enabled_modules` pelo ADM refletem em até 5min). `useSystemModules` complementa com live query a cada 30s para `enabled_modules` em tenants clientes.

## Consequences

**Positivo:**
- Zero runtime cost para reloads dentro de 5min (cache hit).
- SPA estática: funciona em Vercel sem servidor ou edge runtime configurado.
- Fallback graceful: se `adm-client-config` retornar 404, app boota contra control plane (login falhará para usuários tenant, mas página renderiza sem crash).
- Custom domains: `cname.empresa.com.br` → lookup via `adm_clients.custom_domain`.

**Negativo / trade-offs:**
- `sessionStorage` é por aba: nova aba = nova chamada ao control plane (cache não persiste entre abas). Aceitável — sem sessão compartilhada entre abas.
- `sessionStorage` dura apenas enquanto a aba está aberta. Reload reusa o cache (5min). Fechar a aba limpa o cache — próximo acesso bate o control plane.
- **Fallback silencioso**: `adm-client-config` error de rede → app sobe em modo control plane sem aviso visível. Usuário verá "credenciais inválidas" ao tentar logar. Mitigação: adicionar tela de erro de bootstrap (débito rastreado em AUTH-V2 stories).
- **`CONTROL_PLANE_URL` hardcoded** em `client.ts` — mudança exige redeploy.

**Arquivos relevantes:**
- `src/main.tsx` — `bootstrapClientConfig()` + `vite:preloadError` listener
- `src/integrations/supabase/client.ts` — leitura síncrona de `sessionStorage` + `createClient()`
- `supabase/functions/adm-client-config/index.ts` — resolver de tenant
- `src/hooks/useSystemModules.ts` — live query de `enabled_modules`
