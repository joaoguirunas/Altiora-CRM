---
title: "Story FWUP-18b: Hardening de buckets storage — MIME types e path-prefix policies"
type: story
status: backlog
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
- [ ] AC1: Buckets `logos`, `lp-assets` e `omni-media` têm `allowed_mime_types` definidos (ex: `image/png`, `image/jpeg`, `image/webp`, `image/gif` para logos; `image/*`, `video/*` para omni-media)
- [ ] AC2: Policy INSERT em `storage.objects` para bucket `logos` valida que o path começa com `auth.uid()` ou `tenant_id` — user A não pode sobrescrever arquivo de user B
- [ ] AC3: `REQUIRED_BUCKETS` no `adm-sync-client` alinhado com os `allowed_mime_types` definidos na migration
- [ ] AC4: SVG bloqueado nos buckets públicos (vetor XSS)
- [ ] AC5: Migration idempotente — re-run não quebra tenants existentes

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
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
