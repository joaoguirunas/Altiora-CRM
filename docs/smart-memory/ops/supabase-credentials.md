---
title: Supabase Credentials — Altiora-CRM Base
type: reference
updated: 2026-07-25
tags: [ops, supabase, credentials]
---

# Supabase Credentials — Banco Ativo

> Banco anterior (`wotuyxscsfralqpoiyfv`) desconectado em 2026-07-25.
> Este projeto opera contra o banco abaixo desde essa data.

## Projeto

| Campo | Valor |
|---|---|
| Project ref | `dtsmbqrzyxhjjjvpjfjd` |
| URL | `https://dtsmbqrzyxhjjjvpjfjd.supabase.co` |

## Tokens (armazenados em `.env.local`, nunca no git)

| Tipo | Variável env |
|---|---|
| Anon key | `VITE_SUPABASE_ANON_KEY` / hardcoded em `src/integrations/supabase/client.ts` |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` |
| Access token (CLI/MCP) | `SUPABASE_ACCESS_TOKEN` — armazenado em `.env.local`, nunca no git |
| Project ID (watcher) | `SUPABASE_PROJECT_ID` = `dtsmbqrzyxhjjjvpjfjd` |

## Uso do Access Token

O `SUPABASE_ACCESS_TOKEN` autentica o CLI Supabase e o MCP server contra a Management API.

```bash
# Exportar para usar o CLI nesta sessão de terminal
export SUPABASE_ACCESS_TOKEN=<valor_do_env_local>
export SUPABASE_PROJECT_ID=dtsmbqrzyxhjjjvpjfjd

# Aplicar migrations via CLI
supabase db push --project-ref $SUPABASE_PROJECT_ID

# Usar o watcher de migrations
./watch-migrations.sh
```

## Histórico

| Data | Projeto | Motivo |
|---|---|---|
| até 2026-07-25 | `wotuyxscsfralqpoiyfv` | Banco original (João Guirunas / compartilhado com blue3-agents-main) |
| 2026-07-25 em diante | `dtsmbqrzyxhjjjvpjfjd` | Banco isolado para esta base de template |
