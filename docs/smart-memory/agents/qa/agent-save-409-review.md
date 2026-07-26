---
title: QA Review — Fix erro 409/23503 em save_agent_complete
type: qa-review
agent: dev-qa
date: 2026-05-01
verdict: CONCERNS
related: ["[[results]]", "[[../../tasks/ora-fix-agent-save-409]]"]
tags: [qa, gate, save_agent_complete, ai_agents_history, fk-violation, ora]
---

# QA Review — agent-save-409

## Resumo

**Veredicto:** ⚠️ CONCERNS (não-bloqueante)
**Data:** 2026-05-01
**Reviewer:** Axikar (dev-qa)
**Escopo:** migration `20260501130000_fix_save_agent_complete_resolve_created_by.sql` + rollback associado.
**Frontend:** intencionalmente NÃO modificado (fix backend-only, opção A do data-engineer).

## Bug original

- HTTP 409 / Postgres 23503 ao salvar agente em `/settings/crm/aiagents/:uuid`.
- FK `ai_agents_history.created_by → settings_users(id)` violada.
- Causa raiz: frontend `src/hooks/useAgentesIAReal.ts:471` envia `p_created_by = user?.id` (valor de `auth.users.id` retornado por `supabase.auth.getUser()`), mas a FK aponta para `settings_users.id`. Entidades distintas — `settings_users` tem PK própria e referencia `auth.users` apenas via `auth_user_id`.

## Mudança aplicada

A migration substitui o INSERT em `ai_agents_history` por uma resolução defensiva de `created_by`:

1. Se `p_created_by` já é um `settings_users.id` válido → usa direto.
2. Senão, se `p_created_by` casa com `settings_users.auth_user_id` → usa o `id` correspondente.
3. Senão, fallback via `auth.uid()` → `settings_users` lookup.
4. Senão, grava NULL (FK aceita por `ON DELETE SET NULL`).

Resto da RPC (UPDATE de `ai_agents` + replace de `ai_agents_steps`) preservado verbatim de `20260501120000_fix_save_agent_complete_array_types.sql`.

## 8-Point Checklist

| # | Critério | Resultado | Notas |
|---|---|---|---|
| 1 | Code review — patterns, legibilidade | ✅ | DDL idempotente (`CREATE OR REPLACE`), assinatura preservada, comentários explicam intent. Lógica de resolve linear e legível. |
| 2 | Unit tests / coverage | ⚠️ | Sem testes automatizados de RPC — projeto não tem suite pgTAP. Mitigação: gates manuais sugeridos pelo data-engineer (5 cenários). |
| 3 | Acceptance criteria | ✅ | (a) salvar agente com user que tem auth.id ≠ settings_users.id → não retorna 23503; (b) `ai_agents_history.created_by` populado com `settings_users.id` correto via lookup. |
| 4 | Sem regressões | ✅ | UPDATE de `ai_agents` + replace de `ai_agents_steps` idêntico à versão 120000. Diff confinado às linhas 38, 62-89 (DECLARE + bloco resolve + INSERT). Verificado lado-a-lado. |
| 5 | Performance | ✅ | Adiciona até 3 SELECTs pontuais (`settings_users` por PK e índice UNIQUE em `auth_user_id`). Custo desprezível: lookups em índice, executados apenas no INSERT do snapshot. |
| 6 | Security | ✅ | `SECURITY DEFINER` + `SET search_path = public` preservados. GRANT EXECUTE para `authenticated`, REVOKE de `anon` mantidos. Resolve não introduz vetor de spoofing — branch 1 só aceita IDs já existentes em `settings_users`; um attacker nunca consegue plantar autoria de outro user (no máximo apagar a própria autoria gravando NULL). |
| 7 | Documentação | ✅ | Comentário inline da migration documenta root cause, estratégia e fallback NULL. Suficiente. |
| 8 | Contratos de API | ✅ | Assinatura `(uuid, jsonb, jsonb, jsonb, uuid)` inalterada. Frontend continua mandando `user?.id` sem mudança — RPC tornou-se permissivo. Caller types em `src/integrations/supabase/types.ts:6644-6649` não precisa mudar. |

## Verificações estruturais

- `ai_agents_history.created_by uuid REFERENCES settings_users(id) ON DELETE SET NULL` (definido em `20260312150001_ensure_full_tenant_baseline.sql:603`). NULL aceito pela FK.
- `settings_users.id PRIMARY KEY` + `settings_users.auth_user_id UNIQUE` (constraint `settings_users_auth_user_id_key`, baseline + `20251203012023_…sql:43`). Lookups determinísticos (≤1 linha).
- Único call site da RPC em `src/`: `src/hooks/useAgentesIAReal.ts:471` (frontend). Nenhum edge function chama. Fix backend cobre 100% do consumo.
- Rollback `rollbacks/20260501130000_…rollback.sql` confere bit-a-bit com `20260501120000_…sql` (versão anterior). Reversão limpa via `BEGIN; CREATE OR REPLACE …; COMMIT`.

## Edge cases analisados

| Cenário | Comportamento | OK? |
|---|---|---|
| User com `auth.users.id` ≠ `settings_users.id` (caso atual) | Branch 2 mapeia → `created_by = settings_users.id` correto. | ✅ |
| User SEM registro em `settings_users` (admin via service_role, etc) e `auth.uid()` NULL | Todas as branches retornam NULL → grava `created_by = NULL`. RPC continua. | ⚠️ Comportamento intencional, ver CONCERN-1. |
| Caller envia `settings_users.id` direto (futuro) | Branch 1 aceita → usa direto, sem lookup desnecessário. | ✅ |
| Caller envia UUID inválido (não existe em settings_users por nenhuma das chaves) E `auth.uid()` mapeia para um settings_users | Branch 3 (`auth.uid()`) recupera o user real chamador. | ✅ |
| Race: dois saves concorrentes | `SELECT … FOR UPDATE` em `ai_agents` no início serializa. `current_version + 1` lido sob lock. Resolve ocorre dentro da mesma transação. | ✅ |
| User foi deletado entre o save anterior e este | `auth_user_id` lookup retorna NULL → grava NULL. ON DELETE SET NULL coerente. | ✅ |
| `p_created_by` colide acidentalmente com `settings_users.id` de outro user | Probabilidade UUID v4 ≈ 0. Documentado como CONCERN-2 informativo. | ✅ |
| Criação de NOVO agente | RPC é UPDATE-only (`IF NOT FOUND THEN RAISE EXCEPTION 'agent not found'`). Criação usa caminho separado, não tocado. Sem regressão. | ✅ |
| Listagem/leitura de agentes | RPC só faz INSERT em history e UPDATE em ai_agents. Não toca SELECT/policies/views. Sem regressão. | ✅ |

## Issues

### CONCERN-1 (LOW, design intencional — documentar)

Quando a RPC é chamada com `p_created_by` que não casa em nenhuma das 3 branches **e** `auth.uid()` é NULL ou mapeia para nada, `created_by` é gravado como NULL. A história perde rastro do autor.

- **Cenário típico:** chamada via service_role JWT sem `sub` de user, ou user removido de `settings_users` entre save anterior e este.
- **Severidade:** LOW. Documentado no comment da migration linhas 14-15 ("If no settings_users row maps to the caller, store NULL"). Comportamento intencional escolhido pelo data-engineer.
- **Sugestão de hardening futuro (não-bloqueante):** logar warning via `RAISE NOTICE 'save_agent_complete: created_by resolved to NULL for input %', p_created_by;` para facilitar diagnóstico em produção. Pode entrar em story de observability separada.

### CONCERN-2 (INFORMATIVO, não-acionável)

A branch 1 (`SELECT id FROM settings_users WHERE id = p_created_by`) aceitaria como válido um UUID que **acidentalmente** colidisse com algum `settings_users.id` arbitrário, gravando autoria errada.

- **Probabilidade:** UUID v4 com 122 bits aleatórios → ~zero. Não justifica defesa adicional.
- **Sugestão:** nenhuma. Apenas registro.

### CONCERN-3 (OPS — apply pendente)

A migration **ainda não foi aplicada** ao banco de produção. Bythak (dev-data-engineer) deixou claro que aguarda lead/Grav escolher caminho (db push, CI, ou Supabase Dashboard). Gate é sobre o **artefato**, não sobre o estado live.

- **Ação:** Grav (dev-devops) deve coordenar apply seguindo padrão do projeto (preferencialmente `client-migrations.json` manifest entry + propagação automática).
- **Verificar:** se a migration precisa entrada em `client-migrations.json` (padrão observado em fixes recentes — 10184/10190/10192 — todas tinham manifest).

## Gates de smoke recomendados (pós-apply)

Sugeridos pelo Bythak, validados pelo Axikar:

1. **Repro pré-fix:** logar com user cujo `auth.users.id ≠ settings_users.id`; salvar agente; esperar 409.
2. **Apply migration.**
3. **Repetir save:** esperar 200 + linha em `ai_agents_history` com `created_by = settings_users.id` (não NULL).
4. **Edge case:** user sem registro em `settings_users` (raro) → esperar 200 com `created_by = NULL`.
5. **Regressão:** smoke test de UPDATE de `ai_agents` (mudar nome + 1 step) — confirmar persiste.

## Veredicto formal

```
VEREDICTO: CONCERNS
Story: ora-fix-agent-save-409 | Data: 2026-05-01
Aprovado com observações:
- [CONCERN-1] LOW: fallback silencioso para created_by=NULL quando todas as branches falham.
  Local: supabase/migrations/20260501130000_…sql:80-84
  Sugestão: hardening futuro com RAISE NOTICE para observability.
- [CONCERN-2] INFO: colisão UUID v4 teoricamente possível em branch 1.
  Probabilidade ~zero. Sem ação.
- [CONCERN-3] OPS: migration ainda não aplicada. Coordenar apply via Grav (dev-devops).
Próximo passo: @dev-devops aplicar migration (db push ou CI/manifest) +
  smoke tests sugeridos. Frontend não muda (intencional).
```

## Sinal-off

- Migration: ✅ correta, idempotente, assinatura preservada.
- Rollback: ✅ presente, fiel à versão anterior, transacional.
- FK semantics: ✅ `ON DELETE SET NULL` coerente com fallback NULL.
- Performance: ✅ desprezível.
- Security: ✅ sem vetor novo de spoofing.
- Regressão criar/listar: ✅ não tocado.
- Regressão fluxo edit (path 120000): ✅ verbatim.
- Apply pendente — não bloqueia gate.

— Axikar
