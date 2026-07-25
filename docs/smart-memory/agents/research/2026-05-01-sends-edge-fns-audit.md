---
title: "Audit: SENDS PRO — 4 Edge Functions do Disparo (read-only)"
type: research
agent: dev-dev-beta
created: 2026-05-01
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
tags: [research, sends-pro, omni-pro, whatsapp, edge-functions, audit, dispatch, meta-graph-api]
related:
  - "[[sends-pro-dispatch-flow]]"
  - "[[sends-status-callback-analysis]]"
  - "[[../data-engineer/sends-pro-db-state]]"
  - "[[../../archive/2026-05-01-ora-schema-drift]]"
---

# Audit: 4 Edge Functions do Disparo SENDS PRO — Leitura Estática

**Decisão que informa:** RCA do bug "mensagens WhatsApp não disparam no João Guirunas". Foco: identificar regressões silenciosas, hardcodes, env-var dependencies e tratamento de erro nas 4 fns do caminho do disparo.
**Solicitado por:** team-lead via dev-analyst.
**Modo:** read-only. Zero alteração de código.

## TL;DR — top hipóteses ordenadas

1. **(P0 já resolvido)** `_app_config.service_role_key` desincronizado do Vault → cron retornava 401 e mensagens travavam em `pending`. RCA do bug 1, fechada pelo `sync_service_role_from_vault()` em 2026-05-01. Fila atual: 0 pending / 0 sending / 0 error nas últimas 48h.
2. **(P1 latente)** Janela `MAX_AGE_HOURS = 24` no `omni-delivery-engine`: se o cron parar >24h novamente (ex: novo desync de JWT), as mensagens **expiram silenciosamente** e nunca são entregues — sem alerta, sem dead-letter. Próxima vez que isso acontecer, a fila parecerá "vazia" mas com perda real.
3. **(P1 latente)** `whatsapp-outbound` cai para `WHATSAPP_ACCESS_TOKEN` env var quando o canal não tem `access_token`. **Se essa env var apontar para um WABA diferente do canal configurado**, manda do número errado sem erro visível (apenas `console.warn`).
4. **(P1 — confirmado pelo dev-analyst)** `send-status-callback` órfão: `sends_contacts.status` trava em `sent` para sempre, `delivered_at`/`read_at` sempre NULL. Não bloqueia o disparo em si, mas explica reportes de "mensagem não chegou ao cliente" quando na verdade chegou — usuário olha métrica e não vê `delivered`.
5. **(P2)** `AbortSignal.timeout(55000)` em `sends-dispatch-batch` aborta o worker se ele demora >55s. Atualmente OK porque `batch_size: 1`, mas qualquer aumento de `batch_size` + retry exponencial 5/15/45s no worker pode estourar a janela e abortar sem causa logada.
6. **(P3)** Para o **primeiro batch** disparado pelo botão Play, pode haver duplicação se o cron `sends-dispatch-batch` rodar no mesmo segundo. Frontend não consulta `last_batch_at`. Raro (<1s overlap).
7. **(P3)** `whatsapp-outbound` aceita JWT do user OU service_role; um JWT user válido invalidando os 4 fallbacks pode resolver canal errado e mandar do WABA padrão sem alarme.

Não foi encontrado nenhum commit que pareça **ter quebrado o disparo recentemente** — o histórico aponta para correção, não regressão. Mais detalhes na Seção 3.

## 1. Tabela de pontos suspeitos

| # | ponto suspeito | arquivo:linha | risco | como confirmar |
|---|---|---|---|---|
| A1 | `MAX_AGE_HOURS = 24` — mensagens >24h são ignoradas pelo `claim_pending_messages` sem dead-letter, sem alerta | `omni-delivery-engine/index.ts:39` + `claim_pending_messages` arg `p_max_age_hours` | P1 — perda silenciosa em qualquer parada >24h do cron | `SELECT count(*) FROM messages WHERE status='pending' AND created_at < now() - interval '24 hours' AND from_contact <> 'cliente'` deve sempre ser 0; se >0 já vazou |
| A2 | `WHATSAPP_ACCESS_TOKEN` env-var fallback usado quando canal não tem `access_token` | `whatsapp-outbound/index.ts:740,857,877,907,926` (todos os 4 fallbacks) + `:933-944` (último recurso falha apenas se env tb vazio) | P1 — pode mandar do número errado sem erro visível, só `console.warn` | `SELECT id, label, phone_number_id, access_token IS NULL AS no_token, is_default, active FROM settings_whatsapp_channels` — qualquer canal `active=true` com `access_token IS NULL` cai no fallback |
| A3 | Resolução de canal em 4 cascatas: `channel_id` → `is_default` → último inbound da pessoa → qualquer ativo | `whatsapp-outbound/index.ts:846-931` | P2 — branch 4 (`limit 1`, sem ORDER) escolhe canal arbitrário se houver múltiplos `active=true` sem default | `SELECT id, label, is_default, active FROM settings_whatsapp_channels WHERE active=true` — se não há `is_default=true` e há ≥2 ativos, fallback é não-determinístico |
| A4 | `AbortSignal.timeout(55000)` no `sends-dispatch-batch` aborta worker se ele demora >55s — sem log de causa específica | `sends-dispatch-batch/index.ts:93` | P2 — silencia timeouts; user vê só "fetch failed", erro genérico em `errors[]` | Calcular pior caso do worker: 1 contato × até 3 retries × 45s = 135s. **Acima do timeout.** Hoje só evita pelo `batch_size: 1` sem retry no caminho WA |
| A5 | `claim_pending_messages` filtra por `metadata->>'delay_minutes'` — se setado >0 a msg vira invisível ao cron | `migrations/20260317000000_fix_claim_pending_messages_types.sql:48-56` (ref no flow doc) | P1 latente — feature futura ou pipeline IA pode ocultar mensagens sem mecanismo para destravar | `SELECT id, status, metadata->>'delay_minutes' FROM messages WHERE status='pending' AND (metadata->>'delay_minutes')::int > 0` |
| A6 | `whatsapp-outbound` aceita JWT user OU service-role indistintamente — não restringe `channel_id` a quem é dono | `whatsapp-outbound/index.ts:744-750` (só verifica presença de Bearer) | P3 — vazamento de token user permite enviar via qualquer canal do tenant | sem ação de runtime — design |
| A7 | Race entre Play do frontend e cron — Play dispara worker direto sem checar `last_batch_at` | `src/hooks/useSendDispatch.ts:64` (chama worker) vs `sends-dispatch-batch/index.ts:72-76` (cron faz UPDATE atômico) | P2 — duplicação do **primeiro** batch se intervalo coincidir <1s | `SELECT module_ref_id, people_id, count(*) FROM messages WHERE source_type='campaign' GROUP BY 1,2 HAVING count(*)>1` |
| A8 | `meta_template_name` ausente bloqueia o worker sem auto-recovery (lança e contato vai pra `failed`) | `send-dispatch-worker/index.ts:926-933` | P1 — single contact sem template name trava; após max retries fica `failed` | `SELECT id, name, meta_template_name FROM whatsapp_templates WHERE meta_template_name IS NULL` |
| A9 | `wa_phone_number_id` no INSERT em `messages` vem de `waChannelObj.phone_number_id` mas o canal pode ter sido `null` se `single()` falhou; `.single()` lança em vez de retornar null, atinge catch genérico | `send-dispatch-worker/index.ts:687-696` (`maybeSingle` previne, OK) e `:920-994` | P2 — mitigado por `maybeSingle()` correto no fetch; risco real só se `wa_channel_id` do `sends` for órfão | `SELECT s.id, s.wa_channel_id FROM sends s LEFT JOIN settings_whatsapp_channels c ON c.id=s.wa_channel_id WHERE s.channel='whatsapp' AND s.status='running' AND c.id IS NULL` |
| A10 | `recordDeliveryAttempt` faz select+update separados (não atomic) — pode perder log entry em concorrência | `whatsapp-outbound/index.ts:589-634` | P3 — log perdido apenas (não impacta entrega) | sem confirmação direta — read+update race, raríssima |
| A11 | `omni-delivery-engine` revertedouble-check: faz `UPDATE messages SET status='error' WHERE id IN (...) AND status='sending'` (linha 670). Se `whatsapp-outbound` já gravou `error` antes, este update não muda nada — OK | `omni-delivery-engine/index.ts:667-672` | OK — guard correto | n/a |
| A12 | `omni_delivery_dead_letter` upsert com `onConflict: 'message_id'`+`ignoreDuplicates: true` — falha 2ª vez na mesma msg **não incrementa** `attempts` | `omni-delivery-engine/index.ts:687-690` | P2 — dead letter retry queue não cresce em retentativas; `attempts` permanece 1 | `SELECT message_id, attempts, max_attempts, next_retry_at FROM omni_delivery_dead_letter WHERE attempts>1` deve ter linhas se a queue é processada |
| A13 | Para canais não-WA (email/sms/phone) o `INSERT messages` ocorre **depois** do dispatch real → **status='sent'** mesmo se webhook downstream falhou | `send-dispatch-worker/index.ts:1059-1071` (post-dispatch) | P2 — métrica de sent inflada se provider devolveu 200 mas falhou silenciosamente em downstream | `SELECT count(*) FROM messages WHERE channel<>'whatsapp' AND source_type='campaign' AND status='sent'` vs realidade |
| A14 | Logs estruturados via `_shared/logger.ts` mas **dispatch crítico ainda usa `console.log`/`console.error`** com emoji em texto livre | `send-dispatch-worker/index.ts:1012,1090,1137` | P3 — faz queries de log mais difíceis, mistura formatos | `grep "✅\|❌" no Supabase function logs` |
| A15 | Frontend usa `setInterval`-removido + 1ª batch pelo browser; module doc `sends-pro.md` ainda descreve loop em browser | `docs/smart-memory/project/modules/sends-pro.md` (item 9 obsoleto) | P3 — desinformação, não impacta runtime | já cobiado pela sends-pro-dispatch-flow:29 |
| A16 | `sends-dispatch-batch:120` — exception do `fetch` do worker é catchada e gera `errors[]` mas **não marca o `send` como falho**, fica em `running` para sempre se erro persiste | `sends-dispatch-batch/index.ts:120-124` | P2 — campanha "fica rodando" sem nunca completar nem alertar | `SELECT id, name, status, last_batch_at FROM sends WHERE status='running' AND last_batch_at < now() - interval '1 hour'` |
| A17 | `send-dispatch-worker:923` `'Template WhatsApp não definido'` quando `waTemplate=null` (`maybeSingle` ok) — mensagem genérica oculta causa raiz (template deletado vs `template_id` nulo) | `send-dispatch-worker/index.ts:923` | P3 — UX/diagnóstico apenas | n/a |
| A18 | `omni-delivery-engine` agrupa por `people_id` mas cada `whatsapp-outbound` recebe `wa_phone_number_id` apenas do **primeiro** msg do grupo | `omni-delivery-engine/index.ts:196` (`group[0].wa_phone_number_id`) | P3 — se múltiplas msgs da mesma pessoa têm canais diferentes, todas usam canal da 1ª. Cenário raro | `SELECT people_id, count(distinct wa_phone_number_id) FROM messages WHERE status='pending' GROUP BY 1 HAVING count(distinct wa_phone_number_id)>1` |
| A19 | `whatsapp-outbound:973` o status `messages.status='sent'` é setado direto pela edge fn, sem RPC atomic — race contra `omni-delivery-engine` que faz `UPDATE ... WHERE status='sending'` (linha 671). Race janela curta mas existe | `whatsapp-outbound/index.ts:973,1015` | P3 — `omni-delivery-engine` guarda com `eq('status','sending')`, então se outbound já marcou `sent` o engine não sobrescreve para `error`. OK | n/a |

## 2. Tratamento de erro — análise por estrato

### `sends-dispatch-batch` (148 linhas)
- **Falha do worker:** capturada na `catch (fetchErr)` linha 120 → `errors[]` é retornado no JSON, mas **NÃO atualiza** o `sends` para `failed`. Campanha continua `status='running'` para sempre.
- **Timeout:** `AbortSignal.timeout(55000)` aborta sem logar a duração da request — só cai no catch genérico. Diagnóstico fica difícil.
- **Auth ausente:** retorna 401 com `Unauthorized` (linha 28-32). OK.
- **`runningSends` query falha:** lança e cai no catch fatal — retorna 500 com mensagem (linha 139-145). OK.

### `send-dispatch-worker` (1162 linhas)
- **Validação Zod:** schema `SendDispatchRequestSchema` valida `send_id` UUID + `batch_size` 1-100 + `validate_only`. Erros viram 400 com `Validação falhou: <campo>: <msg>` (linha 660-666). OK.
- **Template `meta_template_name` vazio:** lança no `try` por contato (linha 929-933), incrementa `failed_count`, contato vai para `status='failed'` com `error_message` truncado para 255 chars + `[N retries]`. Bom — mas mensagem não diferencia "campo vazio" de "valor inválido formato UUID" sem ler o texto.
- **`messages INSERT` falha:** linha 1004 lança `messages INSERT failed: ${msgErr.message}` — vira erro do contato, NÃO derruba a campanha. OK.
- **`isRetryableError` distingue 4xx vs 5xx:** linha 499-513. 429 retry, outros 4xx imediato fail. OK e bem feito.
- **`retryWithBackoff` usa `setTimeout`:** 5/15/45s. Em pior caso 65s no worker → estoura `AbortSignal.timeout(55000)` do sends-dispatch-batch sem que o invoker saiba a causa. Risco P2 já listado em A4.
- **Erro no `enrichment` query:** capturado e ignorado com `console.error` (linha 902-904, 982-983, 1023-1025). Disparo continua sem enrichment. OK.

### `omni-delivery-engine` (744 linhas)
- **`claim_pending_messages` falha:** retorna 500 com `Failed to claim pending messages` (linha 555-561). OK, mas não dá detalhe pro caller. Erro vai pro log estruturado.
- **`whatsapp-outbound` HTTP error:** logado como `wa_outbound_http_error` com `status` + `error` body (linha 202-214). Bom.
- **`whatsapp-outbound` exception (rede):** `wa_fetch_exception` com erro string (linha 228-234). Bom.
- **No phone number:** `wa_no_phone` warn (linha 139-148) e contato vai pra `error`. OK.
- **Template name vazio:** apenas `log.error('wa_template_name_missing', ...)` linha 158-163 — **ainda envia o request para outbound** com template_name=''. Deve ser bloqueado lá em `sendTemplateToMeta:691`. Defesa em profundidade.
- **Channel inactive (não-WA):** mensagens **deixadas como pending** sem dead-letter (linha 624-628). Comentário diz "leave as pending — channel will be activated later" — mas isso interage mal com `MAX_AGE_HOURS=24h`: a mensagem expira sem nunca ter sido tentada se o channel ficar inactive >24h.
- **Dead letter:** `upsert ignoreDuplicates=true` (A12) — failover real não incrementa `attempts`.

### `whatsapp-outbound` (1095 linhas)
- **Sem `Authorization`:** 401 (linha 745-750). OK.
- **`to`/`messages[]` ausente:** 400 (linha 835-840). OK.
- **`accessToken` não resolvido:** 500 com mensagem clara (linha 933-938). OK.
- **`phoneNumberId` não resolvido:** 400 (linha 940-944). OK.
- **Meta API 4xx/5xx:** `sendToMeta` retorna `{ error: 'Meta NNN: <body>' }`. `recordDeliveryAttempt` extrai `http_status` regex (linha 617-618) — bom para log. **Stack trace nunca exposto ao client (todas as throws viram error string)** — OK.
- **`sendTemplateToMeta` empty/UUID template:** bloqueia ANTES de chamar Meta (linha 691-695). Excelente.
- **`recordDeliveryAttempt` falha:** captura silenciosamente (linha 631-633). Log perdido mas não trava o disparo.
- **Storage download falha (audio):** retorna `null`, fallback para document link (linha 525-531). OK.

## 3. Histórico de mudanças — git log nas 4 fns

```
sends-dispatch-batch/  → 1 commit (initial 214c9e3)        — sem mudança após 2026-04-30
send-dispatch-worker/  → 1 commit (initial 214c9e3)        — sem mudança após 2026-04-30
omni-delivery-engine/  → 1 commit (initial 214c9e3)        — sem mudança após 2026-04-30
whatsapp-outbound/     → 2 commits (initial + 7756b2a)     — última mudança 2026-05-01 12:10
```

**Único candidato a regressão:** commit `7756b2a` em `whatsapp-outbound/index.ts` (87 linhas adicionadas, principalmente helper `recordDeliveryAttempt`).

**Análise do diff:** ANTI-regressão — corrige bug onde `update({ metadata: { error_reason } })` sobrescrevia metadata inteira, apagando `template_name`/`components`/`send_id`/`delivery_log` em falhas. Antes do fix, **toda falha de campanha apagava os dados necessários para diagnosticar a falha**. Agora preserva e faz append em `metadata.delivery_log[]`.

**Conclusão:** **nenhum commit recente é candidato a regressão do disparo.** O bug do disparo foi causado por estado de DB (`_app_config.service_role_key` desincronizado), não por código novo. Já fechado por sync do Vault.

## 4. Env vars — checklist no projeto Supabase João Guirunas

Edge fns usam apenas estas Deno.env keys:

| env var | usado por | obrigatória? | observação |
|---|---|---|---|
| `SUPABASE_URL` | todas as 4 | sim | gerada automaticamente pelo Supabase ao criar a função; não precisa setar manualmente |
| `SUPABASE_SERVICE_ROLE_KEY` | todas as 4 | sim | gerada automaticamente; **não confundir com `_app_config.service_role_key`** que é populado pelo `sync_service_role_from_vault()` |
| `SUPABASE_ANON_KEY` | só `send-dispatch-worker` (validar JWT user) | sim | gerada automaticamente |
| `WHATSAPP_ACCESS_TOKEN` | `whatsapp-outbound` (fallback quando canal não tem token) | **OPCIONAL** | se NÃO setada e canal sem token → 500. Se setada apontando para outro WABA → mensagens vão pelo número errado silenciosamente (A2). Recomendação: **deixar UNSET** em João Guirunas e exigir token por canal |
| `SEND_CALLBACK_SECRET` | `send-status-callback` (órfão, não no caminho do disparo) | n/a | ver `sends-status-callback-analysis.md` — função não é chamada |

**Cross-check com dev-data-engineer:** o doc `sends-pro-db-state.md` confirma `_app_config` ✅ (svc_key_length=219, is_jwt=true, supabase_url correto). Env vars de runtime das edge fns não foram inspecionadas via MCP — apenas SUPABASE_* são autoinjetadas pelo Supabase, então ✅ implícito. **`WHATSAPP_ACCESS_TOKEN` é o único env var operacional possivelmente setado manualmente** — vale lead checar no painel Supabase/Functions/Secrets.

## 5. Pontos invisíveis confirmados

- **Sem rate-limit client-side:** nenhuma das 4 fns implementa rate limit interno (apenas `humanDelay` em texto livre 300-2500ms para humanização). Worker pega 1 contato por chamada por minuto via cron — efetivamente 60 disparos/min/campanha máximo, controlado por `send_interval_seconds`.
- **`AbortSignal.timeout(55000)` em `sends-dispatch-batch`:** já listado em A4. Suficiente hoje (`batch_size:1` sem retry no caminho WA), apertado se config mudar.
- **Env vars únicas opcionais:** apenas `WHATSAPP_ACCESS_TOKEN` (A2 como ponto de risco).
- **`omni_delivery_dead_letter`:** existe mas com `ignoreDuplicates=true` no upsert → **não está realmente fazendo retry exponencial** (A12). Backoff `[60, 300, 1800, 7200, 43200]` definido apenas no insert inicial; retry processor não foi auditado nesta task mas vale verificar.

## 6. Hipóteses ranqueadas para o RCA

| # | hipótese | probabilidade | evidência | como falsificar |
|---|---|---|---|---|
| H1 | Bug do JWT desync (P0) já está resolvido | ~99% | `sends-pro-db-state.md` confirma fila limpa, smoke 5/5, `svc_key_is_jwt=true` | `SELECT * FROM messages WHERE status='pending' AND from_contact<>'cliente'` deve continuar 0 nas próximas horas |
| H2 | Próxima falha será novamente JWT desync (sem alarme contínuo) | ~30% | rotação automática do service-role-key pelo Supabase pode descalibrar `_app_config` se `sync_service_role_from_vault` não rodar agendado | criar migration de cron que sincronize a cada hora (story candidata) |
| H3 | Canal sem `access_token` cai para `WHATSAPP_ACCESS_TOKEN` errada | ~10% | A2 — só `console.warn`, não `error` | inspecionar `settings_whatsapp_channels` em João Guirunas: todos `active=true` têm `access_token IS NOT NULL`? |
| H4 | Mensagens "perdidas" em campanhas longas pela janela 24h | ~20% (latente) | A1 — `MAX_AGE_HOURS=24` corta sem dead-letter | `SELECT count(*) FROM messages WHERE status='pending' AND created_at < now() - interval '24h'` deve ser 0 |
| H5 | Status `delivered/read` nunca atualizado em `sends_contacts` (impressão de "não enviou") | ~70% como percepção do usuário | já documentado no `sends-status-callback-analysis.md` | métrica visual diz 0% delivered apesar de Meta ter entregue. Cross-check na Inbox WA do destinatário |
| H6 | Race Play-vs-cron causa duplicação no 1º batch | <5% | A7 — exige overlap <1s | `GROUP BY module_ref_id,people_id HAVING count(*)>1` |
| H7 | Worker timeout >55s aborta sem causa | <5% hoje | A4 — só atinge se `batch_size>1` ou retry severo | medir `duration_ms` do cron em casos `failed` |

## 7. Recomendações (sem implementar)

Em ordem de payoff:

1. **Story FIX-SENDS-STATUS-BRIDGE-01** (já recomendada pelo dev-analyst): bridge de `whatsapp-inbound`→`messages.status='delivered'` + trigger SQL→`sends_contacts`. Resolve H5 (impressão de "não enviou").
2. **Story OBS-DISPATCH-HEALTH-01:** view `v_dispatch_health` (já proposta pelo dev-data-engineer) + alarm para `failures_30min > 0`. Captura H2/H7 antes de virar bug.
3. **Story FIX-SENDS-DEAD-LETTER-01:** mudar upsert do dead-letter para incrementar `attempts` em conflict (A12). Tirar `ignoreDuplicates=true`. Stitch retry processor se ainda não existe.
4. **Story FIX-SENDS-LONG-CAMPAIGN-01:** alarme + re-enqueue para mensagens com `created_at > now() - 23h` ainda em `pending`. Trata H4.
5. **Story REFACTOR-SENDS-WORKER-LOGS-01:** padronizar logs do worker para `_shared/logger.ts` (A14). Baixo payoff, alto custo, não-urgente.
6. **Doc:** atualizar `sends-pro.md` removendo "loop frontend" do débito 9 (A15). Tarefa para dev-architect.

## 8. Conclusão para o team-lead

**O caminho do disparo está bem implementado e defendido em profundidade — não há bug óbvio em código que justifique falha de disparo.** O bug observado (mensagens não enviavam) tinha causa raiz **fora das edge fns**, em estado de DB (`_app_config.service_role_key`). Já corrigido.

Nenhum commit recente é candidato a regressão do disparo. Único commit recente em `whatsapp-outbound` (`7756b2a`) é correção, não regressão.

Os pontos P1 listados (A1, A2, A12, S5) são **resiliências fracas que viram bugs visíveis em condições adversas** — devem virar stories de manutenção, não fix urgente.

## Limitações desta auditoria

- Não validei runtime: nenhum SQL executado, nenhuma chamada real ao Supabase. Só leitura de código.
- Não inspecionei o painel de Functions/Secrets do Supabase João Guirunas — `WHATSAPP_ACCESS_TOKEN` pode ou não estar setada; vale o lead checar.
- Não auditei `process-message-buffer`, `send-status-callback`, `whatsapp-inbound`, `instagram-outbound` (fora do caminho direto do disparo SENDS).
- Não testei end-to-end nem reproduzi o bug.
- Não inspecionei o **processador** de `omni_delivery_dead_letter` (existe? quem chama? cron separado?). Vale uma sub-investigação.

## Fontes (lidas integralmente ou parcialmente)

- `supabase/functions/sends-dispatch-batch/index.ts` (148 linhas) — integral
- `supabase/functions/send-dispatch-worker/index.ts` (1162 linhas) — integral
- `supabase/functions/omni-delivery-engine/index.ts` (744 linhas) — integral
- `supabase/functions/whatsapp-outbound/index.ts` (1095 linhas) — integral
- `supabase/functions/_shared/logger.ts` — header
- `git log` das 4 fns (commits desde initial)
- `docs/smart-memory/agents/research/sends-pro-dispatch-flow.md` — base
- `docs/smart-memory/agents/research/sends-status-callback-analysis.md` — base
- `docs/smart-memory/agents/data-engineer/sends-pro-db-state.md` — base
