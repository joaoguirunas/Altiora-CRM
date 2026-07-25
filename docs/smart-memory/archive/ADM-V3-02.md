---
title: "ADM-V3-02: Rollback em adm-create-user — transação compensatória"
type: story
status: backlog
epic: adm-v3
complexity: M
agent: dev-data-engineer
created: 2026-04-22
updated: 2026-04-22
tags: [story, adm, control-plane, security, reliability, P1]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-ADM-01-project-per-tenant]]"]
---

# ADM-V3-02: Rollback em adm-create-user — transação compensatória

## Objetivo
Eliminar o risco de usuários órfãos no `auth.users` do tenant quando o INSERT em `settings_users` falha durante `adm-create-user`, implementando rollback compensatório via delete do auth user.

## Acceptance Criteria
- [ ] AC1: Se o INSERT em `settings_users` falhar (step 6 do fluxo), `adm-create-user` chama `DELETE /auth/v1/admin/users/{userId}` com o `service_role_key` do tenant antes de retornar erro — sem usuário órfão no `auth.users`
- [ ] AC2: Se o DELETE de rollback também falhar, a edge function retorna HTTP 500 com `{ error: 'PARTIAL_CREATE', auth_user_id, message }` — payload que permite ao super-admin remediar manualmente via Supabase Dashboard
- [ ] AC3: Audit log registra evento `user.create_rollback` com `{ auth_user_id, rollback_success: boolean, reason }` — independente do resultado do rollback
- [ ] AC4: UI em `AdmCreateUserModal` exibe erro claro quando recebe `PARTIAL_CREATE`: "Usuário criado no Auth mas perfil falhou. ID para remover manualmente: {auth_user_id}" com botão de copiar
- [ ] AC5: Testes manuais confirmam: falha simulada no INSERT `settings_users` → auth user deletado → resposta 500 com detalhes → nenhum usuário órfão no tenant

## Escopo

**IN:**
- Modificação de `supabase/functions/adm-create-user/index.ts` — adicionar try/catch com rollback compensatório após step 6
- Resposta de erro estruturada `PARTIAL_CREATE` com `auth_user_id`
- Audit log do evento de rollback
- Atualização de `AdmCreateUserModal.tsx` para tratar `PARTIAL_CREATE`

**OUT:**
- Transação distribuída real (impossível entre dois Supabase projects distintos)
- Rollback do audit log do `user.created` (log do tentativa permanece para auditoria)
- Retry automático de criação (pode criar duplicatas — não fazer sem idempotência via email unique check)

## Contexto Técnico
Deep-dive §5 (adm-create-user fluxo, item "Atenção"): "se step 6 falhar, há órfão no `auth.users` do tenant. Não há rollback — débito conhecido." E deep-dive §9 débito #2. O rollback é `DELETE /auth/v1/admin/users/{userId}` — mesmo endpoint da Admin API Supabase usada em `adm-create-user`. O `service_role_key` já foi decifrado no step 3 do fluxo original — disponível na closure. Padrão compensatório: não é transação ACID; é "se B falhou, desfazer A". Semântica de `PARTIAL_CREATE` deve ser documentada no comentário da edge fn para futura manutenção.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | fix/adm-create-user-rollback |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
