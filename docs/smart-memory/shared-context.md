---
title: Shared Context
type: status-board
updated: 2026-07-25
tags: [ops]
---

# Status Board — Altiora-CRM Base

Projeto em modo **standalone (base de template)**. SaaS single-tenant operando contra um único Supabase project. Sem control plane, sem catálogo de clientes, sem resolução de tenant em runtime.

> Banco anterior `wotuyxscsfralqpoiyfv` desconectado em 2026-07-25. Credenciais completas em [[ops/supabase-credentials]].

## Estado atual

| Item | Estado |
|---|---|
| Supabase project | `dtsmbqrzyxhjjjvpjfjd.supabase.co` (single-tenant) |
| Client config | `src/integrations/supabase/client.ts` (URL + anon key do novo banco) |
| `supabase/config.toml` | Configurado para `dtsmbqrzyxhjjjvpjfjd` |
| Access token | armazenado em `.env.local` (ver [[ops/supabase-credentials]]) |
| Git main | Em uso normal |
| Multi-tenant sync | 🚫 DESATIVADO — `.standalone` presente na raiz |
| db push | ⚠️ QUEBRADO — usar `db query --linked --file` + INSERT manual em `schema_migrations` |

## Sessão atual (2026-06-10) — main atualizada

`origin/main` está em `c4caf31`. Entregues e pushadas:
- ✅ LOSS-01/02/03 — motivos de perda (`e4f4437`)
- ✅ WAT-SYNC-01/02/03 — template sync + cron (`6e26168`, `c4caf31`)

**Pendente (sem push ainda):** CRM-NOTES-01 — padronizar editor de Observações (story ativa, aguardando validação no navegador pelo usuário).

## Fixes Instagram DM (2026-06-10, fora de team)

### Bug 1: Manual send bloqueado — `messages_message_type_check` + Meta (#3) ✅ RESOLVIDO
**Root cause (real):** DRIFT de constraint. As migrations `20260430190000` (private_reply) e `20260430200000` (private_reply + email) estão registradas em `schema_migrations` como aplicadas, MAS a constraint LIVE não tinha nenhum dos dois valores (efeito do workflow "db push quebrado" — versão carimbada sem o ALTER rodar de fato).
**Cadeia correta (já existente no código, só faltava a constraint):**
1. `useCanSendMessage` detecta pessoa que só comentou → `{ canSend: true, commentId }` (lê `media_metadata.comment_id` do comentário inbound)
2. `Conversas.tsx` envia `tipo_mensagem='private_reply'` + `media_metadata.reply_to_comment_id`
3. `omni-delivery-engine:268` roteia `private_reply` → `instagram-comment-reply` com `is_private:true`
4. `instagram-comment-reply` faz `POST /{comment_id}/private_replies` — SEM IGSID, SEM janela de 7 dias
**Por que dava (#3):** sem o valor na constraint, o insert de `private_reply` falhava; quando forçado a `texto`, roteava para `instagram-outbound` (`/{business_id}/messages`) que exige janela → Meta `(#3) Application does not have the capability`.
**Fix 1 (constraint):** migration `20260610100000_fwup34_repair_message_type_check_private_reply_email.sql` — re-afirma a constraint com `private_reply` + `email`. **Aplicada LIVE** + registrada em `schema_migrations`. `Conversas.tsx` ficou net-zero. Nota: envios de e-mail (`tipo_mensagem='email'`) também estavam quebrando pela mesma drift — corrigidos.

**Fix 2 (endpoint — `delivery_failed`):** após o Fix 1 o insert passou mas a entrega falhava. Causa: `instagram-comment-reply` usava `POST /{comment_id}/private_replies` que retorna **code 100 / subcode 33** ("object does not exist / missing permissions") para este app — MESMO com page token. O endpoint correto (e provado pela automação) é `POST /{page_id}/messages` com `recipient:{comment_id}` + **Page Access Token** (System User token EAA trocado via `getPageAccessToken`). Reescrito `instagram-comment-reply` para usar essa via no path privado. Também: `omni-delivery-engine` agora propaga o erro real por mensagem (antes virava "Unknown error" no dead-letter). **Deployados:** `instagram-comment-reply`, `omni-delivery-engine`, `instagram-automation-runner` (todos `--no-verify-jwt`).

**⚠️ Limite da API Meta (não é bug):** o bypass via `comment_id` é **ONE-SHOT por comentário** — só 1 DM por comentário. A 2ª tentativa retorna `2534023` ("already has a reply"). Como a automação `reply_and_dm` (ex: Brandbook) já dispara um DM em CADA comentário, qualquer DM manual ao MESMO comentário sempre falhará com 2534023.

### Bug 3 (CAUSA RAIZ DE TUDO): App Meta sem Advanced Access em `instagram_manage_messages`
**Sintoma:** DMs recebidas de clientes NÃO aparecem no sistema. `messages` não tem NENHUM DM inbound (`from_contact='cliente'` + `message_type≠'comentario'`) desde **2026-05-12** (id 739). Zero triggers `incoming_dm` no histórico (48/48 são `post_comment`). Comentários inbound continuam normais.
**Diagnóstico definitivo (Meta API):** `GET /{page_id}/conversations?platform=instagram` retorna `error_subcode 2534084`: *"sua consulta expirou porque você tem muitas conversas com usuários que não têm uma função no app. Solicite acesso avançado à permissão instagram_manage_messages..."*
**Causa raiz:** o App Meta (`app_id 2078013586062929`) tem só **Standard Access** (modo Desenvolvimento) em `instagram_manage_messages`, NÃO Advanced Access. Sob Standard Access, mensageria IG só funciona com usuários que têm **função/role no app** (admin/dev/tester). Clientes reais (sem role): (1) DMs inbound NÃO são entregues via webhook → nada chega no `meta-inbound`; (2) não dá pra enviar DM free-form a eles → erro `(#3) capability`. Funcionou 10–12/mai porque os testes eram de conta com role no app.
**TUDO no código/config está correto e verificado:** subscription app `instagram→messages` ✓, page `subscribed_fields:[messages]` ✓, scopes incl. `instagram_manage_messages`+`pages_messaging` ✓, signature HMAC ✓ (comentários passam), routing `meta-inbound` ✓, insert DM com error handling + tipo válido ✓.
**FIX (fora do código — ação na Meta):** submeter o App para **App Review → Advanced Access em `instagram_manage_messages`** (e `instagram_manage_comments` se necessário). Interino p/ testar: adicionar o cliente como **tester/role** no App Dashboard (Roles → Instagram Testers) — aí mensageria funciona com ele. Sem Advanced Access, mensageria IG com clientes reais não funciona, independente de qualquer mudança no código.

### Bug 2: DM de automação não aparece no histórico (diagnóstico em progresso)
**Sintoma:** `instagram-automation-runner` executa `reply_and_dm` com `status: 'success'`, comment reply aparece em messages (id 804), mas DM NÃO aparece.
**Status:** Insert silencioso sem log. Meta retornou 200 (senão status seria 'failed'), então o DM foi entregue mas o insert no banco falhou.
**Fix aplicado:** error logging adicionado nas 2 paths de DM insert no `instagram-automation-runner/index.ts` (captura `error.message` + `ig_message_id` + corpo da resposta da Meta). **Requer deploy** (`supabase functions deploy instagram-automation-runner --no-verify-jwt`) + próxima execução p/ confirmar causa.
**Hipótese mais provável:** colisão no unique index `messages_ig_message_id_key` (`ig_message_id WHERE NOT NULL`) — o webhook echo do próprio DM (`meta-inbound`) e o insert da automação tentam gravar o mesmo `ig_message_id`.

### Já corrigido anteriormente (2026-06-10)
- `instagram-oauth/index.ts`: salva `app_id: appId` nas credentials — necessário para `instagram-token-refresh`
- `instagram-token-refresh/index.ts`: fallback para `INSTAGRAM_APP_ID` env var para configs antigas
- `InstagramMegaConfig.tsx`: exibe status de última renovação automática do token abaixo do campo Page Access Token

**Já corrigido fora do team (bugs pontuais):**
- `NovoNegocioModal.tsx:141` — status `"ativo"` → `"active"` (constraint 23514 em `clients_people`).
- `NegocioSidebar.tsx` — exibição de notes agora via `DOMPurify.sanitize` (referência da story).

## Entregues nesta sessão (2026-05-10)

### Webhook Inbound (feature completa)
- Tabela `inbound_webhooks`: token UUID, field_mapping JSONB, pipeline/stage FK, RLS
- Edge function `webhook-inbound`: token auth, field_mapping → processCrmData
- UI: `WebhookInboundConfig.tsx` — lista, modal editor, copy URL, toggle, delete
- Registry: `/settings/general/webhook-inbound`, group `geral`, wide=true
- `config.toml`: `verify_jwt = false`
- **FK workaround**: `webhook_logs.webhook_id = null` + `_inbound_webhook_id` em `request_body` JSONB

### Correções
- **Instagram verify token**: `INSTAGRAM_VERIFY_TOKEN=growthsales_meta_verify` (secret atualizado)
- **Settings sidebar active color**: `bg-primary/10 text-primary` (era marrom incorreto)

### WhatsApp Templates
- **`abertura_mentoria`** criado na Meta (ID: `27102833379320691`, status: PENDING aprovação)
  - Body: `Oi, {{1}}! 👋 ... Agent Teams com Claude Code ... conversa rápida?`
  - Var `{{1}}` = `primeiro_nome`
- **10 templates deletados** da Meta + marcados `deleted` no DB
  - Mantidos: `start_diagnostico` (aprovado) + `abertura_mentoria` (pending)
  - Não deletável: `hello_world` (template de amostra Meta)
- **`primeiro_nome` / `first_name`** adicionados como variáveis em:
  - `src/utils/templateUtils.ts` (replaceTemplateVariables + resolveVarToValue)
  - `src/components/config/WhatsappTemplateVariablesModal.tsx` (PESSOA_FIELDS)
  - `supabase/functions/send-dispatch-worker/index.ts` (resolveTemplateVar + variables_map)

### Agente IA — Mentoria João Guirunas
- **ID**: `d7c97ca2-9b40-47da-a21e-99e59bd1c385`
- **Pipeline**: 2 | Mentoria
- **Stages**: Interesse → Qualificação → Agendamento Reuniao (mesmo agente)
- **Destino ao confirmar**: Reunião Marcada
- **1 step único** (control=`1`, default), fluxo via `lead_etapa_nome` no prompt
- **LLM**: OpenAI `gpt-4o-mini` (provider `af0ddaed`)
- **Voice**: ElevenLabs `eleven_flash_v2_5` / voice `lv2N7sCJ002asCnmVgQW`, mode `mirror`
- Qualificação leve: salva `q1_main_bottleneck` + `moment` + `q19_qualification_status`
- Tool key: `enviar_link_agendamento` → link auto-gerado `{APP_URL}/agendar/{leadId}?d=30`

## Backlog ativo

Ver [[stories/BACKLOG]] para stories pendentes.

## Decisões arquiteturais

Ver [[decisions/]] e [[INDEX]] para o catálogo de ADRs aplicáveis ao projeto João Guirunas.

## Team encerrado (2026-06-10) — `joaoguirunas-crm-template-sync`

**Objetivo:** Bug/Fix — sync de templates WhatsApp com Meta API (3-level match, cron, testes)
**Veredicto QA:** ⚠️ CONCERNS (aprovado) · 16/17 ACs · 2 CONCERNs não-bloqueantes
**Status:** ✅ Entregue — aguardando push via dev-devops

**⚠️ Ação manual necessária:** Criar Vault secret `service_role_cron` no Supabase Dashboard (`dtsmbqrzyxhjjjvpjfjd.supabase.co`) → Settings → Vault → adicionar secret com a service_role JWT do projeto → depois re-executar migration `20260610000003` para ativar o cron de auto-sync a cada 5 min.

## Blockers

<!-- nenhum blocker ativo -->
