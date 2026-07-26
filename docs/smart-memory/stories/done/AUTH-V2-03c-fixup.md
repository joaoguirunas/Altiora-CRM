---
title: "AUTH-V2-03c-fixup — Atomicidade do recovery flow (consumeRecoveryCode + unenrollSelf)"
type: story
status: done
epic: auth-v2
priority: P1
complexity: S
agent: dev-data-engineer
created: 2026-04-26
updated: 2026-04-26
tags: [story, auth, mfa, recovery, atomicity, rpc]
related: ["[[../active/AUTH-V2-03c]]"]
---

# AUTH-V2-03c-fixup — Atomicidade recovery flow

## Objetivo

Garantir que o consumo de recovery code e o unenroll do TOTP factor sejam atômicos. Hoje o fluxo é:
1. RPC `mfa_recovery_consume` marca `used_at = now()` ✅  
2. Cliente chama `supabase.auth.mfa.unenroll()` — pode falhar

Se o passo 2 falhar, o código foi queimado mas o TOTP factor permanece → usuário fica preso (sem código de recovery válido E sem conseguir fazer AAL2).

## Acceptance Criteria

- [x] AC1: RPC `mfa_recovery_consume` passa a invocar `DELETE FROM auth.mfa_factors WHERE user_id = auth.uid() AND factor_type = 'totp'` dentro da mesma transaction, após marcar o código como usado. O unenroll é feito via SQL direto na tabela `auth.mfa_factors` com SECURITY DEFINER (service_role bypassa Supabase MFA enforcement).
- [x] AC2: `MfaVerify.tsx` remove a chamada `unenrollSelf()` após `consumeRecoveryCode()` — a atomicidade é garantida no backend.
- [x] AC3: Migration com rollback criada em `supabase/migrations/` (não `migrations_adm/`).
- [x] AC4: Se a deleção do factor falhar (ex: factor não encontrado), RPC faz rollback e retorna `{ success: false, error: 'factor_not_found' }` — cliente mostra mensagem clara.

## Escopo

**IN:**
- `supabase/migrations/20260426002000_mfa_recovery_consume_atomic.sql` (NEW) — ALTER FUNCTION ou nova versão do RPC
- `supabase/migrations/rollbacks/20260426002000_mfa_recovery_consume_atomic.rollback.sql` (NEW)
- `src/pages/MfaVerify.tsx` — remover chamada `unenrollSelf()` (AC2)
- `src/hooks/useMFA.ts` — atualizar tipo de retorno de `consumeRecoveryCode` de `boolean` para `{ success: boolean; error?: string }`

**OUT:**
- Reescrever todo o fluxo MFA — fora de escopo
- Notificações por email/push — fora de escopo

## Contexto Técnico

- `auth.mfa_factors` é tabela interna do Supabase. SECURITY DEFINER com `service_role` pode modificá-la.
- Supabase MFA enforcement (AAL2 required for unenroll) bloqueia o unenroll client-side quando o JWT é AAL1 — é exatamente o cenário de recovery. O fix move essa operação pro backend.

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (byte) |
| Iniciado | 2026-04-26 |
| Concluído | 2026-04-26 |
| Branch | main (direto) |

## File List
- `supabase/migrations/20260426002000_mfa_recovery_consume_atomic.sql`
- `supabase/migrations/rollbacks/20260426002000_mfa_recovery_consume_atomic.rollback.sql`
- `src/pages/MfaVerify.tsx` — unenrollSelf removido do recovery flow; resultado tratado como jsonb
- `src/hooks/useMFA.ts` — tipo de retorno de consumeRecoveryCode atualizado; invalidateQueries em onSuccess

## Notas

Identificado pelo QA gate AUTH-V2-03c re-review (2026-04-26). Prioridade P1 — risco de data loss em recovery scenarios reais.

Return type do RPC mudou de `boolean` → `jsonb`. O rollback restaura `boolean` e o comportamento anterior (sem delete atômico).

## QA Results

**VEREDICTO: PASS**
**Story:** AUTH-V2-03c-fixup | **Data:** 2026-04-26 | **Reviewer:** Axikar (dev-qa)

**Checklist 8/8 verificado.** 4/4 ACs atendidos. Race condition do recovery flow fechada de forma transacional.

### Critérios Atendidos

**AC1 ✅ — DELETE atômico dentro da transaction**
- `supabase/migrations/20260426002000_mfa_recovery_consume_atomic.sql:7-95` envolve a função em `BEGIN; … COMMIT;`. Função é `SECURITY DEFINER` com `SET search_path = public, extensions, auth` (linha 13) — necessário para acessar `auth.mfa_factors`.
- Sequência transacional: (1) loop bcrypt match com UPDATE `used_at` (linhas 26-40); (2) SELECT factor_id (linhas 47-51); (3) DELETE FROM `auth.mfa_factors WHERE id = v_factor_id AND user_id = v_user_id` (linhas 59-61); (4) audit log INSERT (linhas 64-73); (5) RETURN success.
- Postgres garante atomicidade: se passo 3 ou 4 falhar, passo 1 (UPDATE used_at) é revertido — código permanece reusável.

**AC2 ✅ — MfaVerify.tsx não chama mais unenrollSelf**
- `src/pages/MfaVerify.tsx:21` destructura apenas `consumeRecoveryCode` do `useMFA()` — `unenrollSelf` não é importado.
- `handleRecovery` (linhas 60-83) chama `consumeRecoveryCode.mutateAsync({ code: trimmed })`, lê `result.success` / `result.error`, e navega para `/settings/mfa-setup` em caso de sucesso. Sem segunda chamada de unenroll.
- Tratamento explícito do code `factor_not_found` em UI (linha 69-71): "Autenticador não encontrado. Contate o administrador."

**AC3 ✅ — Migration + rollback em supabase/migrations/**
- Forward: `supabase/migrations/20260426002000_mfa_recovery_consume_atomic.sql`
- Rollback: `supabase/migrations/rollbacks/20260426002000_mfa_recovery_consume_atomic.rollback.sql`
- Path correto (não `migrations_adm/`), conforme AC. Rollback restaura assinatura `RETURNS boolean` e remove DELETE — comportamento pré-fixup.

**AC4 ✅ — Rollback quando factor não encontrado**
- Linhas 53-56: `IF v_factor_id IS NULL THEN RAISE EXCEPTION 'factor_not_found'`. Por estar dentro do bloco `BEGIN…EXCEPTION WHEN OTHERS`, o RAISE dispara rollback de tudo (incluindo o UPDATE used_at).
- Linhas 77-83: handler `WHEN OTHERS` inspeciona `SQLERRM` e retorna `jsonb_build_object('success', false, 'error', 'factor_not_found')` — código permanece reusável após rollback. Outros erros propagam via `RAISE`.

### Hardening adicional verificado

- `useMFA.ts:74-85` atualizado para tipo de retorno `{ success: boolean; error?: string }` (jsonb). Antes era boolean.
- `useMFA.ts:80-84` invalida `MFA_FACTORS_KEY` em `onSuccess` apenas quando `result.success === true` — evita refetch desnecessário em falha.
- GRANT EXECUTE em `authenticated` + `service_role` (linhas 89-90); REVOKE em PUBLIC + anon (linhas 87-88). Permissionamento correto.
- COMMENT atualizado na função (linhas 92-93) explicita o novo contrato.

### Quality Gates Locais
- `npx tsc --noEmit` → exit 0
- `npx eslint src/pages/MfaVerify.tsx src/hooks/useMFA.ts` → exit 0

### Sem regressões
- Audit (`grep`) confirma: nenhum outro caller de `consumeRecoveryCode` ou `unenrollSelf` no recovery flow. `unenrollSelf` continua exportado pelo hook (mantém API surface) mas não é usado pós-fixup; pode ser limpo em refactor futuro se nenhuma feature pedir.

### Observação LOW

**[LOW] Comentário em useMFA.ts:87 imprecio** — `unenrollSelf` está documentada como "requires AAL1 auth", mas a Supabase MFA enforcement exige AAL2 para unenroll client-side (que era exatamente o motivo do fixup). Comentário não afeta runtime — função não é mais chamada no recovery flow. Não bloqueia.

### Próximo Passo

**@dev-devops liberado para mergear / promover migration.** Story arquivada em `done/`. Race condition de "código queimado + factor preso" eliminada por atomicidade Postgres. Verificação manual end-to-end (consumir código real → confirmar factor deletado em `auth.mfa_factors`) recomendada em ambiente staging antes de produção, mas não bloqueia merge.
