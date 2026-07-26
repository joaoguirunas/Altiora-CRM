---
title: "ADR-ADM-02: Cifragem de secrets de tenant via pgcrypto com context salt"
status: accepted
date: 2026-03-11
deciders: [dev-architect]
tags: [adr, security, adm, pgcrypto, secrets, control-plane]
related: ["[[ADR-ADM-01-project-per-tenant]]"]
---

# ADR-ADM-02: Cifragem de secrets de tenant via pgcrypto com context salt

## Context

O control plane armazena três credenciais críticas por tenant em `adm_clients`:
- `service_role_key` — acesso admin ao Supabase do tenant
- `db_password` — acesso Postgres direto ao DB do tenant (porta 5432)
- `management_token` — Supabase Management API para deploy de edge functions

Essas credenciais, se vazadas, permitem acesso total ao DB de um tenant. Opções para protegê-las em repouso:

1. **Plaintext** — máxima simplicidade, risco máximo: qualquer leitura da tabela `adm_clients` expõe todos os secrets.
2. **Vault externo** (AWS Secrets Manager, HashiCorp Vault) — isolamento forte, mas adiciona dependência externa, latência, e complexidade operacional para um SaaS no Supabase.
3. **Supabase Vault** (extensão `pgsodium`) — integração nativa, mas disponível apenas em projetos Supabase pagos e requer configuração específica.
4. **pgcrypto com chave derivada** — cifra em banco, usando `pgcrypto.encrypt()` com chave de cifra gerenciada pelo próprio Postgres via `app.settings.encryption_key` e um `context` (salt) por registro para prevenir rainbow tables.

## Decision

**Usar pgcrypto via RPC `SECURITY DEFINER`** para cifrar/descifrar secrets no control plane.

Implementação:
- `app_encrypt_secret(p_value text, p_context text)` — função SECURITY DEFINER que usa `pgcrypto.encrypt(value, key || context, 'aes')`. O `context` é o `client_id` UUID do tenant — cada tenant tem salt diferente, impossibilitando ataques de rainbow table cross-tenant.
- `adm_client_decrypted_secrets(p_client_id uuid)` — SECURITY DEFINER que descifra os três campos e retorna como row. Chamada APENAS dentro de edge functions com service role key.
- `adm_clients_secrets_status()` — SECURITY DEFINER que retorna apenas `has_*` booleans — sem expor dados cifrados ou plaintext. Usado pela UI para mostrar "configurado/não configurado" sem nunca transmitir o conteúdo.

Hints em plaintext (`service_role_key_hint`, `db_password_hint`, `management_token_hint`): primeiros **4 chars** do valor + `…` (revisado em 2026-04-23, antes eram 12 — ver `FIX-ADM-01`). A UI nunca renderiza mais que 4 chars (`.slice(0, 4) + "••••"`), portanto armazenar 12 era exposição desnecessária. Migration `20260423011000_adm_hint_truncate.sql` truncou os hints existentes.

Ciclo de `encryptSecrets()` no frontend:
1. INSERT do registro com plaintext temporariamente.
2. Para cada campo secreto: chama RPC `app_encrypt_secret(value, client_id)`, salva hint (`makeHint(value)`).
3. UPDATE com blob cifrado substituindo o plaintext.
4. Se RPC falhar: mantém plaintext como fallback (preferível a perder o secret — débito rastreado).

## Consequences

**Positivo:**
- Secrets nunca em plaintext em repouso na DB (exceto janela entre INSERT e UPDATE).
- Context salt por `client_id` — comprometer um secret cifrado não ajuda a comprometer outros tenants.
- RPCs `SECURITY DEFINER` — a lógica de descifra não é acessível via queries diretas de clientes (requereria service role key para invocar as funções).
- Zero dependências externas — pgcrypto é extensão padrão do PostgreSQL/Supabase.

**Negativo / trade-offs:**
- **Janela de plaintext:** entre `INSERT adm_clients` e o `UPDATE` com cifrado, o record está em plaintext. Crash nesse intervalo deixa secret exposto. Mitigação: transação no backend seria ideal, mas a RPC de cifra requer o `id` gerado — cifragem deve acontecer após INSERT. Workaround atual: `useUpdateAdmClient` re-cifra na próxima edição.
- **Chave de cifra em `app.settings`:** se um atacante comprometer o banco do control plane com acesso a `app.settings`, pode descifrar todos os secrets. Não há key rotation implementada.
- **`management_token` sem rotação automática** — expira quando o Supabase revogar, requerendo atualização manual.
- **Hint plaintext de 4 chars** — minimal, mantido para identificação visual no formulário de edição.

**Arquivos relevantes:**
- `src/hooks/useAdmClients.ts` — `encryptSecrets()`, `insertAuditLog()`
- `supabase/migrations_adm/` — RPCs `app_encrypt_secret`, `adm_client_decrypted_secrets`, `adm_clients_secrets_status`
- `supabase/functions/adm-create-user/index.ts` — uso de `adm_client_decrypted_secrets`
- `supabase/functions/adm-sync-client/index.ts` — uso de `adm_client_decrypted_secrets`
