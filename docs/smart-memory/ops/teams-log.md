---
title: Teams Log
type: task-log
updated: 2026-05-27
tags: [ops]
---

# Teams Log

Registro de todos os Agent Teams formados neste projeto. Lead (team-os) atualiza a cada `*dispatch` e `*close`.

## 2026-07-02 — Team joaoguirunas-crm-integracao-kiwify

**Objetivo:** Integração Kiwify → CRM (Fase 1) — webhooks de venda/assinatura, movimentação automática de pipeline/stage, automações de WhatsApp configuráveis por produto. Fase 2 (tracking de progresso em área de membros) fora de escopo.
**Lead:** team-os (skill) — nota: `TeamCreate` não existe neste ambiente (deprecado, sessão usa time implícito único); teammates formados via `Agent()` com `name` diretamente, endereçáveis via `SendMessage`.
**Nota de adaptação:** spec original do usuário assumia NestJS+Prisma+BullMQ+Redis+Next.js; usuário confirmou (AskUserQuestion) adaptar para a stack real do projeto (Supabase Edge Functions/Deno + Postgres + React/Vite). Reuso identificado: motor de delayed-jobs `followup-enqueue`/`followup-trigger-worker`/`followup-retry-worker` como equivalente ao BullMQ; `MetaIntegrationConfig.tsx` como referência de design obrigatória.
**Composição (onda 1 — design):**
- dev-analyst — pesquisa API Kiwify (auth, webhooks, payloads, assinatura) → [[../agents/research/kiwify-api-reference]]
- dev-architect — arquitetura adaptada + épico `kiwify-integracao` com stories → [[../project/kiwify-integration-architecture]]

**Status:** ativo
**Início:** 2026-07-02T11:40:00Z
**Stories:** ver [[../stories/BACKLOG]] (épico `kiwify-integracao`, 8 stories GO 5/5)

**Onda 1 (design) — concluída:**
- dev-analyst → [[../agents/research/kiwify-api-reference]] (divergência crítica: assinatura webhook não documentada oficialmente — mecanismo clássico HMAC-SHA1 como TODO(verify))
- dev-architect → [[../project/kiwify-integration-architecture]] + [[../decisions/ADR-KFY-01-reuse-vs-dedicated-queue]] + 8 stories em `stories/backlog/KFY-1.*`

**Decisões ratificadas pelo lead/usuário:**
1. Opt-in WhatsApp: flag explícita `clients_people.whatsapp_optin` + fallback por categoria de template (UTILITY sempre envia, MARKETING exige opt-in)
2. Fila dedicada `kiwify_message_jobs` (não reusar `followup_queue` — drift de schema LIVE + god-path com 2 crons)
3. Criptografia via `app_encrypt_secret`/`app_decrypt_secret` (padrão existente do projeto)

**Dependências humanas registradas (não travam dispatch, travam só enforcement final):**
- Capturar 1 webhook Kiwify real via webhook.site (conta sandbox) para confirmar assinatura + idempotência de `carrinho_abandonado`
- Confirmar escopos OAuth da credencial (sales/products/webhooks)

**Onda 2 (implementação) — CONCLUÍDA, todas 8 stories commitadas localmente:**
- KFY-1.1 (DB schema+seeds+4 stages novas) → dev-data-engineer ✅
- KFY-1.2 (KiwifyApiClient) → dev-dev-beta ✅
- KFY-1.3 (kiwify-connect) → dev-dev-beta ✅
- KFY-1.4 (kiwify-inbound) → dev-dev-beta-2 ✅
- KFY-1.5 (kiwify-process-event + dispatch-worker, GOD NODE) → dev-dev-beta ✅
- KFY-1.6 (kiwify-reconcile) → dev-dev-beta-2 ✅
- KFY-1.7 (painel UI) → dev-dev-alpha ✅
- Fix não-Kiwify achado no caminho: RLS `kiwify_write_managers` 'gestor'→'manager' (mesma classe de bug identificada também em `calcom_connections` — registrada em backlog `FIX-CAL-RLS-01`, aguardando OK do usuário pra aplicar)

**Onda 3 (QA) — CONCLUÍDA:**
- KFY-1.8 QA gate → dev-qa: 1ª rodada FAIL (2 CRITICAL: `messages.source_type` CHECK sem 'kiwify'; UI gravando `id_template` em vez de `name`) → ambos corrigidos (dev-data-engineer migration `20260702140000`, dev-dev-alpha commit `9f64508`) → **PASS FINAL**, 43/43 testes, deploy liberado.

**Status: FASE 1 EM PRODUÇÃO.** Usuário confirmou push em 2026-07-02. Push feito (`8ff40f9`), CI `sync-clients.yml` bloqueado por 2 issues pré-existentes não relacionadas ao Kiwify:
1. Drift no `client-migrations.json` (5 entradas órfãs) — corrigido pelo dev-data-engineer, commitado (`8788c15`).
2. Secret `SUPABASE_ACCESS_TOKEN` ausente no GitHub Actions do repo — **pendência do usuário**, bloqueia deploy automático via CI (não bloqueia o épico: deploy feito via CLI local como workaround).

Deploy final via CLI (dev-devops, autenticado/linkado a `wotuyxscsfralqpoiyfv`): 5 Edge Functions ACTIVE (`kiwify-connect` v1, `kiwify-inbound` v2 — redeploy necessário pra aplicar verify_jwt=false corrigido, `kiwify-process-event` v1, `kiwify-dispatch-worker` v1, `kiwify-reconcile` v1). Todas as migrations aplicadas no LIVE. 8 stories movidas para `stories/done/`.

**Fase 1.5 (course badge) despachada em seguida** — ver stories `KFY-2.1`/`KFY-2.2`/`KFY-2.3` em backlog/active, motivada por pedido do usuário após capturar um webhook real via webhook.site (confirmou formato de assinatura HMAC-SHA1 e nomes de campo reais do payload).

---

## 2026-06-16 — Team joaoguirunas-crm-diagnostico-agent-v5

**Objetivo:** Reescrever prompts do agente "Diagnóstico" (Consultoria) v4 → v5 — corrigir 7 red flags do LIVE, alinhar narrativa canônica dos produtos, padrão Mentoria v10/Curso v9.
**Lead:** team-os (skill)
**Composição:**
- dev-architect — drafts dos 3 blocos (identity, general_rules, step)
- dev-qa — gate formal (após drafts)
- dev-data-engineer — apply LIVE via Safety Protocol (após QA PASS + GO usuário)

**Status:** ativo
**Início:** 2026-06-16T00:00:00Z
**Stories:** [[../stories/active/FIX-AGENT-DIAGNOSTICO-01]]

## 2026-06-15 — Team joaoguirunas-crm-fix-omni-refresh

**Objetivo:** Corrigir botão refresh do Omni PRO (`/omni`) — ícone gira mas dados não atualizam sem reload de página
**Lead:** team-os (skill)
**Composição:**
- dev-dev-alpha — investigar root cause + corrigir
- dev-qa — QA gate com teste runtime obrigatório (QA anterior foi só estático e falhou em detectar o bug)

**Status:** ativo
**Início:** 2026-06-15T20:54
**Stories:** [[../stories/active/FIX-POLLING-REFRESH-01]]

## 2026-06-10 — Team joaoguirunas-crm-template-sync

**Objetivo:** Bug/Fix — sincronização de status dos templates WhatsApp com a Meta API (match por name para pending_*, cron auto-sync, testes automatizados)
**Lead:** team-os (skill)
**Composição:**
- dev-dev-beta — WAT-SYNC-01: lógica 3-level match + soft-delete guard
- dev-dev-delta — WAT-SYNC-02: cron migration + last_synced_at + x-cron-key bypass
- dev-dev-delta — WAT-SYNC-03: 11 testes Deno (6 required + 5 adversariais)
- dev-qa — Gate de qualidade: CONCERNS aprovado (16/17 ACs)

**Status:** ✅ ENCERRADO — aguardando push via dev-devops
**Início:** 2026-06-10T09:00Z
**Encerrado:** 2026-06-10T11:53Z
**Veredicto QA:** ⚠️ CONCERNS aprovado · 16/17 ACs · 2 CONCERNs não-bloqueantes (INFO + LOW)

**Arquivos produzidos:**
- `supabase/functions/_shared/template-sync-lib.ts` (NOVO — core puro testável)
- `supabase/functions/whatsapp-templates-sync/index.ts` (MODIFICADO — import lib + x-cron-key)
- `supabase/functions/whatsapp-templates-sync/index.test.ts` (NOVO — 11 testes Deno)
- `supabase/migrations/20260610000003_whatsapp_template_sync_cron.sql` (NOVO — pg_cron + last_synced_at)

**Commit:** `8653733`

**Ação pendente (não bloqueia):** criar Vault secret `service_role_cron` no Supabase Dashboard para ativar cron job automático.

---

## 2026-06-10 — Team joaoguirunas-crm-motivos-perda

**Objetivo:** Feature — criar conjunto básico de motivos de perda (seed padrão + seletor no kanban + filtro em relatórios)
**Lead:** team-os (skill)
**Composição:**
- dev-data-engineer — LOSS-01: migration seed 5 motivos padrão
- dev-dev-alpha — LOSS-02: seletor kanban+lista · LOSS-03: filtro toolbar + statusDbMap fix
- dev-qa — Gate de qualidade: CONCERNS aprovado (18/18 ACs)

**Status:** ✅ ENCERRADO — aguardando push via dev-devops
**Veredicto QA:** ⚠️ CONCERNS aprovado · 18/18 ACs · 2 observações não-bloqueantes (LOW/INFO)
**Commit:** `3d92e19`

---

## 2026-05-10 — Team joaoguirunas-webhook-template-fix

**Objetivo:** Investigar e corrigir webhook inbound que não está disparando o template WhatsApp automático configurado
**Lead:** team-os (skill)
**Composição:**
- dev-dev-beta — investigar + corrigir `webhook-inbound/index.ts`
- dev-data-engineer — verificar migration + `trigger_config` no DB
- dev-qa — gate formal antes do deploy
- dev-devops — deploy + push do fix

**Status:** encerrado
**Encerrado:** 2026-06-10T04:10:00Z
**Início:** 2026-05-10T22:23
**Stories:** investigação ad-hoc (sem story em backlog)

## 2026-05-10 — Team joaoguirunas-webhook-inbound (sessão direta)

**Objetivo:** Configurações e novas features — Webhook Inbound, templates WhatsApp, agente IA Mentoria
**Lead:** team-os (sessão principal, sem subagentes)
**Status:** ✅ ENCERRADO

**Entregas:**
- Feature completa Webhook Inbound (tabela + edge function + UI + registry)
- Fix Instagram verify token (`INSTAGRAM_VERIFY_TOKEN=growthsales_meta_verify`)
- Fix cor active na sidebar de settings (`bg-primary/10` em vez do marrom errado)
- Template `abertura_mentoria` criado na Meta (PENDING) + 10 templates deletados
- Variável `primeiro_nome` adicionada ao sistema de templates (templateUtils + modal + dispatch worker)
- Agente IA **Mentoria João Guirunas** criado: 1 step único, pipeline Mentoria, LLM gpt-4o-mini, voice ElevenLabs eleven_flash_v2_5

**Commits principais:**
- `77c69369` — feat: webhook-inbound feature completa
- `15545cc7` — feat: primeiro_nome variable
- `5a82d657` — feat: Mentoria agent criado
- `0984427c` — refactor: Mentoria agent → 1 step único

---

## 2026-05-05 — Team ora-audit-fix-closeout

**Objetivo:** Zerar todas as AUDIT-FIX stories (P0 e P1) — closeout completo da epic
**Lead:** team-os (skill)
**Composição:**
- dev-alpha — AUDIT-FIX-01 (rotas), AUDIT-FIX-05 (@ts-nocheck), AUDIT-FIX-11 (UX)
- dev-beta — AUDIT-FIX-07 (auth flash), AUDIT-FIX-08 (conversas/demo security)
- dev-delta — AUDIT-FIX-09 (code hygiene)
- dev-data — AUDIT-FIX-04 (db verify), AUDIT-FIX-10 (schema ADR + RealtimeContext)
- dev-devops — commits + push

**Status:** encerrado ✅
**Início:** 2026-05-05T01:40
**Encerrado:** 2026-05-05T01:50
**Stories entregues:** AUDIT-FIX-01..11 (11 stories — epic zerada)
**Destaques:**
- Regressão de segurança /conversas/demo detectada e corrigida (requireGestor)
- admin-unenroll-mfa restaurado (deletado por engano no cleanup ADM)
- ADR-SCHEMA-MIGRATION atualizada com status real
- 0 erros TypeScript em todos os arquivos tocados

## 2026-05-03 — Team ora-coach-pro-scorecard-preview

**Objetivo:** CP-4 AC3 — aba Preview Scorecard no PlaybookEditor do CoachProConfig
**Lead:** team-os (skill)
**Composição:**
- dev-dev-gamma — criação de `ScorecardPreview.tsx` + tabs no `PlaybookEditor`
- dev-qa — gate formal AC3

**Status:** ✅ ENCERRADO
**Entregas:**
- `src/components/coach/ScorecardPreview.tsx` (criado, 104 linhas)
- `src/components/config/CoachProConfig.tsx` (tabs Editor/Preview no PlaybookEditor)
**QA:** PASS 8/8 — zero regressões
**Follow-ups residuais (não-bloqueantes):** AC8 mobile LOW, eslint pré-existente LOW

---

## 2026-05-02 — Team ora-text-agents-audit-fix

**Objetivo:** Auditoria e correção dos agentes de IA de texto ORA (Erika Crivellari) — verificação de fluxo, ferramentas de agendamento, 13 objeções, FUPs de cadência (4 flows × 5 msgs) e FUPs pós-agendamento (3 msgs), conforme documento "ORA - Script contato msg.pdf"
**Lead:** team-os (skill)
**Composição:**
- dev-analyst — gap analysis: estado atual vs documento de planejamento
- dev-data-engineer — SQL correctivo em supabase/seeds/demo-2026-05-02/11_ora_text_agents_fups.sql
- dev-qa — gate formal de qualidade antes da execução

**Status:** 🔄 EM ANDAMENTO
**Escopo:** Somente dados (INSERT/UPDATE) — zero schema changes
**Tabelas:** ai_agents, ai_agents_steps, leads_stages_followups, meetings_followups
**Documento de referência:** ORA - Script contato msg.pdf (14 páginas)

---

## 2026-05-02 — Team ora-elevenlabs-agent-sync

**Objetivo:** Diagnóstico e correção completa da integração ElevenLabs — campos atualizados no ORA não sincronizavam com a API
**Lead:** team-os (skill)
**Composição:**
- dev-analyst — diagnóstico root cause + documentação em agents/research/
- dev-dev-beta — fix edge function elevenlabs-agent-sync (endpoint POST /create, sanitizeTtsModel, erros estruturados)
- dev-dev-alpha — fix frontend: campos identidade/regras_gerais no VoiceAgentConfigTab, save-before-sync, cache invalidation
- dev-qa — gate formal PASS (4 LOW não-bloqueantes documentados)

**Status:** ✅ PASS — aguardando `supabase functions deploy elevenlabs-agent-sync`
**Arquivos modificados:**
- `supabase/functions/elevenlabs-agent-sync/index.ts` — endpoint POST `/create`, `sanitizeTtsModel()`, erros JSON estruturados
- `src/pages/AgenteSingle.tsx` — `performSync` + `handleSync` refatorados, save-before-sync, cache invalidation
- `src/components/agentes-ia/VoiceAgentConfigTab.tsx` — SectionCard identidade + regras_gerais

**Issues LOW (não-bloqueantes):**
- `eleven_v3` visível no dropdown mas silenciosamente substituído por `eleven_flash_v2_5` no backend
- Preview de áudio sem cleanup (múltiplos cliques sobrepõem)
- Edge fn sem entrada em `supabase/config.toml`
- Race teórica em network error pré-edge fn

---

## 2026-05-02 — Team ora-agents-pro-fix

**Objetivo:** Remodel completo do módulo Agents Pro — voice agent UI simplificada ElevenLabs + audit backend + VoiceConfigTab dedicado
**Lead:** team-os (skill)
**Branch:** main (direto)
**Composição:**
- dev-dev-alpha — remodel AgenteSingle.tsx (layout voice simplificado)
- dev-dev-beta — audit + fix edge fns ElevenLabs (4 bugs corrigidos)
- dev-dev-gamma — VoiceAgentConfigTab.tsx (componente novo, 634 linhas)
- dev-qa — gate formal PASS 8/8

**Status:** ✅ PASS — aguardando commit/deploy aprovação usuário
**Arquivos modificados:**
- `src/pages/AgenteSingle.tsx` — branch voice: 2 tabs, sync button bg-purple-600, badges status
- `src/components/agentes-ia/VoiceAgentConfigTab.tsx` — novo, 5 seções EL + sidebar
- `supabase/functions/elevenlabs-agent-sync/index.ts` — 4 bugs: voice_id null, model_id null, upsert incompleto, erro silencioso

**Pendente:** `supabase functions deploy elevenlabs-agent-sync` (autoridade devops)

## 2026-05-02 — Team ora-coach-pro-ux-full

**Objetivo:** Refinamento completo Coach Pro — UI enterprise, filtros, charts, config single-screen, meetings list e single view com foco em UX
**Lead:** team-os (skill)
**Branch:** main (direto)
**Composição:**
- dev-architect — stories CP-1..CP-7
- dev-ux — specs visuais + brandbook charts + coach-pro-specs.md
- dev-dev-alpha — CoachDashboard (CP-1), CoachTeamBoard (CP-2), CoachConsultantProfile (CP-3)
- dev-dev-gamma — CoachProConfig single-screen (CP-4), Reunioes lista + filtros (CP-5)
- dev-dev-beta — ReuniaoSingle (CP-6), CoachMeetingEvaluation (CP-7)
- dev-qa — baseline agora + veredicto final

**Status:** ⚠️ CONCERNS — PUSH AUTORIZADO (2026-05-03T01:20)
**Veredicto QA:** Phase 2 PASS + Phase 3 CONCERNS (não-bloqueantes) — epic aprovado para push
**Stories:** ver [[../stories/BACKLOG]]

**Entregas finais:**
- ✅ CP-1 `CoachDashboard.tsx` — KPI strip enterprise, filtros time/consultor, Recharts ComposedChart (Area+gradient+benchmark dashed)
- ✅ CP-2 `CoachTeamBoard.tsx` — BenchmarkStrip 5 MetricCells, sparklines, filtros
- ✅ CP-3 `CoachConsultantProfile.tsx` — ComposedChart + RadarChart vs equipa, top 3 critérios, playbook breakdown
- ✅ CP-4 `CoachProConfig.tsx` — single-screen sidebar+editor, auto-save debounce, soma de pesos, inputs enterprise
- ✅ CP-5 `Reunioes.tsx` — JOIN coach evaluations, ScoreBadge+DealRiskBadge na lista, filtros Coach multi-select
- ✅ CP-6 `ReuniaoSingle.tsx` — CoachProSummary 4 estados, hero enterprise, tokens corretos
- ✅ CP-7 `CoachMeetingEvaluation.tsx` — RadialBarChart, Talk Ratio stacked, bug filtro seções corrigido, Flow Map timeline
- ✅ Seed `08_coach_pro.sql` — scores 0-100 → 0-10
- ✅ `MeetingRecordCard.tsx` — gauge, thresholds e label alinhados 0-10

**Follow-ups (não bloqueantes):**
- CP-4b: ScorecardPreview component (MEDIUM)
- CP-4c: mobile responsive CoachProConfig (LOW)
- ESLint: 3 warnings em CoachProConfig + Reunioes (LOW)

**Pendente:** commit + push (autoridade usuário/devops)

---

## 2026-05-02 — Team ora-bi-refinamento

**Objetivo:** Refinamento do módulo BI — voz ElevenLabs inteligente + redesign enterprise de todas as telas BI
**Lead:** team-os (skill)
**Branch:** main (direto)
**Composição:**
- dev-architect — stories BI no BACKLOG
- dev-ux — spec visual enterprise (todas as telas)
- dev-dev-beta — voice sanitizer (markdownToVoiceText + sumarizador)
- dev-dev-alpha — redesign BIProInsightsTab + BIProSummaryBar
- dev-dev-gamma — redesign BIProComercialTab + BIProRevOpsTab + BIProMarketingTab
- dev-qa — gate formal

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes) 🟡
**Início:** 2026-05-02T20:22
**Stories:** ver [[../stories/BACKLOG]] bloco BI PRO

## 2026-05-02 — Team ora-elevenlabs-voice-ui

**Objetivo:** Corrigir integração ElevenLabs end-to-end (sync UUID→string ID) + melhorar UX da página de configuração de agentes de voz — botão sync, link correto, aba Prompts oculta para voz.
**Lead:** team-os (skill)
**Team dir:** ad-hoc (sem TeamCreate formal)
**Composição:**
- dev-dev-alpha — implementação frontend (AgenteSingle.tsx + ConfiguracaoTab.tsx)

**Status:** encerrado ✅
**Início:** 2026-05-02T20:00
**Encerrado:** 2026-05-02

**Entregas:**
- [x] `supabase/functions/elevenlabs-agent-sync/index.ts` — bug corrigido: função usava UUID FK (`ai_agents.elevenlabs_agent_id`) diretamente na URL da API ElevenLabs; fix: join com `elevenlabs_agents` para resolver o EL string ID real (`agent_5301kb365...`)
- [x] `ai_agents.identity` — atualizado para prompt completo (7168 chars) via REST API
- [x] `src/components/disparos/ImportListaTab.tsx` — TDZ bug corrigido: `currentUserTeamId` useMemo movido para antes dos outros memos dependentes
- [x] `src/pages/AgenteSingle.tsx` — `handleSync` extraído como função standalone; botão "Sincronizar" adicionado no header (somente para `agent_type='voice'`); aba "Prompts" ocultada para agentes de voz
- [x] `src/components/agentes-ia/ConfiguracaoTab.tsx` — link ElevenLabs corrigido (UUID FK → EL string ID via `useElevenLabsAgents`); botão "Sincronizar agora" adicionado no card de Sincronização; UUID exibido agora é o ID real do EL

**Feedback registrado:** Lead deve distribuir trabalho para agentes (dev-dev-*), não executar edições de código diretamente.

---

## 2026-05-02 — Team ora-sim-dados-apresentacao

**Objetivo:** Dados demo para apresentação + CoachPRO funcional com playbooks da Erika
**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/ora-sim-dados-apresentacao/` (removido)
**Composição:**
- dev-analyst — schema analysis → `agents/data-engineer/schema-analysis.md`
- dev-data-engineer — insertion plan → `agents/data-engineer/insertion-plan.md`
- dev-architect — stories do backlog → `stories/backlog/sim-*`

**Status:** encerrado ✅
**Início:** 2026-05-02T17:49
**Encerrado:** 2026-05-02

**Entregas:**
- [x] `useCoachEvaluations.ts` + `useCoachTeam.ts` — prefixos `coach_*` corrigidos para nomes reais de tabela
- [x] `supabase/seeds/demo-2026-05-02/09_erika_playbooks.sql` — 2 playbooks Erika (1ª e 2ª Reunião), 14 secções, 46 critérios; substitui todos os playbooks anteriores
- [x] `supabase/seeds/demo-2026-05-02/08_coach_pro.sql` — 12 reuniões demo com avaliações (6 × 1ª Reunião + 6 × 2ª Reunião), scores, transcripts
- [x] `supabase/seeds/demo-2026-05-02/10_fix_playbook_criteria.sql` — 4 critérios em falta adicionados (SPIN profissional S3, confidencialidade S6, necessidade acumulada+tabelas S3-2ª, desafio da companhia S4-2ª)
- [x] `playbook_templates` — apenas 2 templates da Erika (sistema)

**Pendente (próxima sessão):**
- [ ] Redesign UX página configuração CoachPRO (`src/components/config/CoachProConfig.tsx`) — lista + single view, enterprise
- [ ] BI retornando dados incorretos de leads (bug a investigar)

---

## 2026-05-01 — Team ora-sends-pro-disparo-rca

**Objetivo:** Investigar (sem implementar) por que mensagens WhatsApp do SENDS PRO não estão sendo disparadas no ORA. Missão: entender o fluxo de disparo end-to-end e identificar onde está o bloqueio atual.

**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/ora-sends-pro-disparo-rca/`
**Composição (5 teammates):**
- dev-analyst — RCA consolidado em `agents/research/2026-05-01-sends-disparo-rca.md`
- dev-data-engineer — pacote A-F em `agents/data-engineer/2026-05-01-sends-disparo-investigacao.md` + execução via MCP do team-lead
- dev-dev-beta — audit edge fns em `agents/research/2026-05-01-sends-edge-fns-audit.md`
- dev-dev-gamma — audit frontend em `agents/research/2026-05-01-sends-frontend-audit.md`
- dev-architect — 4 stories formais em `stories/backlog/`

**Status:** encerrado ✅
**Início:** 2026-05-01T18:00
**Encerrado:** 2026-05-01T18:25
**Restrição:** ZERO escrita em código/banco. Read-only. Implementação fica para próxima sessão.

**Veredicto final:**
- Bug original (mensagens não disparam) já estava fechado desde 2026-05-01T17:13 pelo fix anterior (JWT desync + schema drift, commit 8a4d2f8).
- Confirmação empírica: campanha `eduteste1` (id `865b3dff-ba81-4c22-9886-1ac1b5f80872`) disparada às 18:08:20, completou em 1s, `wa_message_id=wamid.HBgN...` retornado pela Meta, user (Eduardo Freitas, 5521991426882) confirmou recebimento real no WhatsApp.
- Pipeline end-to-end OK: `sends_contacts.status=sent`, `messages` id=35 com wamid, template `ora_primeiro_contato` resolvido, canal "Ora" (default, ativo, token 202 chars), `WHATSAPP_ACCESS_TOKEN` env UNSET (recomendação cumprida).
- Gap arquitetural confirmado empiricamente: `sends_contacts.delivered_at=NULL` apesar de entrega real → confirma análise do `send-status-callback` órfão (`whatsapp-inbound:512-515` descarta `statuses[]`).

**Stories produzidas (todas com 5-point checklist GO 5/5):**
- [[../stories/backlog/FIX-SENDS-STATUS-BRIDGE-01]] (P1, M) — bridge `whatsapp-inbound` + trigger SQL para destravar `delivered_at`/`read_at`
- [[../stories/backlog/FIX-SENDS-CRON-LEGACY-URLS]] (P1, S) — corrigir crons `google-calendar-sync`, `process-meeting-followups`, `conversion-send` apontando para control plane antigo
- [[../stories/backlog/FIX-SENDS-FE-VALIDATION]] (P2, M) — 3 gaps frontend: filtro template, variables_map UI, handleAtivar sem feedback
- [[../stories/backlog/OBS-DISPATCH-HEALTH-01]] (P3, M) — view + RPC + card de saúde do disparo

**Lição aprendida:** `[[../../../../.claude/projects/-home-eduardo-Projetos-iatize-ClaudeCode-GROWTH-ora/memory/feedback_empirical_test_first]]` — quando inspeção DB-side está verde mas user persiste reclamação, teste empírico de 1 contato é mais barato que pacote SQL forense.

---

## 2026-05-01 — Team ora-commit-push-migrations

**Objetivo:** Commit e push das migrations e fixes de save_agent_complete
**Lead:** team-os (skill)
**Composição:**
- dev-devops — commit + push (main, commit 8a4d2f8)

**Status:** encerrado
**Início:** 2026-05-01T17:24
**Encerrado:** 2026-05-01T17:27
**Resultado:** Push OK — `e208cf3..8a4d2f8` em main

---

## 2026-05-01 — Team ora-run-pending-migrations

**Objetivo:** Identificar e executar as migrations pendentes do banco de dados com segurança
**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/ora-run-pending-migrations/`
**Composição:**
- dev-data-engineer — listar migrations pendentes e aplicar (snapshot → dry-run → apply → smoke-test)

**Status:** encerrado
**Início:** 2026-05-01T14:05
**Encerrado:** 2026-05-01T17:14
**Arquivos produzidos:**
- `supabase/migrations/20260501140000_ora_schema_drift_reconcile.sql`
- `supabase/migrations/rollbacks/20260501140000_rollback.sql`
- `supabase/client-migrations.json` (entry order 10199 adicionada)
- `docs/smart-memory/agents/data-engineer/migration-status.md` (atualizado)
- `docs/smart-memory/agents/data-engineer/migrations-log.md` (entry adicionada)

---

## 2026-05-01 — Team ora-fix-agent-save-409

**Objetivo:** Corrigir erro 409 no save de agentes — FK violation em `ai_agents_history.created_by` não encontrado em `settings_users`
**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/ora-fix-agent-save-409/`
**Composição:**
- dev-data-engineer — investigar RPC `save_agent_complete` e FK constraint, aplicar fix com protocolo seguro
- dev-dev-gamma — inspecionar frontend `/settings/crm/aiagents/:uuid` e payload enviado ao RPC
- dev-qa — gate de qualidade formal (PASS/CONCERNS/FAIL/WAIVED) após fix

**Erro:** `23503` — `ai_agents_history.created_by = cbc5162a-d420-40ab-9799-878a9d74de86` não existe em `settings_users`
**Status:** encerrado ✅
**Início:** 2026-05-01T16:48
**Encerrado:** 2026-05-01T17:02
**Commit:** `01feb42`
**QA:** CONCERNS (não-bloqueante) — Axikar
**Fix:** RPC `save_agent_complete` agora resolve `created_by` defensivamente via lookup `settings_users.auth_user_id`

---

## 2026-05-01 — Team rev-os-bugfix-3criticos

**Objetivo:** 3 bugs críticos — sends entrega, agentes-ia save, tl;dv API key
**Lead:** team-os (skill)
**Composição:**
- dev-dev-beta — Bug 1 (sends) + Bug 2 (tl;dv)
- dev-dev-alpha — Bug 3 (agentes-ia save)
- dev-qa — Gate formal
- dev-devops — Commit + push

**Status:** encerrado ✅
**Commits:** `b5d823dd`, `ac4a925d`

**Bugs resolvidos:**
- [x] Sends: `{{2}}` expunha telefone em templates ORA — `variables_map` agora sobrescreve hardcoded mesmo quando campo vazio
- [x] tl;dv: `display_name NOT NULL` faltava no upsert — adicionado `display_name: 'tl;dv'`
- [x] Agentes Pro: UUID vazio causava exception silenciosa na RPC — guards em 3 camadas (client, RPC, state)

## 2026-04-30 — Team rev-os-ora-bug-fix

**Objetivo:** Correção urgente de 3 bugs críticos no cliente ORA
**Lead:** team-os (skill)
**Composição:**
- dev-dev-gamma — Bug 1: Omni não aciona agente IA (fullstack)
- dev-dev-alpha — Bug 2 frontend: Agente IA não salva config / não adiciona etapas
- dev-dev-beta — Bug 2 backend: save config + Bug 3: sends edge function non-2xx
- dev-qa — Gate de qualidade formal (aguarda fixes)
- dev-devops — Push após QA PASS

**Bugs:**
1. Omni: lead na etapa "agente IA" não aciona o agente IA (agente ORA ID: `4906fcb7-2057-4007-b946-4a652aea6b9f`)
2. Agente IA: não salva configurações / não adiciona etapas
3. Sends: "Erro ao iniciar disparo: Edge Function returned a non-2xx status code"

**Status:** encerrado ✅
**Início:** 2026-04-30T22:00
**Encerrado:** 2026-05-01T01:35
**Commits:** `6154033c` (gamma) · `cb64b466` (alpha) · `35276fc0` (beta) · `6f27ccf6` (lead+devops)
**QA:** CONCERNS — 2 low não-bloqueantes (type mismatch Etapa→EtapaPayload; stage_trigger sem ai_processing_lock)

---

## 2026-05-01 — Team ora-taskforce-sends-omni

**Objetivo:** Taskforce rápida — 2 bugs específicos no ORA:
1. SENDS PRO: template enviado aparece no Omni mas não chega ao WhatsApp do cliente
2. Omni: agente IA não ativa conversacional mesmo com lead na etapa correta e agente configurado

**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/ora-taskforce-sends-omni/`
**Composição (sequencial):**
- dev-analyst — RCA dos 2 bugs → `agents/research/2026-05-01-taskforce-sends-omni-rca.md`
- devs (alpha/beta/gamma) — spawnados após RCA, conforme indicação do analyst

**Sem QA, sem architect, sem story formal.** Usuário valida manualmente.
**Ignora backlog FIX-SENDS-* / FIX-OMNI-* existente** — taskforce isolada.

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes) (analyst em RCA)
**Início:** 2026-05-01

---

## 2026-05-01 — Team ora-fix-sends-module

**Objetivo:** Aprimorar módulo Sends — fix bug crítico (primeira mensagem do disparo aparece no Omni mas não chega ao cliente) + triar/resolver backlog FIX-SENDS-*
**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/ora-fix-sends-module/`
**Composição (squad completa, todas em paralelo desde T0):**
- dev-analyst — root cause do bug "primeira mensagem não envia" → `agents/research/sends-first-message-bug.md`
- dev-architect — triagem do backlog FIX-SENDS-* + criar `FIX-SENDS-FIRST-MSG-01` → `agents/architect/sends-backlog-triage.md`
- dev-dev-beta — fixes server-side (dispatcher/worker/queue/edge fns)
- dev-dev-gamma — cross-layer Omni UI ↔ dispatch
- dev-dev-delta — hardening adversarial + edge cases (`agents/research/sends-hardening-audit.md`)
- dev-qa — gate de qualidade formal (PASS/CONCERNS/FAIL/WAIVED)
- dev-devops — push + PR + deploy edge fns (autoridade exclusiva)

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes) (7 teammates em paralelo)
**Início:** 2026-05-01T06:00Z
**Stories:** FIX-SENDS-FIRST-MSG-01 (a ser criada) + triagem de 16 stories FIX-SENDS-* / SENDS-* / CLEAN-SENDS-* no backlog

---

## 2026-04-30 — Team rev-os-taskforce-bugs-criticos

**Objetivo:** Taskforce máxima para correção urgente de bugs críticos — IG/Omni mensagens/automações/sends parados + SENDS import campos hardcoded
**Lead:** team-os (skill)
**Composição:**
- dev-dev-beta — Track A Backend: Instagram meta-inbound, outbound, token refresh, automation-runner
- dev-dev-alpha — Track A Frontend: Omni UI, mensagens IG não aparecem na sidebar
- dev-dev-gamma — Track B: SENDS import campos hardcoded (Q-fields), FIX-SENDS-IMPORT-05/06
- dev-data-engineer — DB: schema lead_field_definitions, q_field columns, omni_channel_configs
- dev-dev-delta — Root cause investigation cross-track + hardening
- dev-qa — Gate de qualidade formal (PASS/FAIL)
- dev-devops — Commits + PR após aprovação QA

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes)
**Início:** 2026-04-30T18:45
**Stories:** FIX-SENDS-IMPORT-05, FIX-SENDS-IMPORT-06, FIX-OMNI-01, FIX-IG-AUT-02 + novos bugs IG

## 2026-04-30 — Team rev-os-fix-sends-import-campos

**Objetivo:** Corrigir bugs no import de sends — campos personalizados invisíveis sem createLeads, e campo lead_control sem input estático
**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/rev-os-fix-sends-import-campos/`
**Composição:**
- dev-architect — criar stories FIX-SENDS-IMPORT-05 e FIX-SENDS-IMPORT-06
- dev-dev-gamma — implementar fixes em FieldMapper.tsx e ImportListaTab.tsx
- dev-qa — gate de qualidade, veredicto formal
- dev-devops — commit, push (sem redeploy de edge fn)

**Stories:**
- [[../../stories/backlog/FIX-SENDS-IMPORT-05]] — campos personalizados de negócio invisíveis sem createLeads
- [[../../stories/backlog/FIX-SENDS-IMPORT-06]] — lead_control estático removido do import (regressão SENDS-IMPORT-01)

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes)
**Início:** 2026-04-30

---

## 2026-04-22 — Team discovery-20260422

**Objetivo:** Bootstrap — descoberta inicial do projeto rev-os
**Lead:** team-os (skill, addressable: `team-lead`)
**Team dir:** `~/.claude/teams/discovery-20260422/`
**Composição:**
- dev-architect — modules, architecture (✅ 22:14)
- dev-analyst (lyra) — tech-stack, conventions (✅ 22:19)
- dev-data-engineer (byte) — schema Supabase (✅ 22:14)
- dev-ux — catálogo de componentes UI (✅ 22:20)

**Status:** fase 1+2 concluídas (pendente shutdown gracioso + TeamDelete)
**Início:** 2026-04-22T22:03
**Fase 1 entrega:** 2026-04-22T22:20 (~17 min wall-clock; 4 teammates paralelos)
**Fase 2 dispatch:** 2026-04-22T22:31 (3 novos teammates spawnados: dev-dev-alpha/beta/gamma)
**Fase 2 entrega:** 2026-04-22T22:43 (~12 min wall-clock; 7 teammates paralelos; 13 deep-dives)
**Síntese final:** 2026-04-22T22:45 ([[../project/modules/README]])
**Stories:** ~40 candidatas mapeadas pelos teammates (ADM-V3-01→10, AUTH-V2-01→12, US-CFG-01→08, P0 prospect, P1 sends/coach/schedule, etc) — popular `[[../stories/BACKLOG]]` no próximo ciclo via `/team-os *plan`
**Resultado:** Smart-memory populada com 7 arquivos (overview síntese pelo lead + 5 entregas dos teammates + shared-context + delegation-log):
- [[../project/overview]] (síntese do lead)
- [[../project/modules]] (16.7 KB, dev-architect)
- [[../project/architecture]] (13.4 KB, dev-architect, com 5 diagramas Mermaid)
- [[../project/tech-stack]] (4.8 KB, dev-analyst)
- [[../project/conventions]] (6.8 KB, dev-analyst)
- [[../agents/data-engineer/schema]] (29.5 KB, dev-data-engineer, ~713 migrations mapeadas)
- [[../agents/ux/components]] (24 KB, dev-ux, 300+ custom + 55+ shadcn/ui)

**Observações operacionais:**
- Architect + data-engineer concluíram trabalho antes de enviar SendMessage de notificação (foi detectado via inspeção do disco primeiro; mensagens chegaram ~1 min depois, enfileiradas).
- Data-engineer marcou task #3 como `completed` no turno anterior (housekeeping resolvido).
- Analyst e UX seguiram protocolo completo (SendMessage + TaskUpdate) em tempo real.
- Task list final: 4/4 `completed`.

**Follow-ups surfaced pelos teammates (candidatos a backlog — consolidados no [[../project/modules/README#inventário-de-bugs-e-débito-técnico-16-itens-consolidados]]):**

**Bugs (4 críticos):**
- 🔴 P0 — Prospect v1 edge fns quebradas (`prospect-scorer`, `prospect-commit` ainda referenciam `establishment_id`)
- 🟠 P1 — SENDS dispatch loop em browser (setInterval)
- 🟠 P1 — COACH hooks consultam view `coach_meeting_evaluations` que pode não existir
- 🟠 P1 — SCHEDULE capability token usando `user_id` no lugar de `tenant_id` (linha 108)

**ADRs pendentes (9):**
- 3 referenciados em código mas sem arquivo: SP-02 (capability tokens HMAC), PP-03 (server-verified tenant_id), N8N-WAA-5/6/7/8 (rework WhatsApp→AI)
- 4 sugeridos por architect/adm: ADM-01 → 04
- 4 sugeridos por architect/auth: AUTH-01 → 04

**~40 stories candidatas** catalogadas (ADM-V3-01→10, AUTH-V2-01→12, US-CFG-01→08, etc) — ver deep-dives individuais em `[[../project/modules/]]`.

---

---

## 2026-04-27 — Team rev-os-audit-followups-config

**Objetivo:** Auditoria completa das configurações de followups — agendamento e etapas do funil — campos obsoletos (n8n etc.), funcionalidades incompletas, schema DB
**Lead:** team-os (skill)
**Composição:**
- dev-analyst — campos obsoletos, referências n8n, dead code em configs
- dev-dev-alpha — componentes React (9 em followups/ + 3 configs)
- dev-data-engineer — schema DB followup/stage/pipeline + edge functions
- dev-architect — síntese diagnóstico + stories FWUP-*

**Status:** encerrado ✅
**Início:** 2026-04-27T00:00:00
**Encerrado:** 2026-04-28T22:30
**Stories entregues:** FWUP-01 a FWUP-17 (todas aplicadas em tenants)
**Resultado:** Sistema estável — ORA e The Mentor operacionais, 187 migrations propagadas

## 2026-04-30 — Team rev-os-bugs-plataforma

**Objetivo:** Bugs gerais de plataforma — Instagram automações (brandbook comments não aparecem na lista em configurações)
**Lead:** team-os (skill)
**Team dir:** `~/.claude/teams/rev-os-bugs-plataforma/`
**Composição:**
- dev-architect — stories formais do bug
- dev-dev-alpha — investigação + fix frontend
- dev-dev-beta — investigação + fix backend
- dev-qa — gate de qualidade formal
- dev-devops — push + PR

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes)
**Início:** 2026-04-30T13:27
**Stories:** ver [[../stories/BACKLOG]]

---

## 2026-04-30 — Team rev-os-correcao-bugs-plataforma

**Objetivo:** Correção de pequenos bugs na plataforma geral
**Lead:** team-os (skill)
**Composição:**
- dev-dev-gamma — investigação e correção fullstack de bugs
- dev-dev-delta — hardening e validação adversarial
- dev-qa — gate de qualidade formal
- dev-devops — push e criação de PRs

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes)
**Bugs em progresso:**
- Bug #1: Upload de logo de clientes falha com erro (testado em ORA)

**Stories:** ver [[../stories/BACKLOG]]

---

## 2026-04-30 — Team rev-os-sends-pro-deploy-fix

**Objetivo:** Resolver falha de deploy do CI (prospect-search-people bloqueando Sync Clients), deployar funções sends pendentes (sends-import-contacts, sends-dispatch-batch), verificar completude de SENDS-IMPORT-02 e rodar auditoria SENDS-FIX-01.
**Lead:** team-os (skill)
**Composição:**
- dev-devops — fix CI + deploy manual das funções sends pendentes
- dev-qa — verificação AC-por-AC de SENDS-IMPORT-02 e FIX-SENDS-01 + veredicto formal
- dev-dev-delta — auditoria adversarial SENDS-FIX-01 → audit-sends-pro.md

**Causa raiz identificada:** `Sync Clients` run #25189020879 falhou com `esm.sh 522` em `prospect-search-people` — funções ordenadas alfabeticamente, `sends-*` não chegaram a ser deployadas.

**Status:** encerrado ✅
**Início:** 2026-04-30T21:15
**Encerrado:** 2026-04-30T21:34
**Stories entregues:** SENDS-IMPORT-02 (done), FIX-SENDS-01 (done), SENDS-FIX-01 (done) + 8 novas stories P1/P2 no backlog
**Commits:** 9bb488cc (build fix callPro+BiVoice), fb044b31 (QA verdicts + migration cleanup + config.toml)
**Resultado:** CI corrigido, sends-import-contacts (v23) e sends-dispatch-batch (v2) deployados, audit completo, migration dedup removida

### Progresso Gravok (dev-devops) — 2026-04-30T21:10

**Fix CI:**
- Causa raiz: `prospect-search-people` e mais 9 arquivos importavam `@supabase/supabase-js@2.76.1` (versão pinada). CDN esm.sh retornou 522 ao tentar resolver versão específica.
- Fix: normalizado para `@supabase/supabase-js@2` em 10 arquivos (`prospect-search-people`, `prospect-commit`, `prospect-enrich-plugin`, `prospect-enrich-contacts`, `prospect-scorer`, `prospect-search-companies`, `prospect-test-connection`, `filter-leads-for-send`, `_shared/prospect-providers.ts`, `_shared/explorium.ts`)
- Commit: `23f7fd60` — `fix(edge-functions): normalizar imports esm.sh supabase-js de @2.76.1 para @2`
- Push: main — OK
- CI re-trigger: run #25189509388 — **success** (8m37s) — "Deploy control-plane edge functions" passou sem 522; "Run sync" concluído

**Deploy manual (garantia):**
- `sends-import-contacts` — ACTIVE, versão 23, 2026-04-30T21:10:43
- `sends-dispatch-batch` — ACTIVE, versão 2, 2026-04-30T21:10:48

---

## 2026-04-30 — Team rev-os-sends-pro-revisao-completa

**Objetivo:** Revisão completa do SENDS PRO — simplificar importação (remover templates prontos), expandir campos mapeáveis (Q-fields, score, empresa, personalizados) e auditar/corrigir todas as quebras do módulo.
**Lead:** team-os (skill)
**Composição:**
- dev-architect — criar stories (SENDS-IMPORT-01, SENDS-IMPORT-02, SENDS-FIX-01)
- dev-dev-gamma — implementação fullstack (ImportListaTab + FieldMapper + sends-import-contacts)
- dev-dev-delta — auditoria adversarial de quebras
- dev-qa — gate de qualidade formal
- dev-devops — PR (acionado após veredicto QA)

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes)
**Início:** 2026-04-30T14:05
**Stories:** SENDS-IMPORT-01, SENDS-IMPORT-02, SENDS-FIX-01

**PR:** https://github.com/joaoguirunas/growthsalesapp/pull/47
**Veredicto QA:** PASS (com débito documentado)
**Status:** encerrado — aguardando merge
**Redeploy obrigatório pós-merge:** `supabase functions deploy sends-import-contacts --no-verify-jwt --project-ref ohzwetkaazgxafubzvop`

## 2026-05-03 — Team ora-bugfix-whatsapp

**Objetivo:** Squad de correção de bugs contínua — WhatsApp integração e fila de bugs
**Lead:** team-os (skill)
**Composição:**
- analyst-1 (dev-analyst) — investigar Bug #1 WhatsApp pipeline/etapa
- analyst-2 (dev-analyst) — fila para próximos bugs
- dev-beta (dev-dev-beta) — correções backend
- dev-gamma (dev-dev-gamma) — correções fullstack/UI

**Status:** encerrado ✅
**Bug #1:** WhatsApp primeira mensagem recebida não atualiza pipeline/etapa do lead
**Encerrado:** 2026-05-04
**Resultado:** Remoção do módulo ADM concluída — commit 25c7b606. 31 arquivos, -6117 linhas. Single-tenant migrado.

## 2026-05-07 — Team ora-validate-user-types

**Objetivo:** Validação geral dos tipos de usuários do sistema — mapear papéis, permissões, fluxos de autenticação e consistência nos modelos de dados
**Lead:** team-os (skill)
**Composição:**
- dev-analyst — mapear roles, guards e lógica de autorização frontend/backend
- dev-data-engineer — auditar schema, tabelas de user, RLS policies
- dev-qa — checklist de validação + veredicto formal

**Status:** encerrado ✅
**Encerrado:** 2026-05-07T16:01
**Veredicto QA:** ✅ PASS — Round 3 (FAIL→CONCERNS→PASS)
**Round 1:** FAIL (1 CRITICAL, 3 HIGH, 3 MED, 6 LOW)
**Round 2:** CONCERNS (CRITICAL+HIGH fechados; 3 MED + 7 LOW remanescentes)
**Início:** 2026-05-07T12:49
**Arquivos esperados:**
- docs/smart-memory/agents/research/user-types-mapping.md
- docs/smart-memory/agents/data-engineer/user-schema-audit.md
- docs/smart-memory/agents/qa/user-types-checklist.md
- docs/smart-memory/agents/qa/user-types-verdict.md

## 2026-05-07 — Team ora-nylas-calendar

**Objetivo:** Integrar Nylas como provider de calendário no SCHEDULE PRO™ — OAuth por usuário (user/manager/admin), sync Google Calendar via Nylas, disponibilidade de slots
**Lead:** team-os (skill)
**Composição:**
- dev-analyst — pesquisa Nylas API (auth/grants, calendar API, availability, webhooks, SDK) ✅
- dev-architect — ADR + 9 stories validadas (5-point GO 5/5) ✅
- dev-data-engineer — schema (NYLAS-02, blocker geral)
- dev-dev-beta — edge functions Nylas (NYLAS-03, 04, 05)
- dev-dev-gamma — hooks frontend (NYLAS-06) + toggle global (NYLAS-09)
- dev-dev-alpha — UI connect button + settings (NYLAS-07)
- dev-qa — QA gate final (NYLAS-08)

**Status:** ❌ cancelado — decisão do produto em 2026-05-08: Nylas abandonado, não será usado.
**Início:** 2026-05-07T18:00
**Encerrado:** 2026-05-08

### Progresso Zaelor (dev-architect) — 2026-05-07T18:50

- Pesquisa do dev-analyst lida e ratificada como base de evidência (`docs/smart-memory/agents/research/nylas-research.md`).
- ADR escrito: `docs/smart-memory/decisions/ADR-NYLAS-01-nylas-calendar-integration.md`. Decisões-chave: (D1) **SDK-first com fallback REST** — `npm:nylas@8.1.0` em Edge Functions Deno, NYLAS-03 carrega o spike de compatibilidade (AC12); se spike falhar, todas as edge fns caem para `fetch()` direto; (D2) schema aditivo, não destrutivo; (D3) cutover por **toggle de sistema** `settings.calendar_provider` (admin) **+** feature flag `use_nylas_calendar` per-user, com hierarquia documentada; (D4) custódia zero de tokens OAuth; (D5) sandbox Nylas para MVP, CASA assessment como FUP; (D6) região US; (D7) `/v3/calendars/availability` substitui lógica multi-consultor; (D8) idempotência de webhook por `notification.id`; (D9) Google Meet default em conferencing.
- **9 stories** criadas e validadas em `docs/smart-memory/stories/backlog/` (NYLAS-01 a NYLAS-09 — NYLAS-09 cobre o toggle global de provider em `/settings/general/integracoes?tab=google-cal`).
- 5-point checklist aplicado: NYLAS-02..09 com **GO 5/5 unânime** (status `validated` no frontmatter); NYLAS-01 `done` parcial (AC5 humano pendente — provisionar conta sandbox + secrets).
- BACKLOG.md atualizado com bloco do épico no topo + sequência: NYLAS-02 (blocker) → (03 ‖ 04 ‖ 05) → 06 → (07 ‖ 09) → 08.
- Próximo passo: lead despacha NYLAS-02 (schema, blocker geral) para dev-data-engineer.

## 2026-05-08 — Team ora-aba-calendario-schedule

**Objetivo:** Adicionar aba "Calendário" em /schedule com CalendarSyncCard (Google Agenda + Microsoft Teams)
**Lead:** team-os (skill)
**Composição:**
- dev-dev-alpha — implementar nova tab em ScheduleTabNav + subrota em App.tsx
- dev-devops — push + PR após conclusão

**Status:** ✅ encerrado
**Início:** 2026-05-08
**Encerrado:** 2026-05-08
**Commit:** cc59eed — feat(schedule): calendar sync acessível em /profile, /settings/schedule e /schedule
**Arquivos:** CalendarSyncCard.tsx (novo), ScheduleCalendarioConfig.tsx (novo), registry.ts, Perfil.tsx, ScheduleTabNav.tsx, App.tsx

---

## 2026-05-10 — Team joaoguirunas-webhook-increment

**Objetivo:** Incrementar webhook inbound — manual de envio copiável, disparo automático (igual Form PRO), campos padrão (Nome/WhatsApp/Email), lógica de criação/atualização de pessoa e negócio.
**Lead:** team-os (skill)
**Composição:**
- dev-architect — stories dos 4 epics
- dev-ux — spec das 3 novas seções de UI
- dev-data-engineer — migration create_mode + trigger_config
- dev-dev-alpha — frontend (aguarda stories + UX spec)
- dev-dev-beta — backend/edge function (aguarda stories + migration)
- dev-qa — gate formal antes do push

**Status:** encerrado
**Encerrado:** 2026-06-10T04:10:00Z
**Início:** 2026-05-10T17:50:00

---

## 2026-05-27 — Team joaoguirunas-crm-pipeline-consolidation

**Objetivo:** Consolidação de pipelines → único "0 | Vendas", migração de leads, webhook por curso, deduplicação
**Lead:** team-os (skill)
**Composição:**
- dev-architect — stories PIPE-1.1..4.1 + atualização de decisões
- dev-data-engineer — auditoria READ-ONLY + plano de migração v2 (PIPE-1.1/1.2)
- dev-dev-beta — campo Curso + concat em crm-mapper + dedup constraints (PIPE-2.1/3.1)
- dev-qa — QA gate formal (PIPE-4.1, em andamento)

**Status:** encerrado
**Encerrado:** 2026-06-10T04:10:00Z
**Início:** 2026-05-27T13:00:00

**Decisões do usuário cravadas:**
- Consolidação: manter `updated_at` mais recente, arquivar resto com `[consolidacao 2026-05-27]`
- Campo Curso: `type=text` (texto livre)
- Dedup: 1 lead por pessoa (curso como campo personalizado)
- Curso re-submission: concatenar com `'; '` (case-insensitive, preserva casing original)

**Deliverables prontos:**
- `supabase/migrations/20260527130000_pipe_2_1_lead_field_curso.sql` + rollback
- `supabase/migrations/20260527140000_pipe_3_1_dedup_constraints.sql` + rollback
- `supabase/functions/_shared/crm-mapper.ts` — concat logic para campo `curso`
- `docs/api/webhook-inbound-curso.md` — guia operacional
- `docs/smart-memory/agents/data-engineer/pipeline-audit.md` — auditoria completa
- `docs/smart-memory/agents/data-engineer/migration-plan.md` v2 — plano SQL com rollback

**Bloqueio ativo:** UUID do pipeline "0 | Vendas" + stages (banco de prod) → auth Supabase MCP pendente

## 2026-06-08 — Team joaoguirunas-crm-major-overhaul

**Objetivo:** 4 squads em paralelo — remover Coach Pro + Call Pro, corrigir Omni, auditar banco, revisar código
**Lead:** team-os (skill)
**Composição:**

### Squad A — Remoção Coach Pro + Call Pro (8 agentes)
- squad-a-architect — mapear dependências e plano de remoção
- squad-a-alpha-1 — remover frontend Coach Pro
- squad-a-alpha-2 — remover frontend Call Pro
- squad-a-beta — remover edge functions
- squad-a-gamma — limpar routing e nav
- squad-a-data — migration SQL de remoção
- squad-a-qa — gate formal de qualidade
- squad-a-devops — commit + PR

### Squad B — Fix Omni Channel (5 agentes)
- squad-b-analyst — diagnóstico root cause
- squad-b-beta — fix de formulários
- squad-b-gamma — fix de mensagens
- squad-b-delta — hardening
- squad-b-qa — gate formal

### Squad C — DB Audit (5 agentes)
- squad-c-architect — plano e consolidação
- squad-c-data-1 — schema e colunas
- squad-c-data-2 — RLS e índices
- squad-c-analyst — cross-ref schema vs código
- squad-c-qa — veredicto e priorização

### Squad D — Code Review Completo (8 agentes)
- squad-d-architect — revisão arquitetural
- squad-d-analyst — tech debt e deps
- squad-d-alpha — frontend quality
- squad-d-beta — backend quality
- squad-d-gamma — fullstack patterns
- squad-d-delta — segurança e hardening
- squad-d-ux — UX e acessibilidade
- squad-d-qa — veredicto final consolidado

**Status:** encerrado
**Encerrado:** 2026-06-10T04:10:00Z
**Início:** 2026-06-08T00:00:00Z
**Total de agentes:** 26

---

## 2026-06-09 — Team joaoguirunas-crm-padronizar-notes

**Objetivo:** Padronizar o campo de Observações (`clients_people.notes`) do CRM num único editor rich text consistente (TipTap na edição + HTML sanitizado via DOMPurify na exibição), eliminando HTML cru na tela.
**Lead:** team-os (skill)
**Composição:**
- dev-dev-alpha — implementação da padronização nos ~6 componentes ([[../stories/active/CRM-NOTES-01-padronizar-editor-observacoes]])
- dev-qa — veredicto formal + roteiro de verificação no navegador (entra após implementação)

**Status:** encerrado
**Encerrado:** 2026-06-10T04:10:00Z
**Início:** 2026-06-09T15:12:00Z
**Stories:** [[../stories/active/CRM-NOTES-01-padronizar-editor-observacoes]]
**Origem:** correção iniciada após bug de status `"ativo"` (23514) e HTML cru em observações.

---

## 2026-06-10 — Team joaoguirunas-crm-motivos-perda

**Objetivo:** Feature: criar conjunto básico de motivos de perda — seed padrão (5 motivos), seletor no kanban/lista, filtro em relatórios.
**Lead:** team-os (skill)
**Composição:**
- dev-data-engineer — LOSS-01: seed migration `leads_loss_reasons`
- dev-dev-alpha — LOSS-02: ação "Marcar como Perdido" (Kanban + Lista) + LOSS-03: filtro toolbar
- dev-qa — QA gate após todas as stories

**Status:** encerrado
**Encerrado:** 2026-06-10T04:10:00Z
**Início:** 2026-06-10T00:00:00Z
**Stories:** [[../stories/backlog/LOSS-01-seed-motivos-padrao]] · [[../stories/backlog/LOSS-02-seletor-motivo-kanban]] · [[../stories/backlog/LOSS-03-filtro-motivo-relatorios]]

## 2026-07-25 — Team Altiora-CRM-altiora-uc-v1

**Objetivo:** Implementar V1 do CRM Altiora — 30 casos de uso (UC01-UC30) de gestão de referrals e pipeline comercial para a Altiora Advisory Group
**Lead:** team-os (skill)
**Composição:**
- dev-architect — quebrar UC01-UC30 em stories, backlog estruturado com dependências
- dev-data-engineer — schema: tabelas referrals, reuniões R1/R2/R3, contratação, histórico
- dev-dev-alpha — frontend: pipeline kanban/lista, ficha referral, filtros, modais
- dev-dev-beta — backend: email webhook entrada, Google Calendar API, RLS por perfil
- dev-dev-gamma — fullstack: reuniões, registro contato/R1/R2/R3, contratação, ganho/perda
- dev-qa — gate de qualidade nos entregáveis críticos

**Status:** ativo
**Stories:** ver [[../stories/BACKLOG]]
**Contexto produto:** [[../project/use-cases-v1]]
