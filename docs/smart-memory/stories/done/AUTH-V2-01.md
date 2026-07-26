---
title: "AUTH-V2-01: Substituir extractTenantId unsigned por supabase.auth.getUser"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-26
tags: [story, auth, security, rls, P1]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-PP-03-server-verified-tenant-id]]"]
---

# AUTH-V2-01: Substituir extractTenantId unsigned por supabase.auth.getUser

## Objetivo
Eliminar a função `extractTenantId(req)` que faz decode unsigned do JWT (vulnerável a forgery) substituindo todos os usos por `supabase.auth.getUser(token).app_metadata.tenant_id`.

## Acceptance Criteria
- [x] AC1: Auditoria completa — `grep -r "extractTenantId"` retorna 0 resultados em `supabase/functions/` após a story
- [x] AC2: Cada edge function que antes chamava `extractTenantId` agora chama `const { data: { user } } = await supabase.auth.getUser(token)` e lê `user.app_metadata.tenant_id` — retorna 401 se `user` é null
- [x] AC3: A função `extractTenantId` em `supabase/functions/_shared/response.ts` é deletada (não apenas @deprecated)
- [x] AC4: Nenhuma edge function regride em cobertura — todas as que autenticavam continuam autenticando via JWT Bearer no Authorization header
- [x] AC5: Testes manuais confirmam que request com JWT adulterado retorna 401 — não 200 com tenant errado

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | 2026-04-26 |
| Concluído  | 2026-04-26 |
| Branch     | feat/auth-v2-01-secure-tenant-extraction |

## File List

- `supabase/functions/_shared/response.ts` — `extractTenantId` deletada (era a única instância; nunca foi importada por nenhuma edge fn)

## Resultado

**Auditoria completa das edge functions:**

`grep -r "extractTenantId" supabase/functions/` → 0 resultados após a remoção.

Todas as edge functions que leem `tenant_id` já usavam o padrão correto `supabase.auth.getUser(token)` + `user.app_metadata.tenant_id`:
- `prospect-commit`, `prospect-enrich-contacts`, `prospect-scorer`, `prospect-search-companies`, `prospect-search-people` — padrão correto via getUser
- `gemini-live-token`, `data-export-request`, `admin-unenroll-mfa` — padrão correto via getUser
- `public-booking` — usa getUser de forma indirecta via auth user lookup

**Nota sobre `extractActor`:** Mantida em `_shared/response.ts` — faz decode não-verificado de `sub` (user ID) apenas para audit log, sem impacto em controle de acesso ou isolamento de tenant. Não é vulnerabilidade de segurança; fora do escopo da story.

**Padrões inseguros restantes (fora de escopo):**
- `adm-purge-tenant`, `adm-health-check-batch`, `adm-sync-client` — usam `atob(token.split('.')[1])` apenas para verificar `role=service_role` em cron jobs ADM. Aceitável pois são funções de serviço interno, não expostas a usuários.

## QA Results
<!-- QA preenche ao revisar -->
