---
title: "FIX-USR-01: Restaurar RLS restritivo em settings_users (CRITICAL)"
type: story
status: done
epic: security
complexity: M
agent: dev-data-engineer
created: 2026-05-07
updated: 2026-05-07
tags: [story, security, rls, auth]
related: ["[[../../../agents/data-engineer/user-schema-audit]]", "[[../../../agents/qa/user-types-verdict]]", "[[../../../decisions/ADR-AUTH-07-fwup17-rls-settings-users]]"]
---

# FIX-USR-01: Restaurar RLS restritivo em settings_users (CRITICAL)

## Objetivo
Fechar a vulnerabilidade de auto-promoção: policies `authenticated_*` com `USING (true)` em `settings_users` permitem que qualquer usuário autenticado execute `UPDATE settings_users SET user_type='admin'` diretamente via anon-key.

## Acceptance Criteria
- [ ] AC1: `UPDATE settings_users SET user_type='admin'` executado por usuário `manager` ou `user` retorna erro de RLS (não executa)
- [ ] AC2: Policy de SELECT em `settings_users` mantém `USING (true)` para leitura (sem regressão na UI)
- [ ] AC3: Policy de UPDATE em `settings_users` restringe `user_type` e `super_admin` — apenas `admin` ou service-role pode alterar
- [ ] AC4: Policy de DELETE em `settings_users` restringe a `admin` ou service-role
- [ ] AC5: Migration numerada corretamente em `supabase/migrations/` e adicionada ao `client-migrations.json`
- [ ] AC6: dev-qa re-aprova item 2.2 e 2.7 do checklist após merge

## Escopo

**IN:**
- Nova migration com policies UPDATE/DELETE restritivas em `settings_users`
- ADR retroativo para FWUP-17 documentando a decisão de reabertura e esta reversão

**OUT:**
- Alteração em outras tabelas
- Mudança na lógica de edge functions

## Contexto Técnico
Migration `20260428060000_fwup17_rls_policies_baseline_repair.sql` abriu intencionalmente para evitar quebra em tenants novos. Toda autorização migrou para edge function layer — mas isso não elimina o risco de acesso direto via anon-key. A fix deve restaurar policies restritivas em writes sem quebrar reads.

Função auxiliar `is_admin_or_manager()` já existe e pode ser usada nas policies.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer |
| Iniciado   | — |
| Concluído  | — |
