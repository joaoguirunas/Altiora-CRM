---
title: "ADR-PP-03: Server-verified tenant_id em edge functions (substituir extractTenantId unsigned)"
status: accepted
date: 2026-04-22
deciders: [dev-architect, dev-dev-beta]
tags: [adr, security, multi-tenant, rls, edge-functions]
related: ["[[ADR-ADM-01-project-per-tenant]]"]
---

# ADR-PP-03: Server-verified tenant_id em edge functions

## Context

Edge functions que precisam saber o `tenant_id` do usuário autenticado para isolar dados têm duas opções:

1. **Decode unsigned do JWT** — ler `app_metadata.tenant_id` diretamente do payload Base64 sem verificar a assinatura. Implementado em `supabase/functions/_shared/response.ts::extractTenantId(req)`.
2. **Server-verified via `supabase.auth.getUser(token)`** — chamar o endpoint de auth do Supabase, que valida a assinatura JWT e retorna `user.app_metadata.tenant_id` como dado confiável.

O risco do decode unsigned: se um atacante conseguir injetar um JWT próprio (assinado com chave diferente ou token expirado) que passe pela camada de parse sem verificação de assinatura, pode forjar `app_metadata.tenant_id` e acessar dados de outro tenant. Em ambiente Supabase standard isso é improvável (JWT secret não vaza), mas a surface de ataque não é zero — especialmente em edge functions com `verify_jwt=false`.

`extractTenantId` foi marcado `@deprecated` com documentação explícita no arquivo:
```ts
/**
 * @deprecated Use `supabase.auth.getUser(token)` then `user.app_metadata.tenant_id`.
 * See ADR-PP-03. This function performs an UNSIGNED JWT decode and is vulnerable
 * to tenant_id forgery. Will be removed after PP-V2-8.
 */
```

## Decision

**Todas as edge functions que necessitam `tenant_id` devem usar `supabase.auth.getUser(token).app_metadata.tenant_id`**, nunca `extractTenantId` unsigned.

Padrão aprovado:
```ts
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) return unauthorized();
const tenantId = user.app_metadata?.tenant_id as string | undefined;
if (!tenantId) return unauthorized();
```

Exceções aceitas:
- Edge functions que usam `SUPABASE_SERVICE_ROLE_KEY` diretamente (ex: `ai-agent-execute`, `omni-delivery-engine`) — operam em nome do sistema, não de um usuário específico; `tenant_id` é resolvido a partir do contexto da operação (ex: `people_id` → lookup no DB).
- Funções públicas sem JWT (ex: `public-booking`, `whatsapp-inbound`) — `tenant_id` é extraído do `service_role` DB context ou de campos confiáveis no payload.

`extractTenantId` permanece no código até auditoria completa confirmar que nenhuma função o usa mais (rastreado em AUTH-V2-01 / PP-V2-8).

## Consequences

**Positivo:**
- Elimina surface de ataque de tenant forgery via JWT unsigned.
- `app_metadata` é server-writeable only no Supabase — clientes não podem modificar via `updateUser()`. Confiável como source of truth para `tenant_id`.
- Alinha com a política de RLS nas tabelas Postgres, que já usa `auth.jwt() -> 'app_metadata' ->> 'tenant_id'` server-side.

**Negativo / trade-offs:**
- `supabase.auth.getUser(token)` adiciona ~50-100ms de latência por chamada (round-trip ao Auth server). Em edge functions chamadas por webhooks de alta frequência (ex: `whatsapp-inbound`), isso é significativo. Mitigação: funções de inbound de alto volume usam service role key + lookup por tenant no DB, evitando a chamada.
- Função `extractTenantId` não pode ser removida até auditoria completa — risco de manter código deprecated no repo por tempo indeterminado.

**Estado de migração (2026-04-22):**
- Principais edge functions de usuário já migradas para `getUser`.
- `extractTenantId` ainda existe como fallback — não deletar até PP-V2-8 completa.
- `whatsapp-outbound`, `instagram-outbound`, `tiktok-outbound`: operam com service role, sem JWT de usuário — não afetados por este ADR.
