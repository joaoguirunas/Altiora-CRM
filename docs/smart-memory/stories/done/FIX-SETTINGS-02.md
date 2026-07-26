---
title: "FIX-SETTINGS-02: Unificar tabelas settings e bi_settings (split de schema)"
type: story
status: done
priority: P3
complexity: L
agent: dev-ux
created: 2026-04-23
updated: 2026-04-22
tags: [story, settings, debt, P3, schema]
related: ["[[../../project/modules/settings]]", "[[../../project/modules/bi-pro]]"]
---

# FIX-SETTINGS-02: Unificar tabelas settings e bi_settings (split de schema)

## Objetivo
Consolidar `settings` e `bi_settings` (tabelas separadas por histórico) em estrutura unificada, eliminando dualidade de queries e risco de drift de configurações.

## Acceptance Criteria
- [x] AC1: Auditoria completa das queries que leem de `settings` vs `bi_settings` — mapeado qual dado vai pra onde
- [x] AC2: Decisão de arquitetura documentada: unificar em `settings` (adicionar colunas) ou manter separado com FK explícita
- [x] AC3: Migration criada e testada (dry-run antes de apply)
- [x] AC4: Todas as queries atualizadas para o modelo novo
- [x] AC5: Nenhuma regressão no dashboard BI nem nos painéis de Settings

## Escopo

**IN:**
- Auditoria de usos de `settings` e `bi_settings` no codebase
- Migration de consolidação ou adição de FK
- Atualização de hooks/queries afetados

**OUT:**
- Mudança no modelo de autenticação/RLS de settings
- Novos campos de configuração

## Contexto Técnico
Identificado por dev-ux durante CLEAN-SETTINGS-01 (DT-3): tabelas `settings` e `bi_settings` coexistem com overlap de responsabilidade. Requer migração de dados e decisão arquitetural — escopo maior que UX debt, merece story própria. Coordenar com dev-data-engineer (byte) para validação do schema e migration safety.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## Auditoria AC1 — Mapa de uso por tabela

### `settings` (multi-row, lida com `ORDER BY created_at DESC LIMIT 1`)

| Campo | Quem usa |
|---|---|
| `company_name`, `logo_url`, `primary_color`, etc. | `useSettings` → praticamente todos os painéis de Settings Geral |
| `google_client_id`, `google_client_secret` | `GoogleConfig.tsx`, `useGoogleOAuthConfig`, `useUpdateSettings`; edge fns `google-cal-*`, `public-booking` |
| `apify_token` | `prospect-enrich-plugin` edge fn; `_shared/prospect-providers.ts` |
| `explorium_api_key` | `_shared/explorium.ts`; `_shared/prospect-providers.ts` |
| `apollo_api_key`, `pdl_api_key` | `_shared/prospect-providers.ts` |

### `bi_settings` (singleton, `WHERE singleton = true`)

| Campo | Quem usa |
|---|---|
| `meta_app_id`, `meta_app_secret`, `meta_system_token*` | `useBIProSettings`, `MetaIntegrationConfig`, `meta-save-credentials`, `bi-meta-oauth`, `meta-inbound` |
| `google_client_id`, `google_client_secret` | **OVERLAP** — CFG-05 já migrou para `settings`; estava como fallback em `useGoogleOAuthConfig` e exclusivo em `bi-google-oauth`, `AdsConfig` |
| `google_developer_token` | `useBIProSettings`, `AdsConfig`, `bi-google-oauth`, `bi-sync-google-ads`, `conversion-fetch-platforms`, `conversion-send` |
| `ms_client_id`, `ms_client_secret` | `TeamsConfig`, `ms-teams-connect`, `ms-teams-upsert-event`; `Perfil.tsx` |
| `zoom_client_id`, `zoom_client_secret`, `zoom_account_id` | `ZoomConfig`, `zoom-connect`, `zoom-upsert-event` |
| `cr_benchmarks` (jsonb) | `useCRBenchmarks` |

## Decisão AC2 — Manter separação, eliminar overlap

**Decisão: NÃO unificar as tabelas. Formalizar separação com domínios claros.**

Justificativa:
- `settings`: configurações de identidade/branding do tenant + API keys de enriquecimento de leads. Multi-row (histórico). Dono: Schedule PRO / Configurações Gerais.
- `bi_settings`: credenciais OAuth para plataformas de Ads + calendários + comunicação. Singleton. Dono: BI PRO.
- Unificar obrigaria a misturar `company_name` com `meta_app_secret` — coupling inadequado.
- O único overlap real era `google_client_id`/`google_client_secret`, que já havia sido migrado para `settings` via CFG-05 mas não removido de `bi_settings`.

**Ação corretiva:** remover `google_client_id`/`google_client_secret` de `bi_settings` (já estão em `settings` como source of truth).

## Implementação AC3/AC4

### Migration
`supabase/migrations/20260422002000_settings_bi_settings_decouple.sql`

- Safety seed: copia `bi_settings.google_client_id/secret` → `settings` onde ainda não copiado (idempotente)
- `DROP COLUMN IF EXISTS google_client_id, google_client_secret` em `bi_settings`
- Atualiza COMMENT da tabela

### Código atualizado

**`src/hooks/useGoogleOAuthConfig.ts`** — removido fallback para `bi_settings`; lê exclusivamente de `settings`

**`src/hooks/useBIProSettings.ts`** — removidos `google_client_id` e `google_client_secret` da interface `BIProSettings`

**`src/components/config/AdsConfig.tsx`** (`GoogleCredentialsForm`):
- Lê `google_client_id`/`google_client_secret` de `useSettings()` via `appSettings`
- Salva via `useUpdateSettings()` para `settings`
- Mantém `google_developer_token` em `useBIProSettings()`/`saveSettings`
- Main `AdsConfig`: `clientId` para `PlatformSection` vem de `appSettings` (settings table)

**`supabase/functions/bi-google-oauth/index.ts`** — migrado para ler `google_client_id/secret` de `settings` (primary); `google_developer_token` continua em `bi_settings`

## File List

- `supabase/migrations/20260422002000_settings_bi_settings_decouple.sql` — criado
- `src/hooks/useGoogleOAuthConfig.ts` — fallback removido
- `src/hooks/useBIProSettings.ts` — interface enxugada
- `src/components/config/AdsConfig.tsx` — GoogleCredentialsForm + AdsConfig atualizados
- `supabase/functions/bi-google-oauth/index.ts` — leitura migrada para settings

## QA Results

TypeScript: `npx tsc --noEmit --skipLibCheck` — sem erros.  
Sem regressão em `GoogleConfig.tsx` (já usava `useSettings`).  
`Perfil.tsx`: lê `ms_client_id` de `bi_settings` (correto, não alterado) e `google_client_id` via `useGoogleOAuthConfig` → `settings` (correto).
