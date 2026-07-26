---
title: "FIX-AUTH-01: Hardening de auth — fallbackProfile, rate limit login, remover stubs legados"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, auth-tenant-bootstrap, debt, P2, security]
related: ["[[../../project/modules/auth-tenant-bootstrap]]"]
---

# FIX-AUTH-01: Hardening de auth — fallbackProfile, rate limit login, remover stubs legados

## Objetivo
Tornar o fallbackProfile menos permissivo, adicionar rate limit no login, e remover vestígios de código legado de tenant (`crm_tenants`, `useTenants`, `useTenantContext` stub).

## Acceptance Criteria
- [ ] AC1: `fallbackProfile` com timeout 2s substituído por comportamento fail-fast ou timeout configurável via env
- [ ] AC2: Rate limit no login implementado (ex: max 5 tentativas / 1 min por IP)
- [ ] AC3: Referências a `crm_tenants`, `useTenants`, `useTenantContext` (stub) removidas do codebase
- [ ] AC4: Nenhuma regressão no fluxo normal de auth (bootstrap hostname → sessionStorage → mount)

## Escopo

**IN:**
- `useSimpleAuth` ou equivalente — revisar lógica de fallbackProfile
- Middleware/hook de rate limit no endpoint de login
- Busca e remoção de referências legadas: `grep -r "crm_tenants\|useTenants\|useTenantContext"`

**OUT:**
- MFA (escopo separado, se priorizado)
- Mudança no sistema de RLS
- Refactor completo do auth

## Contexto Técnico
Auth usa hostname→sessionStorage→mount como bootstrap. `fallbackProfile` tem timeout de 2s e é permissivo demais (pode deixar passar usuário sem perfil válido). Sem rate limit no login (risco de brute force). Código legado de `crm_tenants` e hooks stub ainda presente. Ver `docs/smart-memory/project/modules/auth-tenant-bootstrap.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-architect (zael) |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/auth-hardening |

## File List

## QA Results
