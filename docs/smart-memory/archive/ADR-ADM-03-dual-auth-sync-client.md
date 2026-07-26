---
title: "ADR-ADM-03: Auth dual em adm-sync-client (super-admin JWT vs service_role key)"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, security, adm, edge-functions, authentication, github-actions]
related: ["[[ADR-ADM-01-project-per-tenant]]", "[[ADR-ADM-04-batch-vs-incremental-sync]]"]
---

# ADR-ADM-03: Auth dual em adm-sync-client

## Context

`adm-sync-client` precisa ser invocável de dois contextos distintos:

1. **UI do super-admin** (`/adm` → "Sync agora" button) — o operador está logado com JWT de super-admin. O cliente Supabase do browser envia `Authorization: Bearer <user_jwt>`.
2. **CI/CD (GitHub Actions)** — `scripts/sync-clients.js` roda em runner headless. Não há sessão de usuário; o script usa a `service_role_key` do control plane como token de autenticação.

Opções:
1. **Apenas JWT de super-admin** — bloqueia uso em CI/CD automatizado. Requer login manual ou criação de service account no Supabase Auth (não suportado nativamente).
2. **Apenas service_role key** — elimina verificação de identidade do operador humano; qualquer posse da key dá acesso total.
3. **Auth dual** — aceitar ambos, com lógica de detecção: se token === service_role_key do env, autenticar como sistema; se token começa com `eyJ` (JWT), verificar como user JWT.

## Decision

**Implementar auth dual em `adm-sync-client`** com detecção por formato do token:

```ts
let isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!isServiceRole && token.startsWith('eyJ')) {
  // Decode JWT → checar role === 'service_role' (token signed pelo Supabase)
  // OU fallback: super-admin user JWT check via supabase.auth.getUser()
}
if (!isServiceRole) { return 401; }
```

O token `service_role` do Supabase também começa com `eyJ` (é um JWT assinado pelo Supabase com `role: service_role`) — a verificação de format é apenas um gate inicial; a validação real é contra o env var ou via `auth.getUser()`.

GitHub Actions armazena a `service_role_key` do control plane como secret (`SUPABASE_SERVICE_ROLE_KEY` no repositório), não como credencial de usuário. `scripts/sync-clients.js` passa essa key como `Authorization: Bearer`.

## Consequences

**Positivo:**
- CI/CD totalmente automatizado sem contas de serviço artificiais.
- Super-admins podem acionar sync manual via UI sem configuração adicional.
- Separação clara: secrets em GitHub → pipeline; JWT → operadores humanos.

**Negativo / trade-offs:**
- `service_role_key` armazenada em GitHub Secrets — se vazada, permite sync em qualquer tenant. Mitigação: a key só permite invocar `adm-sync-client`; para comprometer dados de tenants, ainda seria necessário a `service_role_key` de cada tenant individualmente (cifradas em `adm_clients`).
- Audit log de sync iniciado via CI/CD não tem `actor_id` de usuário — registrado como sistema. Reduz rastreabilidade de quem acionou o job específico.
- Lógica de auth no próprio código da edge function — não usa `verify_jwt=true` (que delegaria ao Supabase). Requer manutenção cuidadosa se o formato de JWT mudar.

**Arquivos relevantes:**
- `supabase/functions/adm-sync-client/index.ts` — lógica de auth dual
- `scripts/sync-clients.js` — chamada via HTTP com service_role key
- `.github/workflows/sync-clients.yml` — CI/CD pipeline
