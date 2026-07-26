---
title: "Audit: Edge Functions Órfãs — 2026-04-24"
type: research
agent: dev-analyst (lyra)
created: 2026-04-24
updated: 2026-04-24
tags: [research, edge-functions, audit, supabase]
---

# Audit: Edge Functions Órfãs

**Contexto:** The Mentor atingiu limite de 100 functions no plano Pro Supabase. Repositório local conta 100 functions (pós-criação de `gemini-live-token` nesta sessão). Precisamos liberar slots para dar folga ao deploy.

**Metodologia:**
1. `ls supabase/functions/` → lista completa
2. `grep -r "functions.invoke"` em `src/` → quais são chamadas pelo frontend
3. `grep -r "functions.invoke\|fetch.*functions"` em `supabase/functions/` → chamadas internas entre edge fns
4. `grep` de HTTP calls em `supabase/migrations/` → chamadas via pg_net/pg_cron
5. Inspeção de conteúdo das candidatas → confirmar propósito e substituição

**Nota:** `SystemDocConfig.tsx` referencia muitas functions apenas para documentação da UI — **não conta como chamada real**.

---

## Candidatas a DELETE (baixo risco)

### 1. `mfa-revoke-factor`
- **Última modificação:** 2026-04-23
- **Por que candidata:** Zero callers encontrados. Grep em todo `src/` e `supabase/functions/` retornou vazio. A funcionalidade MFA usa `admin-unenroll-mfa` (que é chamado via `functions.invoke('admin-unenroll-mfa')`). Esta parece ser uma versão alternativa nunca integrada.
- **Risco:** Zero — nenhum caller identificado.
- **Ação:** DELETE

### 2. `google-cal-pull-event`
- **Última modificação:** (não modificado desde criação)
- **Por que candidata:** Não chamada por frontend (nenhum `invoke('google-cal-pull-event')`). Não chamada por outras edge fns. A única referência é um comentário em uma migration de documentação (`--   google-cal-pull-event`). A direção inversa (Google Cal → app) é coberta por `google-cal-sync-events` (chamado via `invoke`).
- **Risco:** Baixo — possível que exista um webhook webhook do Google que chame externamente, mas `google-cal-sync-events` já cobre esse fluxo.
- **Ação:** NEEDS-REVIEW (confirmar se há webhook Google registrado para essa URL antes de deletar)

### 3. `followup-status-callback`
- **Última modificação:** 2026-03-09 (mais antiga da lista de candidatas)
- **Por que candidata:** "Chamado pelo N8N após disparo" — mas não há caller interno nem migration. Se N8N não está configurado com esse webhook, a função está inativa. Última modificação em março sugere não ter recebido updates enquanto o resto do followup stack evoluiu.
- **Risco:** Médio — se N8N estiver configurado com essa URL em produção do The Mentor, deletar quebra o callback de status. Verificar no N8N antes.
- **Ação:** NEEDS-REVIEW (confirmar N8N config no tenant The Mentor)

### 4. `send-status-callback`
- **Última modificação:** (presente mas sem invoke no frontend)
- **Por que candidata:** Não tem `functions.invoke` no frontend. Referenciada apenas em `SystemDocConfig.tsx` (documentação). Callback externo de status de envio — se não há integração externa configurada no The Mentor que chame esse endpoint, está inativa.
- **Risco:** Médio — pode ser chamada por plataformas de SMS/WhatsApp via webhook externo. Verificar se algum provider de mensagens está configurado com essa URL.
- **Ação:** NEEDS-REVIEW

### 5. `instagram-comment-like`
- **Última modificação:** 2026-03-27
- **Por que candidata:** Não chamada por frontend, não chamada por `instagram-automation-runner` (grep retornou vazio), não chamada por `meta-inbound`. Só aparece em `SystemDocConfig.tsx` como documentação. Funcionalidade de "curtir comentário automaticamente" que pode nunca ter sido integrada ao fluxo principal.
- **Risco:** Baixo — nenhum caller interno. Se existe automação configurada no Instagram para acionar, precisaria verificar.
- **Ação:** DELETE (ou NEEDS-REVIEW se The Mentor usa automações de like)

### 6. `instagram-comment-reply`
- **Última modificação:** 2026-04-20
- **Por que candidata:** Não chamada diretamente do frontend (`invoke`), não chamada de `instagram-automation-runner` (grep vazio). Aparece em `SystemDocConfig.tsx`. Porém: foi modificada em abril — pode ser chamada via HTTP direto de `omni-delivery-engine` ou `meta-inbound` sem `functions.invoke`. Merece inspeção adicional.
- **Risco:** Médio — modificada recentemente, pode estar em uso por path não coberto pelo grep de invoke.
- **Ação:** NEEDS-REVIEW

### 7. `omni-merge-person`
- **Última modificação:** 2026-03-14
- **Por que candidata:** Não chamada por frontend, não chamada por outras edge fns via grep. Aparece em `SystemDocConfig.tsx`. Funcionalidade de merge de contatos que pode ter sido integrada diretamente no banco ou substituída.
- **Risco:** Baixo — sem callers. Março 14 é antiga.
- **Ação:** DELETE

### 8. `adm-health-check` (individual)
- **Última modificação:** 2026-03-25
- **Por que candidata:** Existe `adm-health-check-batch` (atualizado 2026-04-23) que foi adicionado para rodar via pg_cron. O `useAdmClients.ts` ainda chama `invokeControlPlane('adm-health-check', ...)` — portanto NÃO é órfã pura. Porém: verificar se o call individual ainda é necessário dado que o batch agora persiste os resultados.
- **Risco:** Alto — frontend ainda chama diretamente.
- **Ação:** KEEP (até refactor do useAdmClients)

---

## Candidatas a NEEDS-REVIEW (não deleta sem confirmação)

| Função | Última modif. | Motivo da dúvida |
|---|---|---|
| `google-cal-pull-event` | — | Pode ter webhook Google registrado externamente |
| `followup-status-callback` | 2026-03-09 | Pode ter URL configurada no N8N do tenant |
| `send-status-callback` | — | Pode ser webhook de provider SMS/WhatsApp |
| `instagram-comment-reply` | 2026-04-20 | Recente; pode ser chamada via fetch direto |

---

## KEEP confirmado (não órfãs)

Todas as funções abaixo têm callers confirmados (frontend invoke, pg_cron, ou chamada interna entre fns):

| Função | Caller |
|---|---|
| `adm-client-config` | Chamada por outras edge fns |
| `adm-create-user` | Frontend + create-tenant-user |
| `adm-health-check` | `useAdmClients.ts` (invokeControlPlane) |
| `adm-health-check-batch` | pg_cron (migrations_adm) |
| `adm-purge-tenant` | pg_cron (migrations_adm soft delete) |
| `adm-rotate-management-token` | `useAdmClients.ts` + pg_cron |
| `adm-sync-client` | Workflow sync-clients.yml |
| `adm-verify-super-admin` | `RestrictedRoute.tsx` (fetch direto) |
| `admin-unenroll-mfa` | Frontend invoke |
| `ai-agent-execute` | Frontend invoke + inbound fns |
| `api-key-auth` | Middleware validação de API keys |
| `auth-login` | `useAuth.ts` (fetch direto) |
| `bi-google-oauth` | Frontend invoke |
| `bi-insights-chat` | Frontend invoke |
| `bi-meta-oauth` | Frontend invoke |
| `bi-sync-google-ads` | pg_cron |
| `bi-sync-meta-ads` | pg_cron |
| `call-pro-webhook` | Webhook Atende Simples (externo) |
| `channel-test-send` | Frontend invoke |
| `coach-email` | Frontend invoke |
| `coach-evaluate` | Frontend invoke |
| `coach-weekly-summary` | pg_cron |
| `conversion-fetch-platforms` | `useConversionConfig.ts` (fetch direto) |
| `conversion-send` | pg_net trigger + pg_cron |
| `create-global-user` | Backend flow |
| `create-tenant-user` | `adm-create-user` |
| `data-deletion` | `DataDeletionPage.tsx` (fetch direto) |
| `data-export-request` | `useDataExportJobs.ts` |
| `delete-user` | Frontend invoke |
| `dispara-webhook` | Frontend invoke |
| `domain-verify` | `WhiteLabelConfig.tsx` |
| `elevenlabs-agent-sync` | `AgenteSingle.tsx` |
| `elevenlabs-sync` | Frontend invoke |
| `elevenlabs-tts` | Frontend invoke |
| `filter-leads-for-send` | Frontend invoke |
| `followup-enqueue` | Frontend invoke |
| `followup-trigger-worker` | Frontend invoke |
| `gemini-live-token` | Novo — BI PRO voice (criado 2026-04-24) |
| `google-cal-availability` | Frontend invoke |
| `google-cal-connect` | Frontend invoke |
| `google-cal-sync-events` | Frontend invoke |
| `google-cal-sync-to-db` | Frontend invoke + pg_net |
| `google-cal-upsert-event` | `useAgendamentos.ts` |
| `instagram-automation-runner` | `meta-inbound` (fire-and-forget) |
| `instagram-oauth` | `InstagramMegaConfig.tsx` (URL direta) |
| `instagram-outbound` | `omni-delivery-engine` (fetch direto) |
| `instagram-posts-list` | Frontend invoke |
| `instagram-token-refresh` | pg_cron |
| `logs-proxy` | Frontend invoke |
| `lp-submit` | Webhook LP público |
| `meeting-followup-auto-setup` | Frontend invoke |
| `meta-inbound` | Webhook Meta (externo) |
| `meta-leadgen-create` | Frontend invoke |
| `meta-leadgen-sync` | Frontend invoke |
| `meta-pages-list` | Frontend invoke |
| `meta-pages-subscribe` | Frontend invoke |
| `meta-save-credentials` | Frontend invoke |
| `mfa-revoke-factor` | **ZERO callers** |
| `ms-teams-connect` | Frontend invoke |
| `ms-teams-upsert-event` | `useAgendamentos.ts` |
| `omni-channel-health-check` | pg_net migration |
| `omni-delivery-engine` | Frontend invoke + pg_net |
| `omni-retry-dead-letter` | pg_cron |
| `process-meeting-followups` | pg_cron + pg_net |
| `prospect-commit` | Backend flow |
| `prospect-enrich-contacts` | `useProspectActions.ts` |
| `prospect-enrich-plugin` | `useProspectActions.ts` |
| `prospect-scorer` | Backend flow |
| `prospect-search-companies` | `useProspectActions.ts` |
| `prospect-search-people` | `useProspectActions.ts` |
| `prospect-test-connection` | Frontend invoke |
| `public-booking` | Booking público |
| `score-re-evaluate` | Chamada fire-and-forget de hooks |
| `send-dispatch-worker` | Frontend invoke + pg_cron |
| `send-invite-email` | Backend flow |
| `send-meeting-confirmation` | `useAgendamentos.ts` |
| `sends-dispatch-batch` | pg_cron |
| `sends-import-contacts` | Frontend invoke |
| `tiktok-ads-sync` | Frontend invoke + pg_cron |
| `tiktok-inbound` | Webhook TikTok (externo) |
| `tiktok-oauth` | OAuth callback (externo) |
| `tiktok-outbound` | Frontend invoke |
| `tiktok-token-refresh` | pg_cron |
| `tldv-sync` | Frontend invoke |
| `tldv-webhook` | Webhook tl;dv (externo) |
| `update-user-email` | Frontend invoke |
| `update-user-password` | Frontend invoke |
| `whatsapp-inbound` | Webhook Meta (externo) |
| `whatsapp-outbound` | Frontend invoke + edge fns |
| `whatsapp-templates-manage` | Frontend invoke |
| `whatsapp-templates-sync` | Frontend invoke |
| `zoom-connect` | Backend OAuth flow |
| `zoom-token-refresh` | pg_cron |
| `zoom-upsert-event` | Backend flow |

---

## Resumo executivo

**Deletáveis com segurança (3):**
1. `mfa-revoke-factor` — zero callers em todo o codebase
2. `omni-merge-person` — zero callers, antiga (março-14)
3. `instagram-comment-like` — zero callers confirmados

**Deletáveis com 1 verificação rápida (4) — precisam de confirmação do lead:**
4. `google-cal-pull-event` — confirmar se há webhook Google externo registrado
5. `followup-status-callback` — confirmar se N8N do The Mentor usa essa URL
6. `send-status-callback` — confirmar se algum provider SMS/WhatsApp usa essa URL
7. `instagram-comment-reply` — confirmar se chamada via fetch direto em algum path

**Se todas 7 forem removidas:** de 100 → 93 functions. Margem de 7 slots para crescimento.

**Mínimo seguro (3 deletes certos):** 100 → 97 functions. Libera 3 slots imediatos.
