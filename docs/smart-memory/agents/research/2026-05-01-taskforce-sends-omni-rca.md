---
title: "RCA: Taskforce SENDS PRO + Omni IA — dois bugs João Guirunas"
type: research
agent: dev-analyst
created: 2026-05-01
updated: 2026-05-10
tags: [rca, sends-pro, omni-pro, whatsapp, ai-agent, joao-guirunas-tenant]
related:
  - "[[../../decisions/ADR-SENDS-01-message-delivery-attempts]]"
---

# RCA — Taskforce joao-guirunas-taskforce-sends-omni

**Tenant:** João Guirunas (`wotuyxscsfralqpoiyfv`)
**WABA:** `897757435977938` | **phone_number_id:** `965974589930143`
**Solicitante:** team-lead (fast-track, sem QA / sem stories formais)

---

## Bug 1 — SENDS PRO: template não chega ao cliente final

### Sintoma observado
Usuário cria disparo no SENDS PRO → mensagem aparece no Omni do CRM marcada como `sent` → cliente final NÃO recebe no WhatsApp.

### Arquitetura do fluxo (relevante)
```
Frontend (botão Enviar)
  → sends.status = 'running'
  → pg_cron (a cada 1min) → trigger_sends_dispatch_batch()
    → sends-dispatch-batch  (edge fn)
      → send-dispatch-worker  (edge fn)
        → INSERT messages (status='pending', channel='whatsapp', metadata.template_name, components)
        → UPDATE sends_contacts.status = 'sent'  ← MARCA COMO ENVIADO AQUI (linha 1006-1009)
                                                 ← MAS Meta Graph API ainda NÃO foi chamada
[separadamente]
pg_cron (a cada 1min) → trigger_omni_delivery_engine()  ← REQUER _app_config preenchido
  → omni-delivery-engine  (edge fn)
    → claim_pending_messages RPC (FOR UPDATE SKIP LOCKED, status='pending'→'sending')
    → POST /functions/v1/whatsapp-outbound
      → sendTemplateToMeta() → Meta Graph API
      → UPDATE messages.status = 'sent', wa_message_id
```

### Root cause concreto

**Causa primária — gap de observabilidade que mascara falha real:**
`send-dispatch-worker/index.ts:1006-1009` marca `sends_contacts.status = 'sent'` IMEDIATAMENTE após `INSERT` em `messages` com `status='pending'`. A entrega real à Meta acontece num passo assíncrono separado (`omni-delivery-engine` puxado por outro pg_cron), e o `sends_contacts` NUNCA é atualizado se o segundo passo falha. Por isso o disparo aparece "enviado" no SENDS PRO mas a mensagem fica orfã em `messages.status='pending'` (ou regredida pra `error`).

**Causa raiz mais provável (vista no histórico de tenants novos):**
A função `trigger_omni_delivery_engine()` (`supabase/migrations/20260308020000_omni_delivery_engine_cron-ok.sql:18-19`) lê `supabase_url` e `service_role_key` de `_app_config`. Se uma dessas chaves estiver faltando ou desatualizada no tenant João Guirunas (que é tenant novo, baseline reaplicada via FWUP-12/13/14), a função sai silenciosamente em `RAISE WARNING` (linha 22) e o `omni-delivery-engine` NUNCA é chamado pelo cron. Resultado: `messages` ficam acumulando `status='pending'` indefinidamente — o cliente nunca recebe.

Outras hipóteses concorrentes (menos prováveis, mas possíveis):
- `claim_pending_messages` rejeita por `module_ref_id` type mismatch (já corrigido em `20260317000000_fix_claim_pending_messages_types.sql` — verificar se está aplicada).
- `whatsapp-outbound` rejeita o `template_name` por ser UUID/empty (`whatsapp-outbound/index.ts:691-695` faz guard explícito). Acontece se `whatsapp_templates.meta_template_name` estiver NULL E `json_data.elementName` também ausente. `send-dispatch-worker:926-933` já valida e lança erro antes — então cairia em `sends_contacts.status='failed'`, não em `'sent'`. Descartado como causa do sintoma reportado.
- Template não aprovado pela Meta → resposta 400 com `template not found` ou `language not supported`. Erra registrada em `messages.metadata.delivery_log[]` (após patch FWUP whatsapp-outbound presente no working tree).

### Validação concreta a executar (ORDEM)
1. SQL: `SELECT * FROM _app_config WHERE key IN ('supabase_url','service_role_key');` — confirmar que ambas existem e `service_role_key` é JWT válido.
2. SQL: `SELECT trigger_fwup01_smoke_test();` — todos PASS?
3. SQL: `SELECT count(*), status FROM messages WHERE channel='whatsapp' AND created_at > now() - interval '24 hours' GROUP BY status;` — se houver `pending` acumulando, é o cron parado.
4. SQL: `SELECT jobname, schedule, active FROM cron.job WHERE jobname IN ('omni-delivery-engine','sends-dispatch-batch');` — confirmar que estão `active=true`.
5. Edge logs: `omni-delivery-engine` últimos 10 minutos — qualquer execução nas últimas 1h? Se zero, é o cron silencioso.
6. SQL pra mensagens órfãs específicas do disparo testado:
   ```sql
   SELECT m.id, m.status, m.metadata->>'template_name' AS tpl, m.metadata->'delivery_log'
   FROM messages m
   WHERE module_ref_id = '<send_id_do_teste>'
   ORDER BY m.created_at DESC;
   ```
   - Se `status='pending'` e `delivery_log` vazio → `omni-delivery-engine` não rodou.
   - Se `status='error'` → ler `delivery_log[].error` pra root cause.

### Fix recomendado
**Curto prazo (P0 — tira o cliente do bloqueio):**
Garantir `_app_config` populado em João Guirunas. Validar via `trigger_fwup01_smoke_test()`. Se `service_role_key` faltar, rodar `SELECT sync_service_role_from_vault();` (definida em FWUP-01). Se `supabase_url` faltar, `INSERT INTO _app_config (key, value) VALUES ('supabase_url', 'https://wotuyxscsfralqpoiyfv.supabase.co') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`.

**Médio prazo (P1 — não deixar isso reincidir silenciosamente):**
Trocar a regra "marca `sends_contacts='sent'` antes da entrega Meta" por uma cadeia atômica: o `send-dispatch-worker` deve INSERT `messages.status='pending'` E manter `sends_contacts.status='queued'` (estado novo). A transição `queued → sent` deve acontecer apenas quando `messages.status='sent'` (via trigger ou via `whatsapp-outbound` que já tem o `message_ids[]`). Isso elimina o gap entre "registrei localmente" e "Meta confirmou recebimento" — alinhado com ADR-SENDS-01 que está accepted mas implementação ainda não chegou em João Guirunas.

### Dev sugerido
- **dev-dev-beta** (backend / edge fns): valida `_app_config`, audita `omni-delivery-engine` execution logs, escreve patch curto em `send-dispatch-worker` se necessário.
- **dev-data-engineer** (Byte) em paralelo: confirma que migrations `20260317000000_fix_claim_pending_messages_types.sql` e `20260317100000_fix_claim_reset_and_security.sql` estão aplicadas em João Guirunas (essenciais para o claim funcionar).

### Arquivos-chave
- `supabase/functions/send-dispatch-worker/index.ts:985-1012` (insert messages + mark sent prematuro)
- `supabase/functions/omni-delivery-engine/index.ts:548-572` (claim_pending → batch)
- `supabase/functions/whatsapp-outbound/index.ts:640-728` (sendTemplateToMeta)
- `supabase/migrations/20260308020000_omni_delivery_engine_cron-ok.sql:8-46` (trigger_omni_delivery_engine — lê _app_config)
- `supabase/migrations/20260427020000_fwup01_rotate_service_role_jwt.sql:45-75` (sync_service_role_from_vault)

---

## Bug 2 — Omni: agente conversacional não responde mensagem inbound

### Sintoma observado
Lead na etapa correta do pipeline; `ai_agents.stage_ids` contém o UUID dessa etapa; `ai_agents.active=true`; `clients_people.ai_enabled=true`. Mensagem do cliente chega no Omni. Agente NÃO responde — sem mensagem `from_contact='ia'` gerada.

### Arquitetura do fluxo (relevante)
```
WhatsApp inbound webhook
  → whatsapp-inbound (edge fn)
    → INSERT messages (from_contact='cliente', status='delivered')
    → INSERT message_buffer (people_id, expires_at = now + buffer_ms)
[separadamente]
pg_cron (a cada 5s) → process_message_buffer()
  → SELECT message_buffer JOIN clients_people  WHERE expires_at < now AND ai_processing_lock=false AND ai_enabled=true
  → UPDATE clients_people.ai_processing_lock = true
  → POST /functions/v1/ai-agent-execute  { people_id }
    → loadAgent() ou loadAgentForStageEntry()  ← MATCH POR pipeline_id + stage_ids
    → LLM call → POST /functions/v1/whatsapp-outbound (resposta)
```

### Root cause concreto

**Causa primária candidata #1 — type mismatch em `stage_ids`:**
A migration `20260501120000_fix_save_agent_complete_array_types.sql:1-7` (HOJE, atrás dessa investigação) declara explicitamente: *"pipeline_ids and stage_ids columns are text[] in this DB, not uuid[]"*. Porém:
- `supabase/migrations/20260428040000_fwup15_type_check_and_stage_ids.sql:43` declara `stage_ids uuid[]` ao adicionar.
- `supabase/migrations/20260303150000_ai_agents_multi_select-ok.sql:9` declara `stage_ids text[]` no baseline original.
- O trigger `notify_lead_stage_changed` (`supabase/migrations/20260430250000_ai_agent_stage_trigger.sql:67`) faz `stage_ids @> ARRAY[NEW.leads_stages_id]` — `NEW.leads_stages_id` é `uuid`. Se a coluna for `text[]`, o operador `@>` levanta `operator does not exist: text[] @> uuid[]` e o `EXCEPTION WHEN OTHERS THEN RETURN NEW` (linha 108-110) **engole o erro silenciosamente**.

Resultado: o trigger proativo de stage entry NUNCA dispara `ai-agent-execute` em João Guirunas porque a comparação falha por type mismatch, e o `EXCEPTION WHEN OTHERS` esconde o erro.

O `loadAgent` em `ai-agent-execute/index.ts:820` usa o cliente Supabase JS com `.contains('stage_ids', [leadStageId])` — também falha silenciosamente em type mismatch (PostgREST converte ou retorna empty result, não exceção).

**Causa primária candidata #2 — lead não está com `status='in_progress'`:**
`ai-agent-execute/index.ts:600-604` busca lead por `people_id + status='in_progress'` com `.single()` — se o lead estiver em qualquer outro status (e havia drift `'ativo'` vs `'in_progress'` corrigido HOJE em migration `20260501100000_fix_leads_status_ativo.sql`), `leadResult.data` é null, `leadId` fica null, `leadPipelineRow` query em `2063-2067` falha (`eq('id', '')` + `single()` → erro), `loadAgent` recebe `null` em pipeline e stage → cai em `agent_not_found_no_retry` linha 2091.

**Causa primária candidata #3 — buffer cron não rodando (mesma root do Bug 1):**
`process_message_buffer()` (`supabase/migrations/20260308004000_fix_http_post_body_jsonb-ok.sql:19-25`) também depende de `_app_config.supabase_url` e `_app_config.service_role_key`. Se o Bug 1 for por `_app_config` faltando, o Bug 2 também é. O processo silenciosamente não chama `ai-agent-execute`.

### Validação concreta a executar (ORDEM)
1. SQL: `SELECT pg_typeof(stage_ids) FROM ai_agents LIMIT 1;` — confirmar tipo. Se `text[]` ⇒ candidata #1 confirmada.
2. SQL: a estrutura do registro do lead testado:
   ```sql
   SELECT l.id, l.status, l.leads_pipelines_id, l.leads_stages_id,
          cp.ai_enabled, cp.ai_processing_lock,
          aa.id AS agent_id, aa.active, aa.stage_ids, aa.pipeline_id, aa.pipeline_ids
   FROM leads l
   JOIN clients_people cp ON cp.id = l.people_id
   LEFT JOIN ai_agents aa ON aa.active = true
   WHERE cp.whatsapp = '<numero_do_teste>'
   ORDER BY l.created_at DESC LIMIT 5;
   ```
3. SQL: lookup que `loadAgent` faria — se retornar 0 rows com `status='in_progress'`, candidata #2:
   ```sql
   SELECT id FROM ai_agents
   WHERE active = true AND is_template = false
     AND stage_ids @> ARRAY['<lead_stage_uuid>']::text[]   -- ou ::uuid[] dependendo do tipo
   LIMIT 1;
   ```
   Tente AMBOS casts e veja qual dá erro.
4. SQL: `SELECT id, processed, expires_at, created_at FROM message_buffer WHERE people_id = '<people_id_teste>' ORDER BY created_at DESC LIMIT 5;` — se houver entries com `processed=false` e `expires_at < now()` há mais de 1 minuto, o cron parou (mesmo problema do Bug 1).
5. Edge logs: `ai-agent-execute` últimas 24h — alguma execução? Se zero pra esse `people_id`, ou candidata #1 (trigger+loadAgent silencioso) ou candidata #3 (cron parado). Se sim, ver `agent_not_found_no_retry` no log.

### Fix recomendado
**Imediato (depende do diagnóstico):**
- Se candidata #1 (`stage_ids` é `text[]`): cast explícito em `notify_lead_stage_changed` linha 67: `stage_ids::uuid[] @> ARRAY[NEW.leads_stages_id]` — OU normalizar o tipo da coluna pra `uuid[]` definitivamente (ALTER TABLE com cast). E corrigir o `loadAgent` no edge fn pra usar `.contains('stage_ids', [String(leadStageId)])` (já é string em JS, ok). Remover ou logar o `EXCEPTION WHEN OTHERS` do trigger pra não esconder type errors.
- Se candidata #2 (lead status drift): rodar `20260501100000_fix_leads_status_ativo.sql` se ainda não aplicada e validar `SELECT DISTINCT status FROM leads;` retorna apenas valores canônicos.
- Se candidata #3: mesmo fix do Bug 1 (popular `_app_config`).

**Adicional — defesa em profundidade:**
- Em `ai-agent-execute/index.ts:2063-2067`, trocar `.single()` por `.maybeSingle()` no lookup de `leadPipelineRow` — `single()` em row inexistente vira erro 500 que mata todo o run. Hoje, com `leadId=null`, `eq('id', '')` retorna 0 rows e `single()` lança PGRST116.
- Logar o resultado do `loadAgent` priority chain em produção (linhas 815-902) — adicionar `log.debug` em cada P1..P8 indicando "matched" ou "miss" pra diagnóstico futuro.

### Dev sugerido
- **dev-data-engineer** (Byte): confirma tipo de `stage_ids` em João Guirunas, decide entre cast no trigger vs normalizar coluna. Aplica fix em SQL (ela é dona de migrations).
- **dev-dev-beta** (backend): patch em `ai-agent-execute` (`maybeSingle` em linha 2067 e logging de loadAgent priority chain) + ajuste no trigger se necessário.

### Arquivos-chave
- `supabase/functions/ai-agent-execute/index.ts:801-947` (loadAgent priority chain)
- `supabase/functions/ai-agent-execute/index.ts:2058-2106` (resolve leadPipeline + match agent)
- `supabase/functions/ai-agent-execute/index.ts:600-604` (lead lookup com status='in_progress')
- `supabase/functions/whatsapp-inbound/index.ts:813-827` (pushToBuffer condicional em ai_enabled)
- `supabase/migrations/20260430250000_ai_agent_stage_trigger.sql:62-73` (trigger stage_ids match — type mismatch suspect)
- `supabase/migrations/20260501120000_fix_save_agent_complete_array_types.sql` (declara stage_ids text[])
- `supabase/migrations/20260428040000_fwup15_type_check_and_stage_ids.sql:43` (declara stage_ids uuid[])
- `supabase/migrations/20260308004000_fix_http_post_body_jsonb-ok.sql` (process_message_buffer cron)
- `supabase/migrations/20260501100000_fix_leads_status_ativo.sql` (status normalize)

---

## Coordenação sugerida (sem QA, sem architect)

| Frente | Dev | Tarefa concreta |
|---|---|---|
| Bug 1 P0 — `_app_config` | **dev-data-engineer (Byte)** | SQL diagnostic suite acima → `sync_service_role_from_vault()` se faltar. Validar `cron.job` ativos. |
| Bug 1 P1 — gap "sent" prematuro | **dev-dev-beta** | Avaliar trigger ou patch curto que mantém `sends_contacts.status='queued'` até `messages.status='sent'`. Sem ADR — fix mínimo agora. |
| Bug 2 — type/lookup | **dev-data-engineer (Byte)** | Confirma tipo `stage_ids` + decide cast vs normalize. |
| Bug 2 — robustez edge fn | **dev-dev-beta** | `maybeSingle` em `ai-agent-execute:2067` + logging de loadAgent + remover `EXCEPTION WHEN OTHERS` mudo do trigger. |

Bug 1 e Bug 2 podem ter MESMA root cause infra-level (`_app_config` vazio em João Guirunas novo). Validar isso PRIMEIRO antes de mexer em código aplicação — economiza ciclo de fix.

---

## Checklist de validação manual (usuário)

### Bug 1 — pós-fix
- [ ] Criar disparo SENDS PRO de 1 contato (número de teste do usuário) com template `meta_template_name` válido e aprovado.
- [ ] Em até 2 minutos, conferir no celular se o template chegou no WhatsApp.
- [ ] Em SQL: `SELECT status, metadata->'delivery_log' FROM messages WHERE module_ref_id = '<send_id>';` deve retornar `status='sent'` e `delivery_log[0].success=true` com `wamid` preenchido.
- [ ] No SENDS PRO UI: card do disparo mostra "1/1 enviados" e ícone de status verde no contato.
- [ ] Repetir com disparo de 5 contatos pra confirmar batch processing.

### Bug 2 — pós-fix
- [ ] Lead novo no pipeline correto, na etapa coberta por `ai_agents.stage_ids`.
- [ ] Cliente envia "oi" pelo WhatsApp.
- [ ] Em até `buffer_ms + 10s` (default ~10s), agente responde no Omni e no WhatsApp do cliente.
- [ ] Em SQL: `SELECT id, content, from_contact, created_at FROM messages WHERE people_id = '<id>' ORDER BY created_at DESC LIMIT 5;` mostra mensagem `from_contact='ia'` após a `from_contact='cliente'`.
- [ ] `SELECT processed FROM message_buffer WHERE people_id = '<id>';` → `true` (foi processado).
- [ ] `clients_people.ai_processing_lock` voltou pra `false` após processamento.
- [ ] Re-teste com lead em outra etapa do mesmo pipeline pra garantir que o match `stage_ids` está consistente.
