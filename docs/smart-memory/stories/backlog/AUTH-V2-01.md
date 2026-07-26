---
title: "AUTH-V2-01: Substituir extractTenantId unsigned por supabase.auth.getUser"
type: story
status: backlog
epic: auth-v2
complexity: M
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-04-22
tags: [story, auth, security, rls, P1]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-PP-03-server-verified-tenant-id]]"]
---

# AUTH-V2-01: Substituir extractTenantId unsigned por supabase.auth.getUser

## Objetivo
Eliminar a função `extractTenantId(req)` que faz decode unsigned do JWT (vulnerável a forgery) substituindo todos os usos por `supabase.auth.getUser(token).app_metadata.tenant_id`.

## Acceptance Criteria
- [ ] AC1: Auditoria completa — `grep -r "extractTenantId"` retorna 0 resultados em `supabase/functions/` após a story
- [ ] AC2: Cada edge function que antes chamava `extractTenantId` agora chama `const { data: { user } } = await supabase.auth.getUser(token)` e lê `user.app_metadata.tenant_id` — retorna 401 se `user` é null
- [ ] AC3: A função `extractTenantId` em `supabase/functions/_shared/response.ts` é deletada (não apenas @deprecated)
- [ ] AC4: Nenhuma edge function regride em cobertura — todas as que autenticavam continuam autenticando via JWT Bearer no Authorization header
- [ ] AC5: Testes manuais confirmam que request com JWT adulterado (tenant_id no payload, mas `app_metadata` diferente) retorna 401 — não 200 com tenant errado

## Escopo

**IN:**
- Auditoria de todas as edge functions em `supabase/functions/`
- Substituição de `extractTenantId` por `supabase.auth.getUser(token)` em cada fn
- Deleção de `extractTenantId` de `_shared/response.ts`
- Deleção de import/re-export em qualquer `_shared/index.ts` se existir

**OUT:**
- Mudança nas RLS policies (já usam `app_metadata.tenant_id` — não afetadas)
- Alteração no payload do JWT (emitido pelo Supabase Auth, não modificável aqui)
- Edge functions que usam `service_role` e não verificam JWT de usuário (ex: cron jobs)

## Contexto Técnico
`extractTenantId` em `supabase/functions/_shared/response.ts` usa `jose` ou decode manual de JWT sem verificar assinatura — lê `app_metadata.tenant_id` do payload mas qualquer atacante com acesso ao anon key pode montar um JWT com `tenant_id` arbitrário e não seria detectado. ADR-PP-03 (já criado) documenta a decisão. Referência do deep-dive: `supabase/functions/_shared/response.ts` tem o comentário `@deprecated` e `Will be removed after PP-V2-8`. A story PP-V2-8 está done — esta story finaliza o cleanup.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/auth-remove-extracttenantid |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
