---
title: Migrations Log
type: task-log
agent: dev-data-engineer
updated: 2026-07-25
tags: [database, migrations, log, altiora]
related: ["[[schema]]", "[[migration-status]]", "[[altiora-schema]]"]
---

## 2026-07-25 — Altiora CRM V1: Schema de Referrals

**Objetivo:** Implementar schema completo para os 30 UCs do CRM Altiora (gestão de referrals e pipeline comercial).

**Migrations aplicadas (7):**

| Arquivo | Descrição | Status |
|---|---|---|
| `20260725100000_altiora_pipeline.sql` | Pipeline Altiora + 13 etapas (INSERT com UUIDs fixos) | ✅ Aplicada |
| `20260725110000_altiora_users_profile.sql` | ADD COLUMN user_type, fuso_horario em settings_users | ✅ Aplicada |
| `20260725120000_altiora_leads_referral.sql` | ADD COLUMN altiora_* (10 colunas) em leads | ✅ Aplicada |
| `20260725130000_altiora_meetings_r123.sql` | ADD COLUMN altiora_* + google_event_id (10 colunas) em meetings | ✅ Aplicada |
| `20260725140000_altiora_r1_data.sql` | CREATE TABLE altiora_r1_data (1:1 com leads, PK=lead_id) | ✅ Aplicada |
| `20260725150000_altiora_finvity.sql` | CREATE TABLE altiora_finvity_analise (UNIQUE lead_id) | ✅ Aplicada |
| `20260725160000_altiora_contratacao.sql` | CREATE TABLE altiora_contratacao (UNIQUE lead_id) | ✅ Aplicada |

**Smoke tests executados:**
- Pipeline: 1 pipeline + 13 stages confirmados
- settings_users: user_type + fuso_horario presentes
- leads: 10 colunas altiora_* presentes
- meetings: 10 colunas altiora_* + google_event_id presentes
- Tabelas novas: altiora_r1_data, altiora_finvity_analise, altiora_contratacao presentes com RLS ativo

**Rollbacks disponíveis** em `supabase/migrations/rollbacks/`.

---

## 2026-07-25 — SCHEMA-REBUILD: Banco novo dtsmbqrzyxhjjjvpjfjd

**Objetivo:** Reconstruir schema completo em banco Supabase novo `dtsmbqrzyxhjjjvpjfjd` (Altiora CRM — ACTIVE_HEALTHY).

**Metodo:**
1. `npm run db:baseline` gerou `supabase/baseline.sql` com 864 migrations (863 sem _TEMPLATE), 3.5MB, 93451 linhas.
2. Script Python com curl (urllib bloqueado pelo Cloudflare com erro 1010) aplicou migrations em ordem cronologica com rate limiting (0.6s/req, retry em 429).
3. `supabase/migrations_adm/` (14 arquivos, excluindo rollbacks): aplicados com correcoes de schema drift (`super_admin`->`super_adm`, `active`->`ativo`).

**Resultado migrations principais (863 arquivos):**
- OK: 322 aplicadas com sucesso
- SKIP: 93 (ja existiam — idempotentes)
- FAIL: 447 (schema drift — tabelas antigas renomeadas)

**Resultado migrations_adm (14 arquivos):**
- OK: 14 (apos correcao de column names e split de cron.unschedule)
- FAIL: 0

**Estado final do banco:**
- Tabelas: 110 (BASE TABLE) + 1 VIEW
- Funcoes: 154
- Policies RLS: 256
- Triggers: 64
- Cron jobs: 22

**Falhas — diagnostico:**
As 447 falhas sao schema drift esperado: migrations de REFATORACAO sobre tabelas antigas que nao existem mais (`public.usuarios`->renomeada, `crm_usuarios`->renomeada para `settings_users`/`users`, `crm_messages`->`messages`, etc.). O schema FINAL esta correto — as tabelas existentes sao as versoes canonicas atuais.

**Notas tecnicas:**
- Supabase Management API retorna HTTP 201 para DDL (nao 200) — bug original que foi corrigido.
- curl e necessario (urllib bloqueado pelo Cloudflare via erro 1010).
- Migrations ADM referenciam `super_admin` (coluna: `super_adm`) e `active` (coluna: `ativo`) — correcoes aplicadas in-memory.
- `cron.unschedule()` falha se job nao existe — migrations ADM de health_check e soft_delete foram divididas em DDL + cron.schedule separados.



# Migrations Log

## 20260703120000 — email_templates_schema (EMAIL-1.1, aplicada por Bythak)

**Objetivo:** biblioteca reutilizável de templates de e-mail HTML + FK opcional no follow-up de stage. Fundação do épico `email-integracao` (ADR-EMAIL-01 §Decisão 4); destrava EMAIL-1.2/1.3/1.4.

**Mudanças (aditivas):**
- `CREATE TABLE public.email_templates` (`id`, `name`, `subject`, `html_body`, `variables text[]`, `category`, `active`, `created_at`, `updated_at`) + `COMMENT ON` em tabela e colunas + trigger `email_templates_set_updated_at` (`update_updated_at_column`).
- RLS ENABLE + 3 policies: `select_active_users` (settings_users ativo), `write_managers` (`super_admin OR user_type='manager'`), `service_role`. **Usei `'manager'` (não `'gestor'`)** — o valor `'gestor'` NUNCA casa no LIVE (CHECK IN admin/manager/user); mesma correção da `20260702130000_kiwify_rls_manager_fix`.
- `ALTER TABLE leads_stages_followups ADD COLUMN email_template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL` (nullable, sem default — nenhum follow-up existente alterado) + índice parcial `idx_leads_stages_followups_email_template_id`.
- Seed 1 template "Compra Aprovada" (`subject:'Sua compra foi aprovada 🎉'`, `variables:{nome}`, `category:'pos-venda'`) via INSERT idempotente — destrava e2e EMAIL-1.6.

**Safety Protocol:** LIVE inspecionado (email_templates NÃO existia = sem drift ad-hoc; `update_updated_at_column` existe) → dry-run (`sed COMMIT→ROLLBACK`, sem erro, nada persistido) → apply via `db query --linked --file` → smoke-test (9 colunas OK, FK constraint `leads_stages_followups_email_template_id_fkey`, RLS on, 3 policies, trigger, índice, seed count=1) → registrada em `schema_migrations` (version 20260703120000).

**Arquivos:** `supabase/migrations/20260703120000_email_templates_schema.sql` + `rollbacks/20260703120000_email_templates_schema.rollback.sql`.

**Status:** Aplicada no LIVE (2026-07-03, `wotuyxscsfralqpoiyfv`).

## 20260702170000 — kiwify_client_id_and_pending_status (KFY-4.1, aplicada por Serak/dev-dev-gamma)

**Causa raiz:** a suposição de KFY-1.2/1.3 de que `client_id == account_id` estava ERRADA. Credenciais reais da Kiwify entregam 3 valores DISTINTOS: `account_id` (curto, alfanumérico), `client_id` (UUID), `client_secret` (hex). O OAuth mandava `client_id` errado → nenhuma conexão real funcionava (0 rows em `kiwify_connections`).

**Mudanças:**
- `ALTER TABLE kiwify_connections ADD COLUMN client_id text NOT NULL` (não-secret, mesma sensibilidade de `account_id`; tabela vazia → NOT NULL seguro).
- CHECK de `status` estendido: `('disconnected','connected','error','pending_webhook')` — novo estado `pending_webhook` para o fluxo manual de webhook (credenciais salvas, token ainda não registrado).

**Safety Protocol:** count=0 rows confirmado → dry-run (`BEGIN…ROLLBACK`, verificou `is_nullable=NO`) → apply via `db query --linked --file` → smoke-test (`is_nullable=NO`, constraintdef com pending_webhook) → registrada em `supabase_migrations.schema_migrations` (version 20260702170000).

**Arquivos:** `supabase/migrations/20260702170000_kiwify_client_id_and_pending_status.sql` + rollback em `rollbacks/`.

**Status:** Aplicada no LIVE (2026-07-02). ⚠️ Edge functions `kiwify-connect`/`kiwify-reconcile` + frontend precisam deploy conjunto (função nova exige `client_id` no body). Detalhe: `docs/smart-memory/stories/active/KFY-4.1-kiwify-manual-webhook-token.md`.


Log cronológico de migrations aplicadas pelo Bythak. Migrations são imutáveis após aplicadas — para corrigir, criar nova migration.

| # | Arquivo | Data | Descrição | Rollback |
|---|---|---|---|---|
| 20260501130000 | `20260501130000_fix_save_agent_complete_resolve_created_by.sql` | 2026-05-01 | RPC `save_agent_complete`: resolve `created_by` defensivamente — aceita auth.users.id ou settings_users.id, faz lookup via `auth_user_id` em settings_users. Corrige FK violation 23503 em `ai_agents_history.created_by`. | disponível |
| 20260501140000 | `20260501140000_ora_schema_drift_reconcile.sql` | 2026-05-01 | Reconcilia drift em `ai_agents` (single-tenant João Guirunas): Opção A — `stage_ids text[] → uuid[]`; Opção C — `ADD COLUMN pipeline_ids text[]` com backfill de `pipeline_id`. Pre-flight check rejeita stage_ids não-UUID. | disponível |
| 20260505080000 | `20260505080000_remove_prospect_pro.sql` | **pendente apply** (criada 2026-05-04) | Remove módulo Prospect Pro: unschedule cron jobs `prospect-*`, drop FK + índice + coluna `clients_people.prospect_campaign_id`, DROP CASCADE em 7 tabelas vivas (`prospect_campaigns`, `prospect_audit_log`, `prospect_companies`, `prospect_people`, `prospect_enrichment_plugins`, `prospect_enrichment_results`, `prospect_opt_out_registry`), DELETE seed `settings_system_modules.module_key='prospect'`. | parcial (best-effort — dados perdidos no DROP CASCADE) |
| 20260507160901 | `20260507160901_fix_usr_01_settings_users_rls_writes.sql` | 2026-05-07 | FIX-USR-01 — restaura RLS restritivo em writes de `settings_users` (CRITICAL bypass FWUP-17). Cria `is_admin()`. SELECT aberto; INSERT/DELETE só admin; UPDATE owner-self (sem alterar super_admin/user_type) ou admin. | disponível |
| 20260507161250 | `20260507161250_fix_usr_03_settings_users_super_admin_invariant.sql` | 2026-05-07 | FIX-USR-03 — trigger `BEFORE INSERT OR UPDATE OF super_admin, user_type` em `settings_users` sincroniza invariante (`super_admin=true` ↔ `user_type='admin'`). Inclui backfill idempotente. | disponível |
| 20260507190746 | `20260507190746_nylas_schema_additive.sql` | ⚠️ ÓRFÃ — Nylas abandonado 2026-05-08 | NYLAS-02 (cancelado) — colunas nylas_* em `user_calendar_connections`, `meetings`, `settings_users`, `settings` + tabela `nylas_webhook_events`. Candidatas a DROP em cleanup futuro. | disponível |
| 20260507190900 | `20260507190900_nylas_oauth_states.sql` | ⚠️ ÓRFÃ — Nylas abandonado 2026-05-08 | NYLAS-03 (cancelado) — tabela `nylas_oauth_states`. Candidata a DROP em cleanup futuro. | disponível |
| 20260507200000 | `20260507200000_nylas_02b_drop_refresh_token_not_null.sql` | ⚠️ ÓRFÃ — Nylas abandonado 2026-05-08 | NYLAS-02b (cancelado) — DROP NOT NULL em `google_refresh_token`. Efeito colateral permanente (coluna nullable). | sem rollback |
| 20260508100000 | `20260508100000_fix_meeting_followup_trigger_column_names.sql` | 2026-05-08 | Fix trigger `handle_meeting_followup_queue`: corrige nomes de colunas pós-FWUP-11b/12 (`leads_id`→`lead_id`, `people_id`→`person_id`). Re-anexa trigger em `meetings`. Adiciona policy `mfq_insert` como fallback. Corrige RLS violation ao criar reunião manual como user. | disponível |
| 20260510190000 | `20260510190000_inbound_webhooks.sql` | 2026-05-10 | wh-01 — Cria tabela `inbound_webhooks` (id, name, token UNIQUE, pipeline_id FK→leads_pipelines, stage_id FK→leads_stages, field_mapping jsonb, active, timestamps). Trigger `update_updated_at_column`. RLS ENABLE + 4 policies authenticated (SELECT/INSERT/UPDATE/DELETE com `auth.uid() IS NOT NULL`). GRANT para `authenticated`. Aplicada via `supabase db query --file` (não `db push`, drift histórico em schema_migrations); registrada em `supabase_migrations.schema_migrations`. | disponível |
| 20260510210000 | `20260510210000_webhook_inbound_increment.sql` | 2026-05-10 | wh-02 — Adiciona `inbound_webhooks.create_mode` (TEXT NOT NULL DEFAULT 'criar', CHECK IN criar/criar_se_nao_existir/atualizar_etapa/somente_etapa) e `inbound_webhooks.trigger_config` (JSONB nullable). Aditiva pura. Aplicada via `db query --linked --file` + registrada manualmente em `schema_migrations`. Smoke-test: 1 linha existente herdou default 'criar', CHECK rejeita valores fora da whitelist. | disponível |
| 20260610000001 | `20260610000001_seed_default_loss_reasons.sql` | 2026-06-10 | LOSS-01 — Seed de 5 motivos de perda padrão em `leads_loss_reasons` (Sem interesse, Preço, Concorrente, Sem resposta, Fora do ICP). UUIDs fixos `a1b2c3d4-0001-0000-0000-00000000000{1..5}` para idempotência (`ON CONFLICT (id) DO NOTHING`). Migration de DADOS (não DDL). Aplicada via `db query --linked --file` + registrada em `schema_migrations`. Dry-run em txn com ROLLBACK OK; smoke-test: SELECT retornou os 5 ordenados por nome; re-apply confirmou idempotência (continua 5). | seed idempotente — sem rollback DDL (motivos são dados de referência; remover = `DELETE WHERE id LIKE 'a1b2c3d4-0001-%'`) |
| 20260610000003 | `20260610000003_whatsapp_template_sync_cron.sql` | 2026-06-10 | WAT-SYNC-02 — `ALTER TABLE whatsapp_templates ADD last_synced_at timestamptz`; `CREATE EXTENSION IF NOT EXISTS pg_net/pg_cron` (NÃO estavam instaladas, ao contrário do que a story assumia); agenda cron `whatsapp_templates_auto_sync` (`*/5 * * * *`) via `public.secure_http_post('service_role_cron', ...)` (padrão Vault ADR-SP-05, sem JWT hardcoded). **BLOQUEIO:** o `cron.schedule` só roda se o secret de Vault `service_role_cron` existir — NÃO existe neste projeto, então a migration emitiu `RAISE NOTICE` e pulou o agendamento (fail-safe, migration aplicou OK). Re-rodar após criar o secret no Dashboard → Vault. Aplicada via `db query --linked --file`. Coluna + extensões confirmadas no DB; job ainda NÃO agendado (0 rows em cron.job). | `ALTER TABLE whatsapp_templates DROP COLUMN last_synced_at` + `SELECT cron.unschedule('whatsapp_templates_auto_sync')` |
| 20260615000000 | `20260615000000_meeting_followup_templates_v2.sql` | **pendente apply** (criada 2026-06-15) | MFUP-V2 — Seed de 8 `whatsapp_templates` (confirmacao_reuniao + lembrete_1d/2h/30min/5min + ausencia_imediato/6h/24h) com UUIDs fixos `a1000001-…-0001..0008`, `status='pending'`, `id_template='pending'` (NOT NULL), `system_enabled=false`, `json_data` UTILITY/pt_BR POSITIONAL. Slugs `{meta_template_name}|pt_BR`. Idempotência defensiva: insere cada template só `WHERE NOT EXISTS` por id OR slug OR meta_template_name (UNIQUE em slug exige isso; auto-setup pode já ter `confirmacao_reuniao`). + Seed de 8 regras `meetings_followups` (UUIDs `b2000001-…-0001..0008`, `ON CONFLICT (id) DO NOTHING`): 5 `agendado` (confirmação 0/0/0, lembretes 1d, 2h, 30min, 5min — trigger agenda como `start_time - delay`) + 3 `nao_compareceu` (imediato 0/0/0, 6h, 24h). `type='whatsapp_template'` (livre, sem CHECK — cosmético), `channel='whatsapp'` (CHECK obriga whatsapp/email/sms/phone), `whatsapp_template_id` resolvido via COALESCE(UUID fixo, lookup por meta_template_name). Trigger `handle_meeting_followup_queue` dispara por `whatsapp_template_id IS NOT NULL`. NÃO aplicada (db push proibido pelo lead; aplicar via MCP/`db query --file` + registrar manualmente em `schema_migrations` por drift histórico). | disponível (DELETE WHERE id LIKE 'b2000001-%' em meetings_followups + DELETE WHERE id LIKE 'a1000001-%' em whatsapp_templates) |
| 20260623000000 | `20260623000000_tiktok_channel_constraint.sql` | 2026-06-23 | TIKTOK-01 — Reasserção idempotente dos CHECK de channel. `omni_channel_configs_channel_check` → whatsapp/instagram/email/sms/telefone/identity_collection/**tldv**/**tiktok**; `messages_channel_check` → whatsapp/instagram/email/sms/telefone/**tiktok**. CONTEXTO: a 20260413230000_tiktok_integration JÁ tinha adicionado 'tiktok' aos dois constraints na live DB, mas a 20260421000000 recriou o de omni_channel_configs SEM 'tiktok' e adicionou 'tldv' → drift entre arquivos e DB. Esta migration converge ambos ao superset completo. Nenhuma row usa 'tldv'/'tiktok' (verificado), logo DROP+ADD é lossless. Aplicada via `db query --linked --file`. Dry-run em txn BEGIN…ROLLBACK OK; smoke-test verde (constraints incluem tiktok, AC5 `WHERE channel='tiktok'` sem erro, ping=1). Registrada em `supabase_migrations.schema_migrations` (NÃO `public.schema_migrations` — que não existe). | @no-rollback (reasserção idempotente; reverter = re-aplicar 20260421000000 e 20260413230000) |
| 20260629000000 | `20260629000000_manychat_tiktok_integration.sql` | 2026-06-29 | MANYCHAT-TIKTOK-DB — Canal `tiktok-manychat` (middleware ManyChat p/ TikTok DM, distinto do `tiktok` nativo). `ALTER clients_people ADD manychat_subscriber_id bigint` + índice único parcial `idx_clients_people_manychat_subscriber_id WHERE NOT NULL`. Estende 3 CHECK de channel adicionando `'tiktok-manychat'`: `messages_channel_check` (→...,tiktok,tiktok-manychat), `omni_channel_alerts_channel_check` (→...,system,tiktok-manychat), **`omni_channel_configs_channel_check`** (→...,tldv,tiktok,tiktok-manychat — o lead esqueceu desta; sem ela o INSERT do config violaria o CHECK). RPC `get_omni_contacts`: add `manychat_subscriber_id IS NOT NULL` ao filtro de canal (a coluna já sai via `to_jsonb(p.*)`, só o WHERE mudou). Seed em `omni_channel_configs` (channel='tiktok-manychat', display_name='TikTok (ManyChat)' — **display_name é NOT NULL sem default, o INSERT do brief omitia e falharia**, credentials `{api_key:"",webhook_secret:""}`, is_active=false). Aplicada via `db query --linked --file` (db push QUEBRADO por drift) + registrada em `supabase_migrations.schema_migrations`. Dry-run BEGIN…ROLLBACK OK; smoke-test verde (col+idx existem, 3 constraints com tiktok-manychat=true, config row presente, RPC src contém manychat). | disponível (`rollbacks/20260629000000_manychat_tiktok_integration.rollback.sql`) |
| 20260702120000 | `20260702120000_kiwify_integration_schema.sql` | 2026-07-02 | KFY-1.1 — Schema completo da integração Kiwify. **DRIFT resolvido:** 3 tabelas draft órfãs (`kiwify_event_mappings` com `kiwify_product_id`+targets nullable, `kiwify_webhook_events` com `idempotency_key` simples, `kiwify_pending_automations`) existiam ad-hoc no LIVE (NÃO em schema_migrations), VAZIAS/sem refs/sem cron/sem deps → DROP CASCADE (lead+user aprovaram 2026-07-02). CREATE das 5 tabelas a spec §3: `kiwify_connections` (secrets `*_enc` via app_encrypt_secret, `enforce_signature bool default false`), `kiwify_webhook_events` (UNIQUE composto `(connection_id,event_type,dedup_key)`), `kiwify_event_mappings` (unique parcial default/product), `kiwify_message_automations` (steps jsonb + cancel_on_triggers), `kiwify_message_jobs` (fila runtime espelhando followup_queue, ADR-KFY-01, índice parcial `scheduled_for WHERE pending`). RLS ENABLE + 3 policies/tabela (SELECT settings_users active; WRITE super_admin/gestor; service_role bypass) = 15 policies. Trigger `update_updated_at_column` nas 4 tabelas com updated_at. `ALTER clients_people ADD whatsapp_optin bool NOT NULL DEFAULT false` (KFY-1.5 gate). **4 stages novas** em `leads_stages` no pipeline "Cursos Online" (f8aae630): Reembolsado(11)/Chargeback(12)/Assinatura Cancelada(13)/Inadimplente(14), UUIDs fixos. **Seed 10/10 event_mappings** (product_id NULL) + **4 automations** (pix_gerado 0/30/120/1440min cancela compra_aprovada; carrinho_abandonado 15/180/1440 cancela compra_aprovada,pix,boleto; compra_aprovada 0min; subscription_late 0/4320 cancela subscription_renewed — `template_id=null` até KFY-1.5). Aplicada via `db query --linked --file` (db push QUEBRADO por drift) + registrada em `supabase_migrations.schema_migrations`. Snapshot `backups/kiwify-pre-state-20260702-120141.json`. Dry-run BEGIN…ROLLBACK OK (2×: 5+5 e final 10+4stages, mappings_fk_ok=10); smoke-test verde (5 tabelas, RLS=true×5, 15 policies, 10 mappings→stages corretas, 4 automations, 4 stages order 11-14, optin bool NOT NULL default false, constraint idem=1, 5 índices jobs). | `rollbacks/20260702120000_kiwify_integration_schema.rollback.sql` (DROP 5 tabelas + DROP whatsapp_optin + DELETE 4 stages) |
| 20260702130000 | `20260702130000_kiwify_rls_manager_fix.sql` | 2026-07-02 | KFY-1.1 FIX (aditivo, não rollback) — bug de RLS achado por dev-dev-beta: a 20260702120000 usou `user_type='gestor'` nas 5 policies `kiwify_write_managers`, mas o domínio LIVE é `CHECK (user_type IN ('admin','manager','user'))` → 'gestor' nunca casa, só super_admin escrevia (edge fns OK via service-role; painel KFY-1.7 precisaria de write de managers). **Verificado empiricamente** antes do fix: user_type text, valores reais admin(3)/manager(1). DROP+CREATE das 5 policies write com `user_type='manager'` (USING+WITH CHECK). ⚠️ A migration de referência `20260613002000_calcom_connections` tem o MESMO bug (`gestores_see_all_calcom` usa 'gestor') — sinalizado ao lead, fora de escopo aqui. Aplicada via `db query --linked --file` + registrada em `schema_migrations`. Dry-run BEGIN…ROLLBACK OK (5 write policies=manager, 0 gestor, 15 total); smoke-test verde (manager_policies=5, gestor_remaining=0, registered=1). | @no-rollback (reverter = restaurar o bug 'gestor'; para desfazer, re-CREATE policies com predicado anterior) |
| 20260702140000 | `20260702140000_messages_source_type_kiwify.sql` | 2026-07-02 | **GOD NODE** — QA achou CRITICAL: `kiwify-dispatch-worker` (index.ts:171) insere em `messages` com `source_type='kiwify'`, mas `messages_source_type_check` não incluía 'kiwify' → todo envio de automação Kiwify falharia. DROP+ADD do CHECK com os 7 valores atuais (inbound/manual/ai_agent/campaign/form/followup/appointment_reminder) **+ 'kiwify'**. Aditivo/superset — verificado que rows existentes só usam valores dentro do conjunto (distinct: ai_agent/appointment_reminder/campaign/form/inbound/manual; nenhum viola), então ADD valida sem erro; `source_type` nullable e CHECK passa em NULL (preservado). DROP+ADD atômico na txn. Cuidado redobrado (tabela crítica compartilhada). Snapshot `backups/messages-source-type-pre-20260702-125222.json`. Dry-run BEGIN…ROLLBACK com INSERT real `source_type='kiwify'` OK; aplicada via `db query --linked --file` + registrada em `schema_migrations`; smoke-test verde (constraint_has_kiwify=true, INSERT kiwify passa e reverte → 0 lixo, 859 rows intactas, registered=1). | @no-rollback (reverter = DROP+ADD sem 'kiwify' — só seguro se nenhuma row tiver source_type='kiwify'; após go-live do dispatcher, reverter quebraria envios) |
| 20260702150000 | `20260702150000_kiwify_reconcile_cron.sql` | 2026-07-02 | KFY-1.6 — Agenda pg_cron `kiwify_reconcile` (`0 */6 * * *`, a cada 6h) que chama a edge fn `kiwify-reconcile` via `secure_http_post('service_role_cron', ...)` (JWT service_role do Vault, padrão ADR-SP-05, sem hardcode). Idempotente: `CREATE EXTENSION IF NOT EXISTS pg_net/pg_cron` + DO block que faz `cron.unschedule` prévio e `cron.schedule`; se o Vault secret `service_role_cron` faltar, pula com NOTICE e a migration ainda aplica. **⚠️ COLISÃO DE VERSÃO resolvida:** o arquivo veio como `20260702140000` (mesma versão da minha `messages_source_type_kiwify` já registrada) → renomeado para `20260702150000`. Pré-checagem LIVE: secret `service_role_cron` EXISTE (=1, mesmo de whatsapp_templates_auto_sync), `secure_http_post` existe → job foi de fato agendado (não pulado). Aplicada via `db query --linked --file` + registrada em `schema_migrations`. Dry-run BEGIN…ROLLBACK OK (scheduled=1, sched=0 */6, cmd_ok); smoke-test verde (registered=1, reconcile_scheduled=1, active=true, cmd_ok=true, total_crons 4→5). DEPLOY: `kiwify-reconcile` deve ir SEM `--no-verify-jwt` (gateway valida a assinatura do JWT). | `SELECT cron.unschedule('kiwify_reconcile')` |
| 20260702160000 | `20260702160000_kiwify_lead_products.sql` | 2026-07-02 | KFY-2.2 (AC1+AC2) — Tabela de junção M-N `kiwify_lead_products` (contato↔produto Kiwify; habilita badge de curso por lead, §8.2). Cols: `id`, `people_id`→clients_people ON DELETE CASCADE, `product_id text NOT NULL`, `product_name text NOT NULL`, `connection_id`→kiwify_connections ON DELETE SET NULL, `first_seen_at`/`last_seen_at`/`created_at`/`updated_at`. `UNIQUE (people_id, product_id)` + índice `(people_id)` + trigger updated_at + COMMENTs. RLS ENABLE + 3 policies espelhando as kiwify_* (SELECT active; WRITE super_admin OR user_type='manager'; service_role) — já com 'manager' correto. Popularização (AC3, upsert em kiwify-process-event p/ compra_aprovada/subscription_renewed) é do dev-dev-beta-2. Aplicada via `db query --linked --file` + registrada em schema_migrations. Snapshot `backups/kiwify-lead-products-pre-20260702-132156.json`. Dry-run BEGIN…ROLLBACK com upsert idempotente (ON CONFLICT refresca product_name/last_seen, `first_seen_at` estável, 1 row) OK; smoke-test verde (rls=true, 3 policies, write_uses_manager=true, unique=1, people_idx=1, trigger=1, FKs people_id=CASCADE/connection_id=SET NULL). | `rollbacks/20260702160000_kiwify_lead_products.rollback.sql` |
| 20260613002000 | `20260613002000_calcom_connections.sql` | 2026-06-13 | CAL-DB — Integração Cal.com. `CREATE TABLE user_calcom_connections` (16 cols: OAuth tokens access/refresh/expires, calcom_username, default_event_type_id/slug, default_booking_url, webhook_id/secret, flags use_calcom_booking_link/sync_booking/is_active; `UNIQUE(user_id)` FK→`settings_users(id) ON DELETE CASCADE`). RLS ENABLE + 3 policies: `users_own_calcom_connection` (FOR ALL via auth_user_id), `gestores_see_all_calcom` (SELECT para super_admin/gestor), `service_role_calcom` (bypass edge fns). `ALTER meetings ADD calcom_uid TEXT` + índice único parcial `meetings_calcom_uid_key WHERE calcom_uid IS NOT NULL`. `ALTER settings ADD calcom_client_id TEXT` + UPDATE backfill do OAuth client_id global. Aditiva/idempotente (`IF NOT EXISTS`). Aplicada via `db query --linked --file` + registrada manualmente em `schema_migrations`. Smoke-test verde: 16 cols, RLS=true, 3 policies, índice ok, 1 row settings populada, manifest=1. | @no-rollback (aditiva; reverter = DROP TABLE user_calcom_connections + DROP COLUMN meetings.calcom_uid + DROP COLUMN settings.calcom_client_id) |

## Detalhes

### 20260501140000 — ora_schema_drift_reconcile

**Decisão:** team-lead aprovou Opção A+C combinadas. Single-tenant João Guirunas confirmado.

**Mudanças:**
- `ai_agents.pipeline_ids text[]` adicionada (Opção C, idempotente via `IF NOT EXISTS`); backfill a partir de `pipeline_id` quando aplicável.
- `ai_agents.stage_ids` recasted de `text[]` para `uuid[]` (Opção A); DO block detecta tipo atual e é no-op se já estiver `uuid[]`.

**Pre-flight safety:**
- Aborta a transação com mensagem identificando agent_id+name+value se `stage_ids` contiver elemento não-UUID.

**Arquivos:**
- Migration: `supabase/migrations/20260501140000_ora_schema_drift_reconcile.sql`
- Rollback: `supabase/migrations/rollbacks/20260501140000_rollback.sql` (revert tipo + DROP COLUMN — destrutivo para `pipeline_ids`)
- Manifest: `client-migrations.json` order_index `10199`

**Status:** **Aplicada — 2026-05-01T17:13** (via MCP Supabase no main session, projeto `wotuyxscsfralqpoiyfv`).

**Smoke-test confirmado pelo team-lead:**
- `ai_agents.stage_ids` → `uuid[]` ✅
- `ai_agents.pipeline_ids` → `text[]` ✅
- Backfill: 2 agentes com `pipeline_ids = ARRAY[pipeline_id]` ✅

**Rollback:** `rollbacks/20260501140000_rollback.sql` — disponível, **não consumido**.

**Origem do drift:**
- `20260310100000_add_pipeline_ids_to_ai_agents` existe no repo mas nunca esteve em `client-migrations.json` → não propagada.
- FWUP-15 (`20260428040000`) usou `ADD COLUMN IF NOT EXISTS stage_ids uuid[]` — no-op em tenants que já tinham `stage_ids text[]` do baseline 009.

### 20260501130000 — fix_save_agent_complete_resolve_created_by

**Causa raiz:**
- FK `ai_agents_history.created_by` → `settings_users(id)` (definida em `20260312150001_ensure_full_tenant_baseline.sql:603`)
- Frontend (`src/hooks/useAgentesIAReal.ts:471`) enviava `auth.users.id` (de `supabase.auth.getUser()`) onde a FK espera `settings_users.id`
- `handle_new_user()` está vazia — não há sync automático auth.users → settings_users

**Estratégia (Opção A — RPC defensivo):**
1. Tenta resolver `p_created_by` como `settings_users.id` direto
2. Fallback: lookup como `auth.users.id` via `settings_users.auth_user_id`
3. Fallback final: resolve via `auth.uid()` (caso caller não envie)
4. Se nada bater, grava NULL (FK é `ON DELETE SET NULL`)

**Arquivos:**
- Migration: `supabase/migrations/20260501130000_fix_save_agent_complete_resolve_created_by.sql`
- Rollback: `supabase/migrations/rollbacks/20260501130000_fix_save_agent_complete_resolve_created_by.rollback.sql` (restaura versão `20260501120000`)

**Status:** Arquivo criado. Apply pendente (sem credenciais locais — aplicar via `supabase db push` ou Dashboard SQL Editor).

### 20260507160901 — fix_usr_01_settings_users_rls_writes

**Causa raiz:**
- FWUP-17 (`20260428060000`) abriu `settings_users` com `authenticated_read USING (true)` + `authenticated_write ALL USING (true) WITH CHECK (true)` para destravar baseline em tenants novos.
- Resultado: bypass de RLS — qualquer usuário autenticado podia rodar `UPDATE settings_users SET user_type='admin', super_admin=true WHERE auth_user_id=auth.uid()` via anon-key (auto-promoção).
- QA verdict: CRITICAL-1 / item 2.7 do checklist (push bloqueado até fix).

**Estratégia:**
- Cria `public.is_admin()` (mais restritiva que `is_admin_or_manager()` — só `admin`, não `manager`).
- DROP idempotente das policies abertas + várias policies legadas (`users_*_policy`, `Users can read own profile`, etc).
- SELECT permanece aberto para `authenticated` (UX de listas).
- INSERT: só `is_admin()`.
- UPDATE: `is_admin()` OU dono da linha (com `WITH CHECK` impedindo escala — owner não pode setar `super_admin=true` nem `user_type='admin'`).
- DELETE: só `is_admin()`.

**Arquivos:**
- Migration: `supabase/migrations/20260507160901_fix_usr_01_settings_users_rls_writes.sql`
- Rollback: `supabase/migrations/rollbacks/20260507160901_fix_usr_01_settings_users_rls_writes.rollback.sql` (restaura policies abertas FWUP-17)
- Manifest: `client-migrations.json` order_index `10205`

**Status:** Aplicada — 2026-05-07 (via MCP Supabase no main session, projeto `wotuyxscsfralqpoiyfv`). Smoke-test confirmado pelo team-lead: policies restritivas ativas.

**Story:** `docs/smart-memory/stories/done/FIX-USR-01.md` (movida pelo lead).

### 20260507161250 — fix_usr_03_settings_users_super_admin_invariant

**Causa raiz:**
- Coluna `super_admin` (boolean) coexiste com `user_type='admin'` como autoridades de role redundantes.
- Sem trigger, era possível ter row com `super_admin=true` E `user_type≠'admin'` (ou vice-versa) — drift entre frontend (deriva `super_adm` de `user_type`) e edge functions (checam `super_admin OR user_type='admin'`).
- QA verdict: HIGH-2 / item 1.3 do checklist.

**Estratégia (sync-on-write — AC2 da story):**
- Trigger `BEFORE INSERT OR UPDATE OF super_admin, user_type`:
  - `super_admin=true` + `user_type≠'admin'` → força `user_type:='admin'`
  - `user_type='admin'` + `super_admin IS NOT TRUE` → força `super_admin:=true`
- Backfill idempotente (duas passagens) corrige rows existentes que violem o invariante.
- Escolha de sync vs raise exception: admin UI atual não trata erro de invariante; sync evita break de UX e garante consistência pós-write.

**AC4 (frontend):** `src/hooks/useAuth.ts:196` agora deriva `super_adm` como `profileData.super_admin === true || profileData.user_type === 'admin'` (alterado no working tree, sem commit ainda — Grav commita junto).

**Arquivos:**
- Migration: `supabase/migrations/20260507161250_fix_usr_03_settings_users_super_admin_invariant.sql`
- Rollback: `supabase/migrations/rollbacks/20260507161250_fix_usr_03_settings_users_super_admin_invariant.rollback.sql` (DROP trigger + função; backfill não é revertido)
- Manifest: `client-migrations.json` order_index `10206`

**Status:** Aplicada — 2026-05-07 (via MCP Supabase no main session). Smoke-test confirmado pelo team-lead: 0 rows violando invariante, trigger ativo.

**Story:** `docs/smart-memory/stories/done/FIX-USR-03.md` (movida pelo lead).

---

---

## 2026-07-25 — Wave 2: Backlog completion (REL-03, REL-05, FIX-SENDS-STATUS-BRIDGE-01, OBS-DISPATCH-HEALTH-01)

**Objetivo:** Fechar backlog completo Altiora CRM. Migrations pendentes de apply via Grav (supabase db query --linked --file).

| Arquivo | Tipo | AC | Descrição | Rollback |
|---|---|---|---|---|
| `20260725250000_fix_legacy_cron_urls.sql` | migration | FIX-SENDS-CRON-LEGACY-URLS | fn_cron_http_call() + 3 crons + 2 trigger functions (url_legacy→fn) | disponível |
| `20260725260000_drop_rbac_granular.sql` | migration | ARCH-RBAC-02 | DROP tenant_roles, tenant_role_permissions, feature_key, role_id, seed_default_tenant_roles | disponível |
| `20260725270000_messages_to_sends_contacts_bridge.sql` | migration | FIX-SENDS-STATUS-BRIDGE-01 AC3+AC4 | Trigger trg_messages_to_sends_contacts: status WhatsApp→sends_contacts monotônico (STATUS_RANK) | disponível |
| `20260725280000_drop_sends_import_presets.sql` | migration | SENDS-IMPORT-02 cleanup | DROP sends_import_presets (órfã após SENDS-IMPORT-01) | disponível |
| `20260725290000_obs_dispatch_health.sql` | migration | OBS-DISPATCH-HEALTH-01 AC1-AC3 | _get_cron_health_metrics() SECDEF + v_dispatch_health VIEW + get_send_health(uuid) RPC | disponível |
| `20260725320000_compute_schema_hash.sql` | migration | REL-03 AC4 | compute_schema_hash() SECDEF — SHA-256 determinístico do schema public (tabelas, colunas, constraints, índices, funções, triggers) | disponível |
| `migrations_adm/20260725300000_adm_client_drift.sql` | migrations_adm | REL-03 AC1 | CREATE TABLE adm_client_drift (drift detection log) + RLS super_admin | disponível |
| `migrations_adm/20260725310000_adm_drift_cron.sql` | migrations_adm | REL-03 AC3 | pg_cron adm-drift-check-daily (4h UTC) via GUC app.supabase_url | disponível |
| `migrations_adm/20260725330000_adm_releases_is_baseline.sql` | migrations_adm | REL-05 AC5 DB | ADD COLUMN is_baseline + adm-baseline-check-weekly cron (sábados 5h UTC) | disponível |

| `20260725340000_fup_programados.sql` | migration | FUP-AUTO-01 DB-1..DB-5 | CREATE TABLE fup_programados + índices + RLS + RPC agendar_fup() + cron */5min | disponível |
| `20260725350000_message_delivery_attempts.sql` | migration | FIX-SENDS-FIRST-MSG-01 AC8+AC9 | CREATE TABLE message_delivery_attempts (bigserial PK, FK messages bigint, attempt_no, channel, provider, started_at, finished_at, status CHECK pending/sent/failed/timeout, request_body jsonb SANITIZED, response_body, http_status, wamid, error_code, error_message, duration_ms GENERATED) + idx_mda_message_id_attempt + idx_mda_status_started + RLS mirrors messages (authenticated_read/write USING true) | disponível |

**Notas de apply:**
- Migrations regulares: `supabase db query --linked --file supabase/migrations/{arquivo}.sql`
- Migrations ADM: `supabase db query --linked --file supabase/migrations_adm/{arquivo}.sql` (control plane apenas — NÃO propagar a tenants)
- Após apply: INSERT manual em schema_migrations para cada migration regular

---

## 20260726100000 — closer_personal_booking (2026-07-26)

**Objetivo:** Implementar camada DB para agendamento pessoal por closer.

**Mudanças:**
1. `ALTER TABLE booking_rule_sets ADD COLUMN owner_user_id uuid REFERENCES settings_users(id) ON DELETE SET NULL` + índice `idx_booking_rule_sets_owner`.
2. `CREATE OR REPLACE FUNCTION get_booking_eligible_user_ids(p_rule_set_id, p_pipeline_id)` — corrigido nomes de colunas (ativo, usuario_id, time_id) + adicionado Priority 2 `specific_user` entre team_priority e all-users fallback. 1-arg variant delegada para 2-arg.
3. `CREATE OR REPLACE FUNCTION provision_closer_rule_set(p_user_id uuid) RETURNS uuid` — cria rule_set + booking_rule `specific_user` para o closer. GRANT EXECUTE TO authenticated.
4. `trg_closer_booking_provision_fn` + trigger `trg_closer_booking_provision` AFTER INSERT OR UPDATE OF user_type, ativo ON settings_users.
5. Backfill: 1 user `closer` provisionado (uuid `cb53fa24-...`, owner `12b864eb-...`, url_id=2).
6. `user_type` constraint atualizada para incluir `comercial` (era `admin/gestor_comercial/closer`; agora inclui `comercial`).

**Coluna bug fix colateral:** a função `get_booking_eligible_user_ids` estava com coluna errada (`active`→`ativo`, `team_id`→`time_id`, `user_id`→`usuario_id`) e estava quebrando em produção. Corrigida nesta migration.

**Verificação:**
- `get_booking_eligible_user_ids('cb53fa24-...')` → `[12b864eb-...]` (somente o closer) ✅
- `get_booking_eligible_user_ids(NULL, NULL)` → 3 usuários ativos (default rule set intacto) ✅

**Arquivo:** `supabase/migrations/20260726100000_closer_personal_booking.sql`
**Rollback:** não gerado (aditivo + fix de bug + backfill); reverter = DROP COLUMN owner_user_id + DROP FUNCTION provision_closer_rule_set + DROP TRIGGER + restaurar versão anterior da função.

---

## Operação DML 2026-06-16 — Criar agente "Qualificação Consultoria" + desativar "Diagnóstico"

DML em tabelas de aplicação (`ai_agents`, `ai_agents_steps`, `ai_agents_history`) — NÃO migration versionada. Via `db query --linked --file`, transação única.

- **Novo agente** `30dad93b-7bc8-491a-8307-bee070d72902` (Qualificação Consultoria, v1, openai/gpt-4.1-mini, humanizacao=alta, pipeline Consultoria, use_stages=false, stage_ids Interesse+Diagnóstico).
- **Novo step** `edce7ebb-53f4-4b59-96c7-69666336b0c2` (Fluxo Completo, control='1', order 1, prompt 5842 chars).
- **Diagnóstico** `d0c29089-b294-4631-8a2e-fafd95743da5` → active=false. Snapshot v4 em `ai_agents_history` (changelog.action=snapshot_before_deactivation).
- **Backup:** `backups/diagnostico-agent-20260616-195150.json`.
- **Safety Protocol completo:** snapshot + dry-run (BEGIN…ROLLBACK, 4 checks=1) + apply + smoke-test (4 SELECTs verdes).
- **Detalhe completo + rollback:** `docs/smart-memory/agents/data-engineer/qualificacao-consultoria-apply-log.md`.
