---
title: "US-CFG-04: Gestão de API Keys internas (geração, rotação, revogação)"
type: story
status: done
epic: settings
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, security, api-keys, P2]
related: ["[[../../project/modules/settings]]", "[[../../decisions/ADR-ADM-02-secrets-encryption]]"]
---

# US-CFG-04: Gestão de API Keys internas (geração, rotação, revogação)

## Objetivo
Prover uma interface para gestores gerarem, rotacionarem e revogarem API keys do tenant usadas por integrações externas (webhooks inbound, Zapier, automações personalizadas).

## Acceptance Criteria
- [x] AC1: Nova seção Settings > Geral > API Keys exibe lista de keys existentes do tenant com: nome, prefixo (8 chars + `...`), data de criação, último uso, status (ativa/revogada)
- [x] AC2: Botão "Gerar nova key" abre modal com campo "Nome/descrição" — ao confirmar, gera `rev_live_{random_32_hex}`, exibe uma única vez com botão de copiar, salva em `tenant_api_keys` (tenant_id, name, key_hash, key_prefix, last_used_at, revoked_at)
- [x] AC3: Botão "Revogar" em cada key ativa requer confirmação ("Digite o nome da key para confirmar") e seta `revoked_at = now()`
- [x] AC4: Edge function `api-key-auth` valida key recebida em header `X-API-Key` contra SHA-256 hash via Web Crypto API e atualiza `last_used_at` — retorna `{ valid: false }` se revogada ou não encontrada
- [x] AC5: Keys revogadas ficam visíveis na lista por 30 dias (para auditoria) e então são deletadas via `pg_cron`

## Escopo

**IN:**
- Migration: tabela `tenant_api_keys` (id, tenant_id, name, key_hash text, key_prefix varchar(12), created_by uuid refs settings_users, last_used_at, revoked_at, created_at)
- Edge function `api-key-auth` (Deno, service_role) para validação
- Componente `ApiKeysConfig.tsx` em `src/components/config/`
- Nova entrada no nav de Settings dentro do grupo Geral
- Hook `useApiKeys` → `src/hooks/useApiKeys.ts`

**OUT:**
- Scopes/permissões por key (todas as keys têm acesso total por ora)
- Rate limit por key
- SDK client gerado

## Contexto Técnico
O padrão de secrets no projeto é `app_encrypt_secret` via pgcrypto (ADR-ADM-02) para credentials OAuth. Para API keys internas, hash SHA-256 é suficiente (não é necessário descriptografar — apenas comparar hash). `key_hash` usa Web Crypto API `crypto.subtle.digest("SHA-256")` no frontend (hook) e na edge fn, produzindo hex idêntico ao `encode(sha256(key::bytea), 'hex')` do Postgres. `key_prefix` armazena os primeiros 12 chars para exibição na lista sem expor a key completa. A edge fn `api-key-auth` usa service_role para ler a tabela sem RLS e retorna `{ tenant_id, valid: boolean }` — consumidores verificam `valid` antes de processar o request.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## File List

- `supabase/migrations/20260423003000_tenant_api_keys.sql` — tabela + RLS + pg_cron GC
- `supabase/functions/api-key-auth/index.ts` — edge fn de validação (service_role)
- `src/hooks/useApiKeys.ts` — useApiKeys, useCreateApiKey, useRevokeApiKey
- `src/components/config/ApiKeysConfig.tsx` — painel completo com GenerateModal + RevokeDialog
- `src/pages/Configuracoes.tsx` — lazy import + nav entry "api-keys" + renderContent case

## QA Results
<!-- QA preenche ao revisar -->
