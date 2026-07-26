---
title: "ADR-ADM-05: Compensating rollback em adm-create-user / create-tenant-user"
status: accepted
date: 2026-04-23
deciders: [dev-architect]
tags: [adr, adm, control-plane, reliability, edge-functions]
related: ["[[ADR-ADM-01-project-per-tenant]]", "[[ADR-ADM-02-secrets-encryption]]"]
---

# ADR-ADM-05: Compensating rollback em adm-create-user / create-tenant-user

## Context

A criação de usuários no tenant (control plane → tenant) é um fluxo de duas etapas distribuídas:

1. `POST {tenant}/auth/v1/admin/users` — cria registro em `auth.users` no tenant.
2. `POST {tenant}/rest/v1/settings_users` — cria perfil correspondente em `settings_users`.

As duas etapas vivem em projetos Supabase diferentes (control plane e tenant) e **não há transação distribuída**. Se a etapa 2 falhar (rede, RLS, validação no DB do tenant), o registro em `auth.users` permanece — gerando um **órfão**: o usuário consegue logar mas não tem perfil, caindo no `fallbackProfile` de `useSimpleAuthSingleTenant` (`user_type: 'atendente'`, `super_adm: false`). Pior: pode bloquear retry porque o email já estará cadastrado no `auth.users`.

Opções consideradas:

1. **Aceitar órfão e remediar via cron** — varredura periódica `auth.users` sem `settings_users` correspondente. Custo operacional alto, latência de remediação ruim, super-admin precisa lidar com inconsistência intermediária.
2. **Mover toda lógica para um RPC no tenant** — single round-trip, atômico no tenant. Problema: o tenant não consegue chamar Auth Admin API por si só de dentro do Postgres sem `pg_net` + service role armazenada (anti-padrão).
3. **Rollback compensador (saga pattern)** — se a etapa 2 falhar, deletar o auth user via `DELETE /auth/v1/admin/users/{id}`. Best-effort no rollback, mas garante o caso comum.
4. **Idempotência via upsert** — exigiria que o handler do auth user fosse idempotente (lookup-or-create). Possível mas exige varrer `listUsers` em paginação (ver `create-global-user`), com custo O(n) por chamada.

## Decision

**Adotar rollback compensador (saga)** em `adm-create-user` e `create-tenant-user`:

- Após `POST /auth/v1/admin/users` com sucesso, capturamos o `userId` retornado.
- Chamamos `POST /rest/v1/settings_users` em try/catch.
- Em qualquer falha (network exception OU `!profileRes.ok`), invocamos `deleteAuthUser(client.supabase_url, serviceRoleKey, userId)` — `DELETE /auth/v1/admin/users/{id}`.
- A resposta ao caller indica explicitamente que o auth user foi revertido: `"auth user revertido"` no `error`.

A função `deleteAuthUser` é best-effort: se o DELETE falhar, logamos via `console.error`, mas não escalamos para o caller — o erro original é mais informativo. Em caso de DELETE ter falhado, fica órfão, mas o caso primário (rede instável OU validação RLS rejeitando) é coberto pela primeira chamada de DELETE no caminho feliz de rollback.

Validação prévia adicionada para reduzir falhas:
- email válido por regex.
- password min 8 chars.

Audit log permanece best-effort no fim do fluxo bem-sucedido — não compõe a saga.

## Consequences

**Positivo:**
- Auth users órfãos no tenant após falha de step 2 caem para próximo de zero (modulo falha simultânea de delete).
- Mensagem clara ao operador: "auth user revertido" — não fica em dúvida sobre estado.
- Sem cron de limpeza necessário.
- Mesmo padrão aplicado nas duas funções (`adm-create-user`, `create-tenant-user`) — comportamento consistente.

**Negativo / trade-offs:**
- Best-effort: se o DELETE rollback também falhar (rede caiu de vez, tenant inacessível), volta a ter órfão. Cobrir esse caso exige cron + reconciliação — fora de escopo dessa story; documentado em débito futuro.
- Não há transação real — entre POST e DELETE há janela onde o auth user existe brevemente (ms). Aceitável: webhooks de auth disparam só após o auth user ser commitado, e ninguém consegue logar antes do password ser setado e cliente abrir browser.
- `create-global-user` (control plane interno) **não foi tocado** nesta story — tem lógica diferente (lookup-or-create via `listUsers`). Tratado como débito separado.

**Próximos passos / não cobertos:**
- Cron de reconciliação `auth.users` ↔ `settings_users` para detectar órfãos residuais (resíduo após DELETE rollback ter falhado).
- Considerar mover `create-global-user` para o mesmo padrão saga (atualmente confia em fallback de listagem).

**Arquivos relevantes:**
- `supabase/functions/adm-create-user/index.ts` — saga implementada
- `supabase/functions/create-tenant-user/index.ts` — saga implementada
- `src/hooks/useAdmClients.ts` — `makeHint()` reduzido de 12 → 4 chars (ver ADR-ADM-02 para racional do hint)
- `supabase/migrations_adm/20260423011000_adm_hint_truncate.sql` — limpeza dos hints existentes
