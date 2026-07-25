---
title: "ADR-STUBS-01: Criar arquivos ADR faltantes (SP-02, PP-03, ADM-01→04, AUTH-01→04)"
type: story
status: done
priority: P2
complexity: M
agent: dev-ux
created: 2026-04-23
updated: 2026-04-22
tags: [story, adr, docs, P2]
related: ["[[../../decisions/ADR-SP-01-capability-tokens-public-booking]]"]
---

# ADR-STUBS-01: Criar arquivos ADR faltantes (SP-02, PP-03, ADM-01→04, AUTH-01→04)

## Objetivo
Criar os arquivos ADR para todas as 9 decisões arquiteturais identificadas durante o bootstrap.

## Acceptance Criteria
- [x] AC1: `docs/smart-memory/decisions/ADR-SP-02-edge-action-authentication.md` criado
- [x] AC2: `docs/smart-memory/decisions/ADR-PP-03-server-verified-tenant-id.md` criado
- [x] AC3: ADRs ADM-01 a ADM-04 criados
- [x] AC4: ADRs AUTH-01 a AUTH-04 criados
- [x] AC5: Todos os ADRs indexados em `docs/smart-memory/INDEX.md` seção "Decisões Arquiteturais"

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## ADRs criados

| Arquivo | Título | Fonte de contexto |
|---|---|---|
| `ADR-SP-02-edge-action-authentication.md` | Action tokens HMAC uso único em public-booking | schedule-pro.md §5, §7.1 |
| `ADR-PP-03-server-verified-tenant-id.md` | Server-verified tenant_id (substituir extractTenantId) | auth-tenant-bootstrap.md §6 |
| `ADR-ADM-01-project-per-tenant.md` | Modelo project-per-tenant + control plane | adm-control-plane.md §1, §10 |
| `ADR-ADM-02-secrets-encryption.md` | Cifragem pgcrypto com context salt | adm-control-plane.md §4, §6 |
| `ADR-ADM-03-dual-auth-sync-client.md` | Auth dual em adm-sync-client | adm-control-plane.md §5, §7.3 |
| `ADR-ADM-04-batch-vs-incremental-sync.md` | Batch vs incremental sync de migrations | adm-control-plane.md §5, §7.2 |
| `ADR-AUTH-01-hostname-bootstrap.md` | Bootstrap dinâmico por hostname + sessionStorage cache | auth-tenant-bootstrap.md §7.1 |
| `ADR-AUTH-02-fallback-profile-timeout.md` | fallbackProfile timeout 2s | auth-tenant-bootstrap.md §4, §7.2 |
| `ADR-AUTH-03-restricted-route-control-plane.md` | requireSuperAdmin = isControlPlane && super_adm | auth-tenant-bootstrap.md §6 |
| `ADR-AUTH-04-auth-hooks-granularity.md` | useAuth vs useCurrentUser vs useUserPermissions | auth-tenant-bootstrap.md §4, §10 |

## File List

- `docs/smart-memory/decisions/ADR-SP-02-edge-action-authentication.md`
- `docs/smart-memory/decisions/ADR-PP-03-server-verified-tenant-id.md`
- `docs/smart-memory/decisions/ADR-ADM-01-project-per-tenant.md`
- `docs/smart-memory/decisions/ADR-ADM-02-secrets-encryption.md`
- `docs/smart-memory/decisions/ADR-ADM-03-dual-auth-sync-client.md`
- `docs/smart-memory/decisions/ADR-ADM-04-batch-vs-incremental-sync.md`
- `docs/smart-memory/decisions/ADR-AUTH-01-hostname-bootstrap.md`
- `docs/smart-memory/decisions/ADR-AUTH-02-fallback-profile-timeout.md`
- `docs/smart-memory/decisions/ADR-AUTH-03-restricted-route-control-plane.md`
- `docs/smart-memory/decisions/ADR-AUTH-04-auth-hooks-granularity.md`
- `docs/smart-memory/INDEX.md` — seção "Decisões Arquiteturais" atualizada
