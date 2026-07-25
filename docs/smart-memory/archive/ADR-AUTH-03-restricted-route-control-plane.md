---
title: "ADR-AUTH-03: RestrictedRoute requireSuperAdmin exige isControlPlane && super_adm"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, auth, security, authorization, super-admin, control-plane]
related: ["[[ADR-ADM-01-project-per-tenant]]", "[[ADR-AUTH-01-hostname-bootstrap]]"]
---

# ADR-AUTH-03: RestrictedRoute requireSuperAdmin exige isControlPlane && super_adm

## Context

No modelo project-per-tenant, cada tenant tem seu próprio projeto Supabase com tabela `settings_users`. A coluna `super_admin` existe em TODOS os projetos — tanto no control plane quanto nos projetos tenant. Portanto, um gestor de um tenant cliente poderia, teoricamente, setar `super_admin = true` em seu próprio `settings_users` e tentar acessar `/adm`.

`RestrictedRoute requireSuperAdmin` precisa distinguir dois casos:
1. `super_admin = true` no projeto do control plane → super-admin legítimo
2. `super_admin = true` no projeto de um tenant → elevação indevida de privilégio

Opções:
1. **Verificar apenas a flag `super_admin`** — vulnerável: qualquer usuário com acesso admin ao próprio tenant pode se promover.
2. **Checar flag + estar no control plane (via URL do Supabase)** — defesa em profundidade: mesmo que `super_admin = true`, sem estar no project do control plane, o guard bloqueia.
3. **Verificar via chamada ao control plane** — a prova mais robusta, mas adiciona latência e dependência de rede no hot path de routing. Rastreado como AUTH-V2-12 para implementação futura.

## Decision

**`RestrictedRoute requireSuperAdmin` exige ambas as condições:**
1. `user.profile.super_adm === true` (flag no profile carregado)
2. `isControlPlane` — a URL do Supabase atual (lida de `sessionStorage._supabase_client_config.supabase_url`) corresponde à URL do control plane hardcoded (`CONTROL_PLANE_URL`)

```ts
const isControlPlane = config?.supabase_url === CONTROL_PLANE_URL;
if (requireSuperAdmin && (!user.profile.super_adm || !isControlPlane)) {
  return <AccessDenied />;
}
```

Comentário explícito no arquivo:
> "checar só `super_adm` é insuficiente porque essa flag existe em todo tenant Supabase e poderia conceder ADM access a client users que tenham super_adm=true no DB deles"

O check de `isControlPlane` via `sessionStorage` é uma defesa client-side — não substitui validação server-side. Edge functions do control plane validam independentemente que o JWT pertence ao control plane (via `supabase.auth.getUser()` contra o control plane Supabase).

## Consequences

**Positivo:**
- Dupla defesa: mesmo que `super_admin = true` em tenant cliente, o routing guard impede acesso a `/adm`.
- Sem chamada de rede no hot path: `sessionStorage` é síncrono.
- Usuário que tenta acessar `/adm` em domínio tenant vê tela "Acesso restrito" (explícita, não 404), evitando confusão.

**Negativo / trade-offs:**
- **`sessionStorage` é client-writeable** — um atacante sofisticado poderia manipular `_supabase_client_config.supabase_url` no browser para fazer o check de `isControlPlane` passar. Porém, mesmo que passe o routing guard client-side, as edge functions do control plane rejeitarão o JWT do tenant (assinado com secret diferente do control plane). Defense-in-depth funciona.
- **`CONTROL_PLANE_URL` hardcoded**: se a URL do control plane mudar, precisa atualizar em múltiplos lugares (`client.ts`, `RestrictedRoute`, `main.tsx`).
- **Validação server-side não implementada**: AUTH-V2-12 propõe substituir a verificação de `sessionStorage` por fetch ao control plane — mais robusto, mas adiciona latência. Implementação futura.

**Arquivos relevantes:**
- `src/components/auth/RestrictedRoute.tsx` — lógica de guard `requireSuperAdmin`
- `src/integrations/supabase/client.ts` — `CONTROL_PLANE_URL` constante
- `supabase/functions/adm-sync-client/index.ts` — validação server-side de super-admin JWT
