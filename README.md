# RevOS™ by Growth Sales

Plataforma de Revenue Operations para empresas B2B.

## Módulos

- **CRM PRO™** — Pipeline, qualificação IA, gestão de negócios
- **Omni PRO™** — WhatsApp, Instagram, Email em uma inbox unificada
- **BI PRO™** — Analytics e insights de revenue
- **Call PRO™** — Agendamento e follow-ups automatizados
- **Agentes IA** — Automação conversacional com IA

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Database, Auth, Edge Functions, Storage)
- Vercel (Deploy)

## Development

```sh
npm install
npm run dev
```

## Deploy

Push para `main` — Vercel deploya automaticamente o frontend.

## Release Pipeline (multi-tenant)

> ⚠️ **A partir de v4.72, sync para tenants é opt-in.** Push para `main` NÃO aplica migrations automaticamente nos clientes.

### Fluxo de release

```
git push main (com migrations)
  │
  ├─► release-tag.yml         — gera release.json + tag release-v{N}
  │     └─► adm-releases-register — registra em adm_releases (control plane)
  │
  └─► ADM UI (REL-02)         — exibe badge "N versões atrás" por cliente
        └─► Operador clica "Atualizar"
              └─► adm-sync-client — aplica migrations + registra em adm_client_versions
```

### CI gates em PRs com migrations

| Workflow | Quando | O que faz |
|---|---|---|
| `lint-migrations.yml` | PR com migrations | Verifica MIG001–MIG009 — bloqueia merge em erro |
| `migrations-dry-run.yml` | PR com migrations | BEGIN…ROLLBACK em Postgres 15 local |

### Sync manual de emergência

Quando a ADM UI não estiver disponível:

```
GitHub → Actions → "Sync Clients — Manual (super-admin)" → Run workflow
```

Inputs: `client_slug` (vazio = todos), `target_version`, `deploy_functions`, `reason` (obrigatório).

Ver detalhes: [`docs/smart-memory/conventions/release-pipeline.md`](docs/smart-memory/conventions/release-pipeline.md) e [`CHANGELOG.md`](CHANGELOG.md).
