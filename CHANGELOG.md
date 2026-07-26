# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versão semântica: `MAJOR.MINOR` definido em `version.json` + `release.json`.

---

## [Unreleased]

### Em progresso
- REL-02: ADM UI — botão "Atualizar cliente" com badge de versões atrás
- FIX-SCORE-01, FIX-SENDS-FIRST-MSG-01, FIX-BI-01

---

## [4.72] — Release Pipeline V1 (REL-01..REL-05) — 2026-07-25

### ⚠️ BREAKING CHANGE — Tenant Sync agora é opt-in

**A partir desta release, push para `main` NÃO dispara mais sync automático de tenants.**

**Antes (< v4.72):**
```
git push main  →  sync-clients.yml dispara  →  TODOS os tenants recebem migrations
```

**Agora (≥ v4.72):**
```
git push main  →  release-tag.yml cria release.json + tag release-v{N}
               →  ADM UI exibe badge "N versões atrás" por cliente
               →  Operador clica "Atualizar" por cliente (ou bulk)
               →  adm-sync-client registra resultado em adm_client_versions
```

**Por que a mudança?**
- Sync automático aplicava migrations silenciosamente em produção a cada merge, sem confirmação do operador.
- Com releases versionadas, cada tenant pode ser atualizado em janela controlada.
- `adm_client_versions` registra audit trail completo de cada aplicação (success/failed/partial).
- Rollback por release futura (REL-05 baseline + `min_compat_from`).

**Ação necessária pelos operadores:**
Após cada release, acesse a ADM UI → seção Clientes → clique "Atualizar" nos clientes
que exibem badge de versão desatualizada. Para situações de emergência, use o workflow
manual `Actions → Sync Clients — Manual (super-admin)`.

### Added

#### Release Pipeline (REL-01)
- `release.json` gerado automaticamente a cada push em `main` com migrations novas
- GitHub Action `release-tag.yml`: detecta migrations, bumpa `version.json`, gera `release.json`, cria tag `release-v{N}`, registra em `adm_releases` via edge fn
- Edge fn `adm-releases-register`: INSERT idempotente em `adm_releases` (ON CONFLICT DO NOTHING)
- Tabelas `adm_releases` e `adm_client_versions` no control plane (audit trail completo)
- Colunas `current_version` e `target_version` em `adm_clients`
- Schema de `release.json`:
  ```json
  {
    "version": "4.72",
    "major": 4, "minor": 72,
    "created_at": "2026-07-25T...",
    "git_sha": "abc1234",
    "migrations": ["20260725250000_fix_legacy_cron_urls.sql", "..."],
    "min_compat_from": "1.0",
    "changelog": "feat: ...|fix: ..."
  }
  ```

#### Migration Discipline (REL-04)
- Script `scripts/lint-migrations.js`: 9 regras (MIG001–MIG009) com exit 1 em erros
- GitHub Action `lint-migrations.yml`: CI gate obrigatório em PRs com migrations — bloqueia merge em erro
- GitHub Action `migrations-dry-run.yml`: dry-run BEGIN…ROLLBACK em Postgres 15 container por PR
- Rollback files obrigatórios em `supabase/migrations/rollbacks/` (MIG006)

#### Baseline Squashing (REL-05)
- Script `scripts/squash-baseline.js`: consolida N migrations em `_baseline_vN.sql`
- GitHub Action `baseline-approve.yml`: valida candidato com dry-run, arquiva migrations originais, registra `is_baseline=true` em `adm_releases`
- GitHub Action `baseline-restore.yml`: restaura baseline arquivado em emergência

#### ADM Client Drift (ADM migrations)
- `20260725300000_adm_client_drift.sql`: drift detection schema no control plane
- `20260725310000_adm_drift_cron.sql`: cron de detecção automática de drift
- `20260725330000_adm_releases_is_baseline.sql`: coluna `is_baseline` em `adm_releases`

### Changed

#### sync-clients.yml — workflow manual apenas
- **REMOVIDO:** trigger automático em push para `main`
- **MANTIDO:** `workflow_dispatch` para super-admin force-sync de emergência
- Novos inputs: `client_slug`, `target_version`, `deploy_functions`, `reason` (obrigatório)
- `reason` é obrigatório para audit trail — sem motivo, workflow não executa

#### scripts/sync-clients.js
- Lê `TARGET_VERSION` env → passa `target_version` ao edge fn `adm-sync-client` (REL-01 AC6)
- Lê `DEPLOY_FUNCTIONS` env → deploy de edge fns é agora condicional
- Lê `SYNC_REASON` env → passado ao edge fn para registro em `adm_client_versions`
- Log de auditoria expandido: exibe trigger, alvo, versão, motivo

### Fixed

- `FIX-SENDS-CRON-LEGACY-URLS`: URLs de crons legados atualizadas (`20260725250000`)
- `FIX-SENDS-STATUS-BRIDGE-01`: bridge `messages → sends_contacts` criada (`20260725270000`)
- `CLEAN-SENDS-01`: tabela `sends_import_presets` removida (`20260725280000`)
- `ARCH-RBAC-02`: RBAC granular dropado em favor de RLS por tenant (`20260725260000`)
- `OBS-DISPATCH-HEALTH-01`: observabilidade de dispatch de saúde (`20260725290000`)

---

## [4.69] — Altiora CRM V1 (ALTIORA-01..25) — 2026-07-22

### Added
- Pipeline Altiora com 13 etapas específicas para referrals
- Terminologia dinâmica "Negócio" → "Referral" via `getEntityLabel()` (ALTIORA-04)
- Schema completo: `altiora_pipeline`, `altiora_leads_referral`, reuniões R1/R2/R3, Finvity, contratação
- Ficha de referral com aba Referral na NegocioSidebar
- Filtros avançados e busca no pipeline Altiora (ALTIORA-09)
- Minha Carteira — filtro por Closer (ALTIORA-10)
- Gestão de usuários com perfil Closer e bloqueio de conta (ALTIORA-23)
- Indicadores operacionais do funil (ALTIORA-24)
- Painel de pendências com alertas de referrals parados (ALTIORA-25)

---

*Para o histórico completo de commits, veja `git log --oneline`.*
*Convenções do release pipeline: `docs/smart-memory/conventions/release-pipeline.md`.*
