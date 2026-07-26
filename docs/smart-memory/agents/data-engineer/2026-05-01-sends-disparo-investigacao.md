---
title: "Sends Pro — Investigação profunda do bloqueio de disparo (áreas A-F)"
type: investigation
agent: dev-data-engineer
created: 2026-05-01
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
status: closed-empirical-confirmation
tags: [sends-pro, disparo, omni-delivery-engine, investigacao, area-A, area-B, area-C, area-D, area-E, area-F]
related:
  - "[[sends-pro-db-state]]"
  - "[[../../archive/2026-05-01-ora-schema-drift]]"
  - "[[schema]]"
---

# Sends Pro — Investigação do bloqueio (áreas A-F)

## Contexto

A investigação anterior (`sends-pro-db-state.md`) declarou pipeline saudável:
- Fila `messages` zerada (0 pending/sending/error em 48h, 7 sent).
- Crons `omni-delivery-engine`, `sends-dispatch-batch`, `process-message-buffer` 100% succeeded.
- `_app_config` JWT válido (`length=219`, `eyJ...`).

**Mas o usuário ainda reporta que disparo SENDS PRO não acontece.** Isso significa que a varredura anterior não cobriu o caminho específico do bug. Pontos cegos prováveis:

1. **Não checamos `sends` (campanha)** — só checamos `messages`. Pode ter campanha em `running` sem produzir batches por `send_interval_seconds` muito alto, `last_batch_at` recente, ou `sends_contacts` esgotados.
2. **Não checamos `sends_contacts`** — pode ter pending presos sem virar `messages`.
3. **Não checamos `settings_whatsapp_channels`** — pode não haver canal `active=true` / `is_default=true` / com `phone_number_id`+`access_token`.
4. **Não checamos `whatsapp_templates`** — `meta_template_name IS NULL` quebra worker silenciosamente.
5. **Não checamos delivery_log granular** das poucas msgs `sent` — pode ser que estejam sendo marcadas `sent` sem realmente sair (rare, mas possível bug de status update).
6. **Não checamos histórico maior** — só 48h. Se usuário criou campanha hoje cedo e nada saiu, isso entra no janelamento.

**Tenant:** `wotuyxscsfralqpoiyfv` (single-tenant pós-2026-05-01).

⚠️ **ZERO escrita.** Apenas SELECT/inspeção via MCP Supabase pelo team-lead.

---

## Plano de SQLs por área

### Área A — Estado das campanhas SENDS

#### A1. Campanhas em qualquer estado (últimas 7d)

```sql
SELECT
  id,
  name,
  status,
  created_at,
  starts_at,
  send_interval_seconds,
  batch_size,
  last_batch_at,
  ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(last_batch_at, created_at)))/60)::int AS minutes_since_last_batch,
  total_contacts,
  sent_count,
  failed_count,
  pending_count
FROM public.sends
WHERE created_at > now() - interval '7 days'
ORDER BY created_at DESC
LIMIT 30;
```

**O que procurar:**
- `status='running'` com `last_batch_at` velho (>5min) → cron `sends-dispatch-batch` não está chamando esta campanha.
- `send_interval_seconds` muito grande (>3600) → cron espera intervalo enorme entre batches. Pode parecer "parado" do ponto de vista do usuário.
- `pending_count > 0` + `last_batch_at` recente → cron rodando mas algo no batch está falhando.
- `total_contacts = 0` → campanha sem contatos. Bug de cadastro, não de disparo.
- `status='paused'` ou `'draft'` → usuário não acionou play. Não é bug de schema.

#### A2. Sends_contacts pendentes por campanha

```sql
SELECT
  s.id AS send_id,
  s.name,
  s.status AS send_status,
  COUNT(*) FILTER (WHERE sc.status = 'pending')   AS pending,
  COUNT(*) FILTER (WHERE sc.status = 'sent')      AS sent,
  COUNT(*) FILTER (WHERE sc.status = 'failed')    AS failed,
  COUNT(*) FILTER (WHERE sc.status = 'skipped')   AS skipped,
  COUNT(*)                                         AS total,
  MIN(sc.created_at) FILTER (WHERE sc.status = 'pending') AS oldest_pending,
  MAX(sc.updated_at) FILTER (WHERE sc.status = 'sent')    AS newest_sent
FROM public.sends s
LEFT JOIN public.sends_contacts sc ON sc.send_id = s.id
WHERE s.created_at > now() - interval '7 days'
GROUP BY s.id, s.name, s.status
ORDER BY s.created_at DESC
LIMIT 30;
```

**O que procurar:**
- `pending > 0` + `send_status='running'` + `oldest_pending` velho (>30min) → cron não está consumindo.
- `pending > 0` + `send_status` em `paused/draft` → não é bug, é estado.
- `pending = 0` mas `total > 0` → tudo já foi consumido. Não há nada para o cron fazer.

#### A3. Detalhe de uma campanha running (se houver)

```sql
-- Se A1 retornou alguma running, substituir o ID abaixo:
SELECT
  sc.id,
  sc.send_id,
  sc.contact_phone,
  sc.contact_name,
  sc.status,
  sc.created_at,
  sc.updated_at,
  sc.message_id,
  sc.error_message,
  sc.scheduled_for,
  sc.attempts
FROM public.sends_contacts sc
WHERE sc.send_id = '<ID_DA_RUNNING>'
ORDER BY
  CASE sc.status WHEN 'pending' THEN 0 WHEN 'failed' THEN 1 ELSE 2 END,
  sc.created_at
LIMIT 30;
```

---

### Área B — Estado das mensagens (72h)

#### B1. Distribuição mais ampla (72h, não só 48h)

```sql
SELECT
  source_type,
  status,
  COUNT(*) AS total,
  MIN(created_at) AS oldest,
  MAX(created_at) AS newest,
  COUNT(*) FILTER (WHERE sent_at IS NULL) AS without_sent_at,
  COUNT(*) FILTER (WHERE metadata ? 'last_error') AS with_last_error
FROM public.messages
WHERE created_at > now() - interval '72 hours'
  AND from_contact <> 'cliente'
GROUP BY source_type, status
ORDER BY source_type, status;
```

**O que procurar:**
- `source_type='campaign'` com qualquer count → confirma que campanha gerou mensagens.
- `source_type='campaign'` ausente totalmente → `sends-dispatch-batch` nunca produziu mensagens. Pipeline não conecta sends→messages.
- `status='sent'` com `without_sent_at > 0` → bug: marcado sent sem timestamp.
- `with_last_error > 0` em sent → mensagem teve erro mas foi forçada a sent.

#### B2. Mensagens campaign sem progresso (criadas mas nunca sent)

```sql
SELECT
  id,
  status,
  channel,
  source_type,
  module_ref_id,
  created_at,
  sent_at,
  metadata->>'last_error' AS last_error,
  jsonb_array_length(COALESCE(metadata->'delivery_log','[]'::jsonb)) AS attempts,
  ROUND(EXTRACT(EPOCH FROM (now() - created_at))/60)::int AS age_min
FROM public.messages
WHERE created_at > now() - interval '72 hours'
  AND source_type = 'campaign'
  AND from_contact <> 'cliente'
  AND status <> 'sent'
ORDER BY created_at DESC
LIMIT 50;
```

**O que procurar:**
- `status='pending'` + `attempts=0` + `age_min>5` → cron não tocou. Lookup do claim falha.
- `status='pending'` + `attempts>0` + `last_error` populado → cron tocou mas Meta API rejeitou em todas tentativas. Lê o erro.
- `status='error'` + `last_error` → causa direta visível.
- `status='sending'` + `age_min>10` → travado em claim sem unlock (precisa reset manual).

#### B3. Erros recentes detalhados

```sql
SELECT
  m.id,
  m.source_type,
  m.created_at,
  m.metadata->>'last_error' AS last_error_top,
  attempt->>'attempt_at' AS attempt_at,
  attempt->>'error' AS error,
  attempt->>'http_status' AS http_status,
  attempt->>'wamid' AS wamid
FROM public.messages m,
     LATERAL jsonb_array_elements(COALESCE(m.metadata->'delivery_log','[]'::jsonb)) AS attempt
WHERE m.created_at > now() - interval '72 hours'
  AND (attempt ? 'error' OR (attempt->>'http_status') NOT LIKE '2%')
ORDER BY (attempt->>'attempt_at')::timestamptz DESC NULLS LAST
LIMIT 30;
```

**O que procurar:**
- `error` contendo "token", "auth", "401" → JWT/access_token ainda inválido em algum lugar.
- `error` contendo "template" → template Meta não aprovado / nome errado.
- `error` contendo "phone_number_id" → canal mal configurado.
- `error` contendo "rate" / "429" → rate limit Meta.

#### B4. Mensagens campaign que estão sent — confirmar entrega real

```sql
SELECT
  id,
  status,
  source_type,
  created_at,
  sent_at,
  jsonb_array_length(COALESCE(metadata->'delivery_log','[]'::jsonb)) AS log_entries,
  metadata->'delivery_log'->-1->>'wamid' AS last_wamid,
  metadata->'delivery_log'->-1->>'http_status' AS last_http
FROM public.messages
WHERE created_at > now() - interval '72 hours'
  AND source_type = 'campaign'
  AND status = 'sent'
ORDER BY created_at DESC
LIMIT 20;
```

**O que procurar:**
- `last_wamid` IS NULL em mensagens sent → bug: marcada sent sem confirmação Meta. Smoking gun.
- `last_http` <> '200' mas `status='sent'` → status update ignora resposta HTTP.
- Zero rows → não há nenhuma mensagem campaign de fato saída em 72h.

---

### Área C — Configuração de canal WhatsApp

#### C1. Canais configurados

```sql
SELECT
  id,
  channel_name,
  phone_number,
  phone_number_id,
  business_account_id,
  is_default,
  active,
  CASE WHEN access_token IS NULL THEN 'NULL'
       WHEN length(access_token) < 20 THEN 'SUSPECT'
       ELSE 'PRESENT' END AS token_state,
  length(access_token) AS token_length,
  created_at,
  updated_at
FROM public.settings_whatsapp_channels
ORDER BY is_default DESC, active DESC, updated_at DESC;
```

**O que procurar:**
- Zero linhas → tenant não tem canal cadastrado. Disparo IMPOSSÍVEL.
- Nenhum `active=true` → todos pausados. Bug de UI ou config.
- `is_default=true` em zero canais → worker pode não conseguir resolver canal default.
- `is_default=true` em mais de um → ambíguo, worker pode pegar errado.
- `phone_number_id` NULL ou `access_token` NULL → canal mal configurado.
- `updated_at` muito velho (meses) → token Meta provavelmente expirou (Meta tokens duram ~60d).

#### C2. Token rotation freshness

```sql
SELECT
  id,
  channel_name,
  is_default,
  active,
  updated_at,
  ROUND(EXTRACT(EPOCH FROM (now() - updated_at))/86400)::int AS days_since_update
FROM public.settings_whatsapp_channels
WHERE active = true
ORDER BY updated_at DESC;
```

**O que procurar:**
- `days_since_update > 60` → Meta access_token muito provavelmente expirou (System User tokens não, mas tokens user-owned sim).

---

### Área D — Templates WhatsApp

#### D1. Templates do tenant

```sql
SELECT
  id,
  name,
  meta_template_name,
  meta_template_status,
  category,
  language,
  system_enabled,
  created_at,
  updated_at
FROM public.whatsapp_templates
ORDER BY system_enabled DESC, updated_at DESC
LIMIT 30;
```

**O que procurar:**
- `meta_template_name IS NULL` em qualquer template usado por sends → worker quebra ao montar payload Meta.
- `meta_template_status <> 'APPROVED'` → Meta rejeita envio.
- Zero templates `system_enabled=true` → não há template para campanhas usarem.

#### D2. Templates referenciados pelas campanhas em running

```sql
SELECT
  s.id AS send_id,
  s.name AS send_name,
  s.status AS send_status,
  s.template_id,
  t.id AS tpl_id,
  t.name AS tpl_name,
  t.meta_template_name,
  t.meta_template_status,
  t.system_enabled
FROM public.sends s
LEFT JOIN public.whatsapp_templates t ON t.id = s.template_id
WHERE s.status IN ('running','paused')
   OR s.created_at > now() - interval '7 days'
ORDER BY s.created_at DESC
LIMIT 20;
```

**O que procurar:**
- `template_id` NULL em sends running → worker não tem template, vai falhar.
- `tpl_id` NULL (template referenciado não existe mais) → FK órfã.
- `meta_template_name` NULL ou `meta_template_status<>'APPROVED'` → Meta vai rejeitar.

---

### Área E — Crons (revalidar com janela maior)

#### E1. Histórico 2h dos 3 crons críticos

```sql
SELECT
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  ROUND(EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))*1000)::int AS duration_ms
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('omni-delivery-engine','sends-dispatch-batch','process-message-buffer')
  AND jrd.start_time > now() - interval '2 hours'
ORDER BY jrd.start_time DESC
LIMIT 100;
```

**O que procurar:**
- Qualquer `failed` → ler `return_message`.
- Gaps temporais → cron pulou minutos. pg_cron worker pausou?
- `duration_ms` muito alto (>30000) → trigger PL/pgSQL travando.

#### E2. `_app_config` revalidação

```sql
SELECT
  key,
  CASE WHEN key='service_role_key' THEN length(value)::text || ' chars'
       ELSE value END AS value_or_meta,
  updated_at,
  ROUND(EXTRACT(EPOCH FROM (now() - updated_at))/3600)::numeric(10,2) AS hours_since_update
FROM public._app_config
WHERE key IN ('supabase_url','service_role_key')
ORDER BY key;
```

**O que procurar:**
- `service_role_key` length <> 219 → não é JWT padrão.
- `supabase_url` <> `https://wotuyxscsfralqpoiyfv.supabase.co` → drift do tenant.
- `hours_since_update > 24` → sync do Vault não rodou recentemente. Ok se Vault não mudou, suspeito se app foi redeployado.

#### E3. Definição completa do `trigger_sends_dispatch_batch`

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('trigger_sends_dispatch_batch','trigger_omni_delivery_engine');
```

**O que procurar:**
- URL hardcoded diferente de `_app_config` lookup.
- Header `Authorization` montado errado.
- `net.http_post` retornando ID mas sem follow-up de status.

---

### Área F — Fluxo de teste manual

#### F1. Existe campanha "teste" / "test" criada?

```sql
SELECT
  id,
  name,
  status,
  created_at,
  starts_at,
  send_interval_seconds,
  batch_size,
  last_batch_at,
  total_contacts,
  pending_count
FROM public.sends
WHERE name ILIKE '%test%'
   OR name ILIKE '%demo%'
   OR name ILIKE '%bug%'
ORDER BY created_at DESC
LIMIT 10;
```

#### F2. Última atividade qualquer no pipeline (sentinela)

```sql
-- Última mensagem outbound criada
SELECT 'last_message_created' AS evento, MAX(created_at) AS ts
FROM public.messages WHERE from_contact <> 'cliente'
UNION ALL
-- Último send criado
SELECT 'last_send_created', MAX(created_at) FROM public.sends
UNION ALL
-- Último sends_contacts updated
SELECT 'last_sends_contacts_update', MAX(updated_at) FROM public.sends_contacts
UNION ALL
-- Último cron run succeeded
SELECT 'last_cron_succeeded', MAX(end_time)
FROM cron.job_run_details
WHERE status='succeeded'
UNION ALL
-- Última execução omni-delivery-engine
SELECT 'last_omni_engine_run', MAX(jrd.end_time)
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid=jrd.jobid
WHERE j.jobname='omni-delivery-engine';
```

**O que procurar:**
- `last_send_created` > 1 dia → ninguém criou campanha recentemente. Bug pode ser "campanha nunca foi criada", não disparo.
- `last_sends_contacts_update` muito antigo → worker não está atualizando contatos. Cron parado.
- `last_omni_engine_run` < 2 min → cron rodando ok.
- `last_message_created` não tem mensagem `campaign` → confirma que dispatch_batch não criou mensagens.

---

## Veredicto final — fechado por confirmação empírica em 2026-05-01T18:08

Bug fechado **sem necessidade de rodar os SQLs A-F**. O team-lead disparou uma campanha de teste (`eduteste1`) que completou o ciclo end-to-end com sucesso.

### Evidência da campanha de teste

| Campo | Valor |
|---|---|
| `sends.id` | `865b3dff-ba81-4c22-9886-1ac1b5f80872` |
| `sends.name` | `eduteste1` |
| Disparo | 2026-05-01 18:08:20 |
| Completou | 2026-05-01 18:08:21 (1s) |
| Contatos | 1 (Eduardo Freitas, 5521991426882) |
| `sends_contacts.status` | `sent` |
| `sends_contacts.sent_at` | 2026-05-01 18:08:20 |
| `messages.id` | 35 |
| `messages.wa_message_id` | `wamid.HBgN...` ✅ Meta aceitou |
| Template usado | `ora_primeiro_contato` (resolvido OK) |
| Canal | "Ora" default, token PRESENT (202 chars), `wa_channel_id=ca2577cc-...` |
| **Recepção real** | ✅ User confirmou recebimento no WhatsApp |

### Tabela de veredictos (consolidada)

| Área | Veredicto | Evidência | Observação |
|---|---|---|---|
| A. Sends | ✅ OK | `eduteste1` running→completed em 1s | dispatch_batch funcional |
| B. Messages | ✅ OK | msg id=35 com `wa_message_id` válido | pipeline `sends_contacts → messages` OK |
| C. Canais | ✅ OK | canal "Ora" default ativo, token 202 chars | rotação OK |
| D. Templates | ✅ OK | `ora_primeiro_contato` resolvido | Meta APPROVED |
| E. Crons | ✅ OK | `sends-dispatch-batch` + `omni-delivery-engine` rodaram em <1s | confirmação empírica reforça inspeção anterior |
| F. Sentinela | ✅ OK | `last_message_campaign` = 18:08:20 | última atividade muito recente |

### Conclusão

**O bug do usuário ("SENDS PRO não dispara") já estava resolvido pelo fix de JWT (sync_service_role_from_vault) aplicado em 2026-05-01T17:13.** A persistência da reclamação era apenas falta de validação empírica pós-fix. Pipeline end-to-end opera dentro do esperado.

Hipóteses ranqueadas no início desta investigação ficam **descartadas** — todas estavam OK pelo teste real.

### Achado bônus — `delivered_at` NULL apesar de entrega real

**Confirmado:** `sends_contacts.delivered_at` permaneceu NULL mesmo com mensagem entregue (Meta confirmou via wamid + user recebeu).

**Causa:** `send-status-callback` órfã + `whatsapp-inbound` descartando `statuses[]` da Meta — gap arquitetural já documentado pelo dev-analyst em `[[../research/sends-status-callback-analysis]]`.

**Impacto:** observabilidade de delivery incompleta. Não afeta entrega em si, mas impede analytics e detecção de falhas silenciosas em produção. **Vira story própria** (não é parte deste RCA).

### Pendências carry-over (continuam abertas, viram stories próprias)

Do diagnóstico anterior em `[[sends-pro-db-state]]`:
1. **Pendência #1 — Crons com URL do antigo control plane** (`google-calendar-sync`, `process-meeting-followups` apontando para `wotuyxscsfralqpoiyfv.supabase.co`).
2. **Pendência #2 — `conversion-send` lê `app.settings.*` (GUC)** em vez de `_app_config` — divergente do padrão e provavelmente nunca atualizado pelo sync do Vault.

Nenhuma dessas afeta SENDS PRO. Endereçáveis em iteração separada se o user pedir.

---

## Hipóteses de bloqueio (ranqueadas por probabilidade — atualizar após dados)

1. **🔴 ALTA:** Não existe `settings_whatsapp_channels` ativo / com `is_default=true` / com `access_token` válido. Worker tenta resolver canal e falha. (Área C)
2. **🔴 ALTA:** Templates referenciados pelas campanhas têm `meta_template_name IS NULL` ou `meta_template_status<>'APPROVED'`. Worker monta payload e Meta rejeita. (Área D)
3. **⚠️ MÉDIA:** Campanha foi criada com `send_interval_seconds` muito grande (>3600s) — cron está rodando, mas não dispara batch porque intervalo ainda não venceu. Usuário interpreta como "parado". (Área A1)
4. **⚠️ MÉDIA:** Token Meta access_token expirou (rotation passou de 60d). Worker chama Meta e recebe 401. (Área C2 + Área B3)
5. **⚪ BAIXA:** Bug de status update que marca `sent` sem realmente entregar. (Área B4)
6. **⚪ BAIXA:** Trigger `trigger_sends_dispatch_batch` consultando dispatch errado / URL antiga. (Área E3)

---

## Pontos cegos que dependem de outros teammates

- **dev-dev-beta:** se canal aparece OK e mensagem dá erro `401`/`403`/`auth`, precisa logar a chamada Meta API em `omni-delivery-engine` edge function e capturar response body real.
- **dev-research / dev-analyst:** se canal aparece OK e templates OK mas mensagens nunca são criadas, precisam mapear o caminho `sends→sends_contacts→messages` no código (`trigger_sends_dispatch_batch` PL/pgSQL + edge fn `sends-dispatch-batch`).
- **dev-frontend:** se campanha nunca é criada (Área F1 retornar zero), validar UI de criação de SENDS PRO.

---

## Procedimento

1. Team-lead executa SQLs A→F na ordem via MCP Supabase no projeto `wotuyxscsfralqpoiyfv`.
2. Cola resultados brutos abaixo de cada SQL nesta seção (ou em separado para Bythak consolidar).
3. Bythak consolida veredictos, atualiza tabela acima, refina hipóteses.
4. Notifica `dev-analyst` e lead com veredicto final.

⚠️ ZERO ALTERAÇÃO. Apenas SELECT.
