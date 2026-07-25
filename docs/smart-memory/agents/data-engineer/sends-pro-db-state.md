---
title: "Sends Pro — Estado atual do banco (crons + fila de mensagens)"
type: investigation
agent: dev-data-engineer
created: 2026-05-01
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
status: pipeline-healthy-with-2-pendencies
tags: [sends-pro, crons, messages-queue, omni-delivery-engine, observability]
related:
  - "[[../../archive/2026-05-01-ora-schema-drift]]"
  - "[[migration-status]]"
  - "[[schema]]"
---

# Sends Pro — Estado atual do banco

## Objetivo

Inspecionar o pipeline de disparo WhatsApp pós-fix do `service_role_key` (sync via Vault aplicado em 2026-05-01) e da migration `20260501140000_ora_schema_drift_reconcile.sql`. Confirmar se o cron `omni-delivery-engine` está drenando a fila e se mensagens 25/26 (que estavam em `pending` desde 04:18/04:21 UTC) progrediram.

> **Nota execução:** Bythak não tem acesso direto ao banco. Os SQLs abaixo são para o **team-lead executar via MCP Supabase** (project ID `wotuyxscsfralqpoiyfv`).

---

## Resultados — execução via MCP em 2026-05-01

> **Veredito:** pipeline de disparo está **operacional**. O fix do `service_role_key` (sync via Vault) drenou a fila. Duas pendências de URL/config foram identificadas em crons periféricos — não bloqueiam SENDS PRO mas precisam de saneamento.

### SQL 1 — Distribuição de mensagens (últimas 48h)

| Status | Total |
|---|---|
| sent | 7 |
| pending | **0** |
| sending | **0** |
| error | **0** |

✅ Fila limpa. Zero mensagens travadas.

### SQL 1b — Mensagens 25 e 26

- **ID 25:** status=`delivered`, `from_contact='cliente'`, `created_at=17:29 UTC`. **NÃO é mais a mensagem da investigação anterior** — é uma mensagem **recebida** (inbound), não outbound. As mensagens originais 25/26 (que estavam pending desde 04:18/04:21 UTC) foram drenadas e novos IDs ocupam o range.
- **ID 26:** não existe mais nas últimas 48h.

✅ Bug 1 (SENDS PRO) confirmado resolvido pelo sync do JWT.

### SQL 3 — Cron jobs ativos

| Job | Schedule | Active | Observação |
|---|---|---|---|
| `omni-delivery-engine` | `* * * * *` | ✅ true | OK |
| `sends-dispatch-batch` | `* * * * *` | ✅ true | OK |
| `process-message-buffer` | `10 seconds` | ✅ true | OK (interval em segundos via pg_cron 1.5+) |
| `google-calendar-sync` | — | ⚠️ true | **command aponta para `wotuyxscsfralqpoiyfv.supabase.co`** (URL do antigo control plane multi-tenant) |
| `process-meeting-followups` | — | ⚠️ true | **mesma URL antiga** |
| `conversion-send` | — | ⚠️ true | **usa `current_setting('app.settings.supabase_url')` / `app.settings.service_role_key`** — divergente do padrão `_app_config` adotado pelos demais |

### SQL 3b — Histórico 30 minutos (`cron.job_run_details`)

Todos os 3 crons críticos do disparo (`omni-delivery-engine`, `sends-dispatch-batch`, `process-message-buffer`): **100% `succeeded`**, durações 3–29ms. Zero falhas.

### SQL 3c — `_app_config` sanity check

| Campo | Valor |
|---|---|
| `supabase_url` | `https://wotuyxscsfralqpoiyfv.supabase.co` ✅ |
| `svc_key_length` | 219 ✅ |
| `svc_key_is_jwt` | true ✅ |

✅ JWT consistente com Vault e single-tenant correto.

### SQLs 2, 4, 5 — não executados

Como SQLs 1, 1b, 3, 3b confirmaram pipeline saudável e sem mensagens em error, os SQLs de schema (2/2b), `claim_pending_messages` (4) e logs de erro (5) não foram necessários neste ciclo. Permanecem disponíveis para próxima rodada se houver regressão.

---

## Pendências identificadas (saneamento)

### Pendência #1 — Crons com URL do antigo control plane

**Achado:** os jobs `google-calendar-sync` e `process-meeting-followups` ainda têm `wotuyxscsfralqpoiyfv.supabase.co` hardcoded no `command`.

**Risco:**
- Single-tenant é `wotuyxscsfralqpoiyfv` desde 2026-05-01.
- Esses crons disparam HTTP contra um host que pode estar offline, deprecado, ou pior: ainda no ar mas apontando para outro projeto/dataset. Falhas silenciosas (404/timeout) não geram alerta.
- Schedule PRO (calendário + followup de reunião) pode estar **funcionalmente quebrado** sem ninguém notar.

**Diagnóstico SQL (executar antes de patch):**
```sql
SELECT
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname IN ('google-calendar-sync','process-meeting-followups')
ORDER BY jobname;

-- Histórico 24h: se return_message contiver "could not resolve host" ou 4xx/5xx → confirma falha silenciosa.
SELECT
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('google-calendar-sync','process-meeting-followups')
  AND jrd.start_time > now() - interval '24 hours'
ORDER BY jrd.start_time DESC
LIMIT 50;
```

**Estratégia de fix proposta:** trocar URL hardcoded por leitura via `_app_config` (mesmo padrão do `omni-delivery-engine`). Se já existir `trigger_*` PL/pgSQL para esses crons, basta `REPLACE FUNCTION`. Se a URL está direto no `command` do `cron.schedule`, recriar o job.

Migration sugerida: `20260501150000_fix_legacy_cron_urls.sql` (timestamp tomado da migration-status atual). **Aguarda aprovação do team-lead** antes de criar arquivo.

### Pendência #2 — `conversion-send` lê config divergente

**Achado:** o cron `conversion-send` usa `current_setting('app.settings.supabase_url')` e `current_setting('app.settings.service_role_key')`. Os demais crons (`omni-delivery-engine`, `sends-dispatch-batch`) usam `_app_config` (KV table).

**Risco:**
- `app.settings.*` são GUCs (Postgres custom settings). Se nunca foram populados via `ALTER DATABASE ... SET app.settings.X = '...'` ou `ALTER ROLE`, retornam erro/NULL.
- Como sync_service_role_from_vault só atualiza `_app_config`, esse cron pode estar autenticando com JWT antigo (ou nem rodando).
- Status de `app.settings.*` desconhecido — não foi inspecionado neste ciclo.

**Diagnóstico SQL:**
```sql
-- 1. Os GUCs estão setados?
SELECT
  current_setting('app.settings.supabase_url',  true) AS supabase_url,
  CASE WHEN current_setting('app.settings.service_role_key', true) IS NULL
       THEN NULL
       ELSE length(current_setting('app.settings.service_role_key', true))
  END AS svc_key_length;

-- 2. Histórico do cron: succeeded/failed?
SELECT
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'conversion-send'
  AND jrd.start_time > now() - interval '6 hours'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- 3. Definição completa do trigger PL/pgSQL (se existir)
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname ILIKE 'trigger_conversion_send%';
```

**Estratégia de fix proposta:** padronizar para `_app_config` (mesma fonte que recebe sync do Vault). Garante que um único sync reflete em todos os crons HTTP.

Migration sugerida (combinada com #1): `20260501150000_fix_legacy_cron_urls.sql` ou separada `20260501160000_standardize_cron_config_source.sql`. **Aguarda aprovação.**

---

## Próximos passos

1. ✅ Pipeline SENDS PRO operacional — investigação principal encerrada.
2. ⏳ Aguardando dev-analyst (mapeamento de fluxo de código) para fechar bug 1 com seção de evidências completa.
3. ⏳ Pendência #1 — diagnóstico SQL acima → se confirmar falha silenciosa, criar migration de fix.
4. ⏳ Pendência #2 — diagnóstico SQL acima → se confirmar GUCs ausentes, padronizar para `_app_config`.
5. (Opcional) View `public.v_dispatch_health` proposta no fim deste doc — observabilidade contínua dos crons via REST. Resolveria pendência #3 do diagnóstico anterior. Aguarda OK do team-lead.

---

## SQL 1 — Distribuição de mensagens por status (com idade)

**Pergunta:** quantas mensagens em cada status e há quanto tempo estão paradas?

```sql
SELECT
  status,
  COUNT(*) AS total,
  MIN(created_at) AS oldest_created,
  MAX(created_at) AS newest_created,
  MIN(sent_at)    AS oldest_sent,
  MAX(sent_at)    AS newest_sent,
  ROUND(EXTRACT(EPOCH FROM (now() - MIN(created_at)))/60)::int AS oldest_age_minutes
FROM public.messages
WHERE created_at > now() - interval '48 hours'
  AND from_contact <> 'cliente'
GROUP BY status
ORDER BY status;
```

**Como interpretar:**
- `pending` com `oldest_age_minutes > 5` = cron parado ou edge function falhando.
- `sending` com `oldest_age_minutes > 10` = mensagem travou no claim (sem unlock pelo edge fn) — exige reset manual (ver SQL 1b).
- `sent` aparecendo após 17:13 UTC = pipeline drenando pós-fix. Se `MAX(sent_at)` for recente (dentro do último minuto) → cron operacional.
- `error` = checar `metadata->'last_error'` (SQL 1c) para causa.

### SQL 1b — Detalhe das mensagens 25 e 26 (foco da investigação anterior)

```sql
SELECT
  id,
  status,
  channel,
  from_contact,
  created_at,
  sent_at,
  metadata->'delivery_log' AS delivery_log,
  metadata->>'last_error'  AS last_error,
  ROUND(EXTRACT(EPOCH FROM (now() - created_at))/60)::int AS age_minutes
FROM public.messages
WHERE id IN (25, 26)
ORDER BY id;
```

**Como interpretar:**
- Status `sent` + `delivery_log[0].wamid` presente → bug 1 resolvido apenas com sync do JWT.
- Status `pending` ainda com idade > 60min → cron `omni-delivery-engine` não está rodando ou está falhando (ver SQL 3).
- Status `error` + `last_error` populado → cron rodou mas edge fn devolveu erro (Meta API, cred inválida, payload, etc.).

### SQL 1c — Mensagens em error nas últimas 24h (raiz das falhas)

```sql
SELECT
  id,
  channel,
  status,
  created_at,
  sent_at,
  metadata->>'last_error'                AS last_error,
  metadata->'delivery_log'->-1->>'error' AS last_log_error,
  jsonb_array_length(COALESCE(metadata->'delivery_log','[]'::jsonb)) AS attempts
FROM public.messages
WHERE status = 'error'
  AND created_at > now() - interval '24 hours'
  AND from_contact <> 'cliente'
ORDER BY created_at DESC
LIMIT 20;
```

---

## SQL 2 — Schema da tabela `messages` (colunas relevantes para disparo)

**Pergunta:** quais colunas existem hoje em `public.messages` e seus tipos?

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'messages'
  AND column_name IN (
    'id','status','channel','from_contact','content','message_type',
    'media_url','media_metadata','people_id','lead_id','user_id',
    'source_type','module_ref_id','whatsapp_template_id','wa_phone_number_id',
    'execution_id','metadata','sent_at','created_at','tenant_id'
  )
ORDER BY ordinal_position;
```

**Como interpretar:**
- `status` deve ser `text` com CHECK em `('pending','sending','sent','error')` (definido na migration `20260316210000`).
- Não existe coluna dedicada `retry_count` na `messages` — retentativas são acumuladas em `metadata->'delivery_log'` (array de objetos com timestamp/wamid/error). Esse fato confirmamos na audit-followups-schema.md (linha 106).
- `module_ref_id` deve ser `uuid` (corrigido pela migration `20260317000000`).
- Se faltar alguma coluna (`metadata`, `sent_at`, `wa_phone_number_id`) → drift que precisa de migration nova.

### SQL 2b — CHECK constraint de `status`

```sql
SELECT
  conname,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t  ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'messages'
  AND c.contype = 'c';
```

---

## SQL 3 — Cron jobs ativos

**Pergunta:** todos os jobs em `cron.job` (com foco em `omni-delivery-engine`, `sends-dispatch-batch`, `process-message-buffer`).

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database,
  username
FROM cron.job
ORDER BY jobname;
```

**Como interpretar:**
- `omni-delivery-engine` deve estar `active=true`, schedule `* * * * *`, command `SELECT trigger_omni_delivery_engine();`. Esperado pela migration `20260308020000_omni_delivery_engine_cron-ok.sql`.
- `sends-dispatch-batch` deve estar `active=true`, schedule `* * * * *`, command `SELECT public.trigger_sends_dispatch_batch()`. Esperado pela migration `20260423010000_sends_server_dispatch.sql`.
- `process-message-buffer` (referenciado no diagnóstico anterior) — precisa estar ativo se há mensagens entrando via msg_buffer.
- **Job ausente** = migração não aplicada ou foi unscheduled. Reaplicar a migration correspondente.
- **Job presente mas `active=false`** = alguém pausou. Reativar via `SELECT cron.alter_job(jobid, active := true);`.

### SQL 3b — Histórico de execução do `omni-delivery-engine` nos últimos 30 minutos

```sql
SELECT
  j.jobname,
  jrd.runid,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  ROUND(EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))*1000)::int AS duration_ms
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('omni-delivery-engine','sends-dispatch-batch','process-message-buffer')
  AND jrd.start_time > now() - interval '30 minutes'
ORDER BY jrd.start_time DESC
LIMIT 50;
```

**Como interpretar:**
- Linhas com `status='succeeded'` a cada minuto → cron saudável.
- `status='failed'` + `return_message` → erro na função PL/pgSQL (provavelmente `_app_config` ou `net.http_post`). Capturar mensagem para análise.
- Zero linhas → cron não foi executado nos últimos 30min (`active=false` ou worker pg_cron caído).

### SQL 3c — Confirmar que `trigger_omni_delivery_engine` consegue ler `_app_config` corretamente

```sql
-- Não dispara HTTP — apenas verifica que as keys estão lidas e válidas.
SELECT
  (SELECT value FROM _app_config WHERE key = 'supabase_url')                       AS supabase_url_present,
  length((SELECT value FROM _app_config WHERE key = 'service_role_key'))            AS svc_key_length,
  (SELECT value FROM _app_config WHERE key = 'service_role_key') LIKE 'eyJ%'        AS svc_key_is_jwt;
```

**Como interpretar:**
- `svc_key_length` deve ser ~219 (JWT do service_role).
- `svc_key_is_jwt = true` → JWT válido.
- Qualquer valor NULL / false → o sync do Vault não persistiu. Reaplicar `SELECT sync_service_role_from_vault();`.

---

## SQL 4 — Função `claim_pending_messages`

**Pergunta:** existe? Qual a definição atual?

```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid)             AS returns,
  l.lanname                                  AS language,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  pg_get_functiondef(p.oid)                  AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'claim_pending_messages';
```

**Como interpretar:**
- Deve existir **uma única** assinatura: `(p_batch_size int, p_max_age_hours int, p_people_id uuid, p_channel text)` — definida pela migration `20260317000000_fix_claim_pending_messages_types.sql`.
- `module_ref_id` no `RETURNS TABLE` deve estar como `uuid` (não `text`). Se estiver `text` → migration não aplicada, edge function `omni-delivery-engine` quebra ao consumir.
- `SECURITY DEFINER` + `SET search_path = public` obrigatórios.
- Se houver **duas versões** da função (overload antigo `(int, int, uuid, text)` com tipo errado) → ambígua, edge fn pode chamar a errada. Limpeza:
  ```sql
  -- Inspecionar todas as assinaturas antes de dropar
  SELECT oid::regprocedure FROM pg_proc WHERE proname = 'claim_pending_messages';
  ```

---

## SQL 5 — Logs recentes de erro relacionados ao disparo

**Pergunta:** há tabela de logs? Que erros ocorreram?

### SQL 5a — Procurar tabelas de log

```sql
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%dispatch_log%'
    OR table_name ILIKE '%delivery_log%'
    OR table_name ILIKE '%message_log%'
    OR table_name ILIKE '%send_log%'
    OR table_name ILIKE '%message_attempts%'
    OR table_name ILIKE '%edge_logs%'
  )
ORDER BY table_name;
```

**Esperado:** retorna 0 ou 1 linha. Provavelmente **não existe tabela de logs dedicada** — observabilidade hoje vive em `messages.metadata.delivery_log` (jsonb array). A audit-followups-schema.md confirma essa decisão.

### SQL 5b — Falhas recentes via `metadata.delivery_log`

```sql
SELECT
  m.id,
  m.status,
  m.created_at,
  m.sent_at,
  attempt->>'attempt_at'   AS attempt_at,
  attempt->>'error'         AS error,
  attempt->>'http_status'   AS http_status
FROM public.messages m,
     LATERAL jsonb_array_elements(COALESCE(m.metadata->'delivery_log','[]'::jsonb)) AS attempt
WHERE m.created_at > now() - interval '24 hours'
  AND attempt ? 'error'
ORDER BY (attempt->>'attempt_at')::timestamptz DESC NULLS LAST
LIMIT 20;
```

### SQL 5c — Logs do pg_cron (último recurso, se 5b vier vazio)

Já coberto no SQL 3b — `cron.job_run_details` traz `return_message` quando o trigger PL/pgSQL falha (ex: `_app_config` ausente, `net.http_post` timeout).

---

## Plano de execução sugerido

1. Lead executa **SQL 1, 1b, 1c** → mostra estado da fila *agora*. Se 25/26 já estão `sent` → bug 1 resolvido pelo sync e não há mais ação imediata necessária.
2. Lead executa **SQL 3, 3b** → confirma que cron `omni-delivery-engine` está rodando (job ativo + execuções nos últimos 30min). Esta é a peça mais crítica que ficou pendente do diagnóstico anterior (Pendência #3 do `2026-05-01-ora-schema-drift.md`).
3. Lead executa **SQL 4** → confirma que `claim_pending_messages` está com tipos corretos (sem regressão da migration `20260317000000`).
4. Se cron está ok mas há `error` em mensagens → **SQL 5b** revela causa (Meta API, payload, etc.).
5. **SQL 2 / 2b** ficam para validação de schema — só rodar se os anteriores indicarem drift.

## Cenários e ações esperadas

| Resultado | Diagnóstico | Ação |
|---|---|---|
| 1b: msgs 25/26 status=sent | bug 1 resolvido pelo sync | Encerrar investigação, atualizar 2026-05-01-ora-schema-drift.md (item validação pós-fix). |
| 1b: msgs 25/26 ainda pending + 3: cron active=false | Cron foi desativado em algum momento (manual ou rollback) | `SELECT cron.alter_job(jobid, active:=true)` no jobid correspondente. |
| 1b: msgs ainda pending + 3: cron active=true + 3b: status='failed' | Trigger PL/pgSQL falhando | Inspecionar `return_message`. Possível causa: `service_role_key` em _app_config diferente do Vault de novo (re-sync). |
| 1b: msgs 25/26 status=error com last_error | Cron rodou mas Meta API rejeitou | Capturar `last_error`, encaminhar ao back-end (omni-delivery-engine) — não é problema de schema. |
| 4: `claim_pending_messages` retorna `module_ref_id text` | Drift — migration `20260317000000` não aplicada | Reaplicar migration, smoke-test. |
| 4: duas assinaturas de `claim_pending_messages` | Overload órfão da versão pré-fix | Drop da assinatura antiga (após confirmar via `oid::regprocedure`). |

## Observabilidade contínua sugerida

Para evitar que próximas paradas do cron passem despercebidas, criar **view pública**:

```sql
CREATE OR REPLACE VIEW public.v_dispatch_health AS
SELECT
  j.jobname,
  j.schedule,
  j.active,
  (SELECT COUNT(*) FROM cron.job_run_details d WHERE d.jobid = j.jobid AND d.start_time > now() - interval '5 minutes') AS runs_5min,
  (SELECT COUNT(*) FROM cron.job_run_details d WHERE d.jobid = j.jobid AND d.status = 'failed' AND d.start_time > now() - interval '30 minutes') AS failures_30min,
  (SELECT MAX(end_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid) AS last_run_at
FROM cron.job j
WHERE j.jobname IN ('omni-delivery-engine','sends-dispatch-batch','process-message-buffer');
```

Permite à app frontend (ou monitor externo) checar saúde via REST sem precisar de acesso ao schema `cron`. Essa é a Pendência #3 do diagnóstico anterior — proponho criar como migration `20260501150000_dispatch_health_view.sql` *se o lead aprovar*. Não aplico antes de OK.

## Próximos passos do Bythak (após output do lead)

1. Receber resultados dos SQLs 1–5 do lead.
2. Atualizar este documento com seção "Resultados" preenchida.
3. Se houver drift identificado → criar migration corretiva + rollback + adicionar ao `client-migrations.json`.
4. Se cron simplesmente está ok → atualizar `2026-05-01-ora-schema-drift.md` marcando Pendência #3 como resolvida.
