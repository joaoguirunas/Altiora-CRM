---
title: "ALTIORA-05: Edge function — receber referral automaticamente por e-mail (UC10)"
type: story
status: backlog
epic: ALTIORA-B
complexity: L
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, email, webhook, edge-function, backend]
related: ["[[ALTIORA-01]]", "[[ALTIORA-06]]", "[[ALTIORA-07]]"]
---

# ALTIORA-05: Edge function — receber referral automaticamente por e-mail (UC10)

## Objetivo
Criar a edge function `altiora-email-referral-inbound` que recebe o e-mail de handoff enviado pela Avenue/Matheus, valida remetente e conteúdo mínimo, verifica duplicatas e cria o referral na etapa "Novo referral" com origem e vínculo ao e-mail original.

## Acceptance Criteria
- [ ] AC1: POST para `/functions/v1/altiora-email-referral-inbound` com payload de e-mail contendo remetente autorizado (`avenue.com` ou lista configurável via env `ALTIORA_ALLOWED_SENDERS`) cria lead em `leads` com `leads_stages_id` = id da etapa "Novo referral" do pipeline Altiora e `source = 'email_handoff'`.
- [ ] AC2: E-mail com campos mínimos ausentes (nome do cliente ou contato) cria o lead com `status = 'pending_validation'` e insere registro na tabela `altiora_email_queue` (nova, ver ALTIORA-01) com motivo de pendência — gestor recebe notificação via toast na próxima visita ao pipeline.
- [ ] AC3: E-mail com remetente não autorizado retorna HTTP 403 e **não** cria lead; registra tentativa em `altiora_email_queue` com `status = 'rejected'`.
- [ ] AC4: E-mail com mesmo `message_id` (header `Message-ID`) já processado retorna HTTP 200 idempotente sem criar duplicata — verificado via coluna `email_message_id` em `leads` ou tabela de dedup.
- [ ] AC5: Após criação bem-sucedida, notificação via Supabase Realtime / insert em `notifications` acorda o gestor comercial (usuário com perfil `gestor_comercial` no tenant Altiora).

## Escopo

**IN:**
- Edge function `altiora-email-referral-inbound` em `supabase/functions/`
- Parsing de e-mail: extrair nome, e-mail, telefone do corpo/subject com regex configurável
- Tabela `altiora_email_queue` (migration) para log de e-mails processados, pendentes e rejeitados
- Variável de ambiente `ALTIORA_ALLOWED_SENDERS` e `ALTIORA_PIPELINE_ID`

**OUT:**
- UI de configuração do webhook de e-mail (escopo de UC07)
- Integração com servidor de e-mail — assume-se que o provedor de e-mail faz POST para a edge function (ex: SendGrid Inbound Parse, Mailgun Routes)
- Atribuição automática de Closer (cobre ALTIORA-07)

## Contexto Técnico
- Padrão de edge function: ver `supabase/functions/whatsapp-inbound/` como referência de estrutura
- Tenant fixo para V1: constante no env ou extraído do subdomain do webhook URL
- Deduplicação: coluna `email_message_id TEXT UNIQUE` na tabela `altiora_email_queue`
- Notificação: inserir em tabela `notifications` existente ou usar Supabase Realtime broadcast
- Testar localmente com `supabase functions serve` + curl

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | — |
| Branch     | feature/ALTIORA-05-07-13-email-closer-calendar |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
