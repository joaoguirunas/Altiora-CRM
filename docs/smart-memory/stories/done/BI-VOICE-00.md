---
title: "BI-VOICE-00: Provider Gemini em settings_ai_providers + helper backend cost-isolation"
type: story
status: done
epic: bi-voice
priority: P2
complexity: S
agent: dev-data-engineer + dev-dev-alpha
created: 2026-04-24
updated: 2026-04-24
tags: [story, bi-voice, settings, ai-providers, prereq, security]
related: ["[[../../agents/research/2026-04-24-gemini-live-bi-pro]]", "[[../../decisions/ADR-BI-VOICE-01-gemini-live-architecture]]"]
---

# BI-VOICE-00: Provider Gemini em settings_ai_providers + helper backend cost-isolation

## Objetivo
Garantir que cada tenant configure sua própria Gemini API key (cost isolation) via UI Settings → IA Providers, e expor um helper server-side que edge functions usem para resolver a key do tenant ativo sem nunca expor o valor ao client.

## Acceptance Criteria
- [x] AC1: `AIProvidersConfig.tsx` permite criar/editar/remover entrada com `provider='gemini'` (hint atualizado para `gemini-2.5-flash-native-audio-preview-12-2025`).
- [x] AC2: Migration cria RPC `get_active_ai_provider_key(p_provider text)` SECURITY DEFINER que retorna `text` (api_key da row `is_default=true AND active=true AND provider=p_provider`). RPC é restrita a `service_role` via REVOKE + GRANT explícito.
- [x] AC3: Edge functions invocam o RPC via service_role client; helper TypeScript `getProviderKey(provider, supabase)` em `supabase/functions/_shared/ai_providers.ts` encapsula a chamada e retorna `string | null` (null = não configurado).
- [x] AC4: Frontend (`useAIProviders` hook) NUNCA recebe `api_key` no SELECT — SELECT explícito sem `api_key`; tipo `AIProvider` não inclui `api_key`; tipo separado `AIProviderInput` usado apenas em mutations.
- [x] AC5: UI exibe badge "configurado" na listagem sem revelar o valor — `MaskedKey` removido, `ConfiguredBadge` substituído.
- [ ] AC6: Validação de key opcional: botão "Testar conexão" no modal — edge fn `gemini-key-validate`. (DEFERIDO para story separada)

## Escopo

**IN:**
- `src/components/config/AIProvidersConfig.tsx` — hint atualizado, tipos corrigidos, MaskedKey→ConfiguredBadge.
- `src/hooks/useAgentesIAReal.ts` — SELECT explícito sem `api_key`, tipos `AIProvider` / `AIProviderInput` separados.
- `supabase/migrations/20260424001000_ai_providers_get_active_key_rpc.sql` (NEW) — RPC SECURITY DEFINER + REVOKE/GRANT.
- `supabase/migrations/rollbacks/20260424001000_ai_providers_get_active_key_rpc.rollback.sql` (NEW).
- `supabase/functions/_shared/ai_providers.ts` (NEW) — helper TypeScript reutilizável.
- `supabase/client-migrations.json` — entry 154 adicionada.

**OUT:**
- pgsodium encryption — escopo separado.
- Rotação automática de chaves — fora de escopo.
- Multi-key por tenant — escopo futuro.
- AC6 `gemini-key-validate` — deferido para story separada.

## Contexto Técnico

A tabela `settings_ai_providers` já existia com `gemini` no CHECK constraint — zero colunas novas necessárias.
A migration está aplicada **per-tenant** (vai pra `migrations/`, não `migrations_adm/`).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | byte (dev-data-engineer) — backend; dev-dev-alpha — UI (pendente) |
| Iniciado   | 2026-04-24 |
| Concluído  | — (AC1-AC5 done by byte; AC6 deferido) |
| Branch     | feat/bi-voice-00-gemini-provider |

## File List

- `supabase/migrations/20260424001000_ai_providers_get_active_key_rpc.sql`
- `supabase/migrations/rollbacks/20260424001000_ai_providers_get_active_key_rpc.rollback.sql`
- `supabase/functions/_shared/ai_providers.ts`
- `src/hooks/useAgentesIAReal.ts` (modificado — AIProvider sem api_key, AIProviderInput, SELECT explícito)
- `src/components/config/AIProvidersConfig.tsx` (modificado — hint Gemini, tipos, ConfiguredBadge)
- `supabase/client-migrations.json` (modificado — entry 154)

## QA Results

**VEREDICTO: CONCERNS** — Story BI-VOICE-00 | Data: 2026-04-26 | Reviewer: Axikar (dev-qa)

> Aprovado para push com 1 observação MEDIUM **pré-existente** (RLS row-level)
> que esta story NÃO introduz nem é responsável por corrigir. Veja "Issues".

### Checklist 8/8 verificados

| # | Critério                              | Resultado |
|---|---------------------------------------|-----------|
| 1 | Code review (patterns, legibilidade)  | OK |
| 2 | Unit tests / coverage                 | N/A — projeto sem framework de teste; gate via tsc+lint |
| 3 | Acceptance criteria                   | 5/5 in-scope (AC6 deferido oficialmente) |
| 4 | Sem regressões                        | OK — schema da tabela inalterado; somente RPC novo + ajustes em hook/UI |
| 5 | Performance                           | OK — RPC retorna 1 row indexada por `(provider) WHERE is_default AND active` |
| 6 | Security                              | Ver Issues (concern pré-existente fora de escopo) |
| 7 | Documentação                          | OK — comentários inline em RPC e helper; story descreve OUT-of-scope |
| 8 | Contratos de API                      | OK — helper `getProviderKey(provider, supabase) → string \| null` claro e tipado |

### Verificação de ACs

- **AC1** ✅ Hint atualizado em [AIProvidersConfig.tsx:35](../../../../src/components/config/AIProvidersConfig.tsx) para `gemini-2.5-flash-native-audio-preview-12-2025, gemini-2.0-flash`. Form CRUD de `provider='gemini'` operacional via `useCreateAIProvider`/`useUpdateAIProvider`/`useDeleteAIProvider`.
- **AC2** ✅ Migration [20260424001000_ai_providers_get_active_key_rpc.sql](../../../../supabase/migrations/20260424001000_ai_providers_get_active_key_rpc.sql) cria `get_active_ai_provider_key(text)` SECURITY DEFINER + `SET search_path = public` (proteção contra search_path hijack). REVOKE explícito de `PUBLIC`/`anon`/`authenticated` e GRANT EXECUTE apenas a `service_role`. Rollback presente.
- **AC3** ✅ Helper [supabase/functions/_shared/ai_providers.ts](../../../../supabase/functions/_shared/ai_providers.ts) encapsula chamada RPC, retorna `string | null` (null em erro ou não-configurado). Já consumido por [supabase/functions/gemini-live-token/index.ts:77](../../../../supabase/functions/gemini-live-token/index.ts).
- **AC4** ✅ [useAgentesIAReal.ts:768](../../../../src/hooks/useAgentesIAReal.ts) faz SELECT explícito `'id, provider, label, is_default, active, created_at, updated_at'` — `api_key` ausente. Tipo `AIProvider` (linhas 752-760) NÃO inclui `api_key`; `AIProviderInput` (linhas 777-783) é tipo separado, usado APENAS em mutations. `useUpdateAIProvider` retorna apenas `id` (sem `.select()`); `useCreateAIProvider` faz `.select(...)` explícito sem `api_key`.
- **AC5** ✅ `MaskedKey` removido (grep confirma 0 ocorrências); `ConfiguredBadge` substitui (AIProvidersConfig.tsx:45-50, render em linha 290).
- **AC6** ⏸️ Deferido oficialmente para story separada (`gemini-key-validate` edge fn).

### Quality gates locais

- `tsc --noEmit` → exit 0
- `eslint` (arquivos da story) → exit 0
- `client-migrations.json` entry 154 confere com filename
- Rollback existe em `supabase/migrations/rollbacks/20260424001000_ai_providers_get_active_key_rpc.rollback.sql`

### Issues

- **[MEDIUM — pré-existente, fora de escopo]** A RLS policy `ai_providers_select_admin` (criada em [20260302110000_n8n-waa-2-settings-ai-providers-ok.sql:58-68](../../../../supabase/migrations/20260302110000_n8n-waa-2-settings-ai-providers-ok.sql)) permite `SELECT *` (incluindo `api_key`) para gestor/super_admin. Isso significa que um gestor com acesso ao Supabase Studio (ou montando `SELECT api_key FROM settings_ai_providers` via `supabase.from(...).select('api_key')`) ainda lê o valor — RLS é row-level, não column-level. **A defesa atual é em camada de aplicação** (hook explicitamente não pede `api_key`). Este concern É RECONHECIDO no comentário da migration original ("for production, encrypt via pgsodium"). **Esta story não introduz a vulnerabilidade nem deveria resolvê-la** — ao contrário, fortalece a separação backend/frontend via RPC service_role-only. Recomendação: criar story dedicada (`pgsodium encryption` ou `column-level RLS`) — escopo já marcado como OUT pela story.
- **[INFO]** `console.error` em [ai_providers.ts:16](../../../../supabase/functions/_shared/ai_providers.ts) faz `JSON.stringify(error)` — pode logar metadados internos do Postgres no log da edge function. Aceitável (logs server-side, não ao client). Recomendação opcional de hardening: serializar apenas `error.code`/`error.message`.

### Próximo passo

@dev-devops push (observações documentadas; concern de RLS é pré-existente e oficialmente fora de escopo desta story).

## Validação 5-pontos (zael)

| # | Critério | Status |
|---|---|---|
| 1 | Título claro e objetivo | GO |
| 2 | Acceptance criteria testáveis e mensuráveis | GO |
| 3 | Escopo definido (IN/OUT explícitos) | GO |
| 4 | Complexidade estimada (S) | GO |
| 5 | Alinhamento com arquitetura atual | GO |

**Veredicto:** GO (5/5).

## Notas

AC6 (`gemini-key-validate`) deferido — edge fn de validação de chave pode ser story própria quando BI-VOICE-01+ precisarem.
