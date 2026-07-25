---
title: "Story FWUP-18b: Hardening de buckets storage — MIME types e path-prefix policies"
type: story
status: done
epic: FWUP
complexity: S
agent: dev-dev-gamma
created: 2026-04-30
updated: 2026-04-30
tags: [story, storage, security, hardening]
related: [FWUP-18]
---

# Story FWUP-18b: Hardening de buckets storage — MIME types e path-prefix policies

## Objetivo
Restringir uploads nos buckets públicos a MIME types seguros e adicionar path-prefix por owner nas policies INSERT para evitar sobreescrita entre usuários do mesmo tenant.

## Acceptance Criteria
- [x] AC1: Buckets `logos`, `lp-assets` e `omni-media` têm `allowed_mime_types` definidos (ex: `image/png`, `image/jpeg`, `image/webp`, `image/gif` para logos; `image/*`, `video/*` para omni-media)
- [x] AC2: Policy INSERT em `storage.objects` para bucket `logos` valida que o path começa com `auth.uid()` ou `tenant_id` — user A não pode sobrescrever arquivo de user B
- [x] AC3: `REQUIRED_BUCKETS` no `adm-sync-client` alinhado com os `allowed_mime_types` definidos na migration
- [x] AC4: SVG bloqueado nos buckets públicos (vetor XSS)
- [x] AC5: Migration idempotente — re-run não quebra tenants existentes

## Escopo

**IN:**
- Nova migration `fwup18b` com ALTER dos buckets existentes para adicionar `allowed_mime_types`
- Atualização das policies INSERT de `logos` com path-prefix por owner
- Atualização de `REQUIRED_BUCKETS` no `adm-sync-client/index.ts`

**OUT:**
- Migração de arquivos já enviados (dado histórico não é movido)
- Alteração no frontend de upload (só se necessário para adaptar paths)
- Bucket `negocios` (privado, baixo risco)

## Contexto Técnico
- Origem: veredicto QA CONCERNS na FWUP-18 (2026-04-30)
- Buckets afetados: `logos` (public), `lp-assets` (public), `omni-media` (public)
- `useNegocioArquivos.ts:67` usa bucket `logos` com path `leads/{negocioId}/` — policy de path-prefix deve contemplar esse padrão
- Migrations de referência com `allowed_mime_types`: `20260112202138`, `20260217210000`
- `adm-sync-client` cria buckets via API; migration aplica `ON CONFLICT DO UPDATE` — ambos precisam ser atualizados

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List

- `supabase/migrations/20260725250000_fwup18b_storage_hardening.sql` — migration principal: `allowed_mime_types` nos 3 buckets; INSERT policy de logos com path-prefix; bloqueia SVG
- `src/hooks/useSettings.ts` — `useUploadLogo`: path agora `{uid}/logo-{ts}.{ext}` para passar na INSERT policy (necessário para AC2)

## QA Results

```
VEREDICTO: CONCERNS
Story: FWUP-18b | Data: 2026-07-25
tsc EXIT 0; migration idempotente confirmada.

QUESTÃO DO LEAD (AC4 lp-assets/SVG): AC4 CORRETO dentro do escopo.
  Migration bloqueia novos uploads SVG em todos os 3 buckets ✅.
  Escopo declarou explicitamente que histórico não é migrado.
  Risco residual = SVGs enviados entre 20260217210000..20260725 (ver CONCERN-1).

AC1 ✅  MIME types definidos: logos/lp-assets (jpeg/jpg/png/webp/gif, sem SVG);
        omni-media (imagens+áudio+vídeo+docs, sem SVG). ON CONFLICT DO UPDATE.
AC2 ✅  INSERT policy logos: path-prefix auth.uid()::text OR 'leads'. useSettings.ts
        prefixado com ${ownerId}/. useNegocioArquivos.ts usa leads/ (coberto).
AC3 ✅  adm-sync-client ausente (standalone). ON CONFLICT DO UPDATE = canônico.
AC4 ✅  SVG ausente nos 3 allowed_mime_types. Novos uploads bloqueados.
        Histórico em lp-assets: residual, ver CONCERN-1.
AC5 ✅  ON CONFLICT DO UPDATE + DROP POLICY IF EXISTS. Idempotente.

[CONCERN-1 MEDIUM] Residual XSS: SVGs históricos em lp-assets ainda públicos.
  lp-assets tinha image/svg+xml desde 20260217210000. FWUP-18b bloqueia
  novos uploads mas não remove histórico. SVGs com JS malicioso (se houver)
  continuam acessíveis via URL pública.
  AÇÃO: story FWUP-18c — auditar e remover SVGs em lp-assets
  (query: storage.objects WHERE bucket_id='lp-assets' AND name ILIKE '%.svg').

[CONCERN-2 MEDIUM] logos UPDATE/DELETE permissivos (pré-existente FWUP-18):
  USING (bucket_id='logos') — qualquer autenticado pode sobrescrever/apagar
  arquivo de outro via path conhecido. FWUP-18b corrigiu INSERT; UPDATE/DELETE
  permanecem. Overwrite via upsert ainda possível para arquivos existentes.
  AÇÃO: adicionar path-prefix a UPDATE/DELETE do logos em story separada.

[CONCERN-3 LOW] lp-assets INSERT/UPDATE/DELETE permissivos (pré-existente).
  AC2 só exigiu logos. Mesma superfície que logos para lp-assets.

[CONCERN-4 LOW] useSettings.ts: fallback ?? 'anonymous' → path rejeitado
  pela INSERT policy se auth.getUser() retornar null. Fail-closed (correto),
  sem mensagem de erro diferenciada.

Push LIBERADO.
```
