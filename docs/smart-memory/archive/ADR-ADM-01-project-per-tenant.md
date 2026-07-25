---
title: "ADR-ADM-01: Modelo project-per-tenant com control plane centralizado"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, multi-tenant, architecture, control-plane, adm]
related: ["[[ADR-ADM-02-secrets-encryption]]", "[[ADR-AUTH-01-hostname-bootstrap]]"]
---

# ADR-ADM-01: Modelo project-per-tenant com control plane centralizado

## Context

O rev-os é um SaaS multi-tenant. A decisão fundamental de arquitetura é como isolar dados e operações entre tenants. As principais alternativas:

1. **Schema-per-tenant em projeto único** — um projeto Supabase, cada tenant em schema separado (`tenant_X.leads`, etc.). Isolamento por schema, sem custo adicional por tenant.
2. **Row-level isolation em projeto único** — todos os tenants na mesma DB, isolamento via RLS por `tenant_id`. Simples, escala bem até certos limites, mas vazamento de RLS expõe dados de outros tenants.
3. **Project-per-tenant** — cada tenant tem seu próprio projeto Supabase (DB dedicado, auth dedicado, edge functions). Isolamento máximo por construção (impossível vazar via RLS porque tenants não compartilham DB). Custo adicional por Supabase project.

O modelo legado usava row-level isolation com `crm_tenants` table e `user_has_tenant_access` RLS policies. Com crescimento de tenants e exigências de conformidade (dados completamente isolados), migrou-se para project-per-tenant.

Um **control plane** centralizado (`ohzwetkaazgxafubzvop.supabase.co`) mantém o catálogo de tenants (`adm_clients`) e é responsável por provisioning, sync de schema, e health monitoring. O SPA descobre qual projeto usar via bootstrap dinâmico por hostname.

## Decision

**Adotar modelo project-per-tenant** com control plane centralizado.

- Cada cliente = 1 projeto Supabase separado (`supabase_url`, `anon_key`, `service_role_key`, `db_password` únicos por tenant).
- Control plane em `adm_clients`: catálogo de tenants com secrets cifrados via pgcrypto.
- Bootstrap do SPA: `main.tsx` chama `adm-client-config` edge function antes de importar `App` — resolve `{supabase_url, anon_key}` a partir do hostname.
- Deploy de schema via `adm-sync-client`: replica `supabase/migrations/` para cada project tenant via conexão Postgres direta (porta 5432). Edge functions deployadas via Supabase Management API.
- Super-admins operam o control plane via `/adm` — isolado por `RestrictedRoute requireSuperAdmin` + check de `isControlPlane` (não apenas flag `super_admin` no DB).

## Consequences

**Positivo:**
- Isolamento máximo: vazamento de RLS em um tenant não afeta outros. Nenhuma query pode cruzar DB boundary.
- Compliance: dados de cada cliente em DB separado facilita auditorias, LGPD, e potencialmente GDPR (dados residem em região específica se o projeto Supabase for criado em data center escolhido).
- Blast radius de bugs de RLS: afeta apenas um tenant, não todos.
- Permite custom domains por tenant (`adm_clients.custom_domain`).

**Negativo / trade-offs:**
- Custo Supabase: um projeto por cliente → custo escala com número de tenants.
- Complexidade de deploy: migrations precisam ser replicadas para cada tenant via `adm-sync-client`. Falha de sync em um tenant não afeta outros, mas requer monitoramento.
- Sem queries cross-tenant: analytics ou relatórios que exigem dados de múltiplos tenants precisam ser construídos em nível de control plane (ex: agregações manuais).
- Bootstrapping lento se `adm-client-config` estiver down: app não sabe qual DB usar. Mitigação: cache 5min em `sessionStorage`.
- Legado: vestígios do modelo row-level (`crm_tenants`, `user_has_tenant_access`, `TenantContext` stub) permanecem no codebase durante migração faseada.

**Arquivos relevantes:**
- `src/main.tsx` — `bootstrapClientConfig()`
- `supabase/functions/adm-client-config/index.ts` — tenant resolver
- `supabase/functions/adm-sync-client/index.ts` — replica migrations
- `src/hooks/useAdmClients.ts` — hooks do control plane
- `supabase/migrations_adm/` — migrations exclusivas do control plane
