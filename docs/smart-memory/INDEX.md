---
title: Smart Memory Index
type: index
updated: 2026-06-08
tags: [index]
---

## Ops — Auditorias em andamento
- [[ops/squad-c-db-audit-plan]] — Squad C plano de auditoria DB (2026-06-08): 255 tabelas em 18 grupos; foco lixo, RLS, índices (Zaelor lead)
- [[ops/squad-c-unused-columns]] — Squad C cross-ref schema vs código (2026-06-08): 28 tabelas vivas sem uso + 40 cols órfãs em clients_people + 4 em leads (Lyrak)
- [[ops/squad-c-db-final-report]] — **Squad C relatório consolidado** (2026-06-08): ~43 tabelas SAFE_DROP + ~50 cols mortas + 5 triplicações + 4 fases de migration (Zaelor consolidação)
- [[ops/squad-c-qa-verdict]] — **Squad C QA verdict v2 PASS condicional** (2026-06-08, Axikar): v1 FAIL (7 CRITICAL + 3 HIGH); v2 PASS após correções do architect, 3 LOW (binarizar llm_connections, query pg_trigger, canônica usuários); migrations só pós-squad-c-prod-validations.md + PO/Squad-B acks
- [[ops/squad-a-removal-plan]] — Squad A plano de remoção COMPLETA Coach Pro + Call Pro (2026-06-08): frontend, backend, edge functions, DB (Zaelor lead)
- [[ops/squad-b-omni-diagnosis]] — Squad B diagnóstico Omni (2026-06-08): formulários só-email invisíveis no Omni + mensagens não aparecem na UI (squad-b-analyst lead)
- [[ops/squad-b-fixes]] — Squad B fixes Omni (2026-06-08): form fix (beta), messages reparent (gamma), hardening completo (delta) — timeout/retry, sanitização .or(), backoff polling, error states
- [[ops/squad-b-qa-verdict]] — **Squad B QA verdict CONCERNS** (2026-06-08, Axikar): aprovado com HIGH-1 (fwup32 single-pass não converge cadeia A→B→C), HIGH-2 (realtime dual-channel multiplica subs) e MEDIUM-1 (omniChannel semântico) — push liberado
- [[ops/squad-d-fullstack-review]] — Squad D-gamma review fullstack (2026-06-08): 555 anys, 5 duplicações de tipo de domínio, 43 componentes batendo Supabase direto (Sera)
- [[ops/squad-d-backend-review]] — Squad D-beta backend review (2026-06-08): 194 hooks + 95 edge functions; N+1, SELECT *, hooks sem tenant filter, cascata client-side, pg_cron sem auth defesa em profundidade (Rex)
- [[ops/squad-d-tech-debt]] — Squad D-analyst tech debt (2026-06-08): 11 deps remover (react-beautiful-dnd dep + pdf/spline/pintura/xyflow/etc), 3 components + 3 hooks + 14 shadcn ui mortos, 3 padrões data-fetching coexistindo, god components (Conversas.tsx 2238 LOC) (Lyrak)
- [[ops/squad-d-security-review]] — Squad D-delta security review (2026-06-08): 4 CRITICAL / 6 HIGH / 5 MEDIUM / 7 LOW; data-deletion sem auth, agents-trigger-call sem tenant check, logs-proxy SQLi, anon_key hardcoded (Kronix)
- [[ops/squad-d-arch-review]] — Squad D-architect review arquitetural (2026-06-08): 24 god files frontend + 6 backend; Conversas.tsx (2238 LOC) + ai-agent-execute (2784 LOC) críticos; 9 inconsistências docs vs código; sem imports circulares (Zaelor)
- [[ops/squad-d-frontend-review]] — Squad D-alpha frontend review (2026-06-08): 252 anys em .tsx, zero React.memo, 128 key={index}, 99 console.log em prod, setTimeout sem cleanup em FormBuilderSimulation, PublicFormPage sem AbortController (Novik)
- [[ops/squad-d-ux-review]] — Squad D-ux review (2026-06-08): score 6.25/10; 525 botões sem aria-label, 46 inputs sem label, EmptyState não existe, mobile pages sem loading/error/empty, cores hardcoded em config
- [[ops/squad-d-final-verdict]] — **Squad D veredicto FAIL → CONCERNS (2026-06-08 round 2, Axikar)**: 4 CRITICAL originais TODOS RESOLVIDOS no gate (Squad A removeu CRIT-2; squad-d-delta patcheou CRIT-1/3/4 validado em re-QA adversarial). Restam 24 HIGH + 37 MED + 18 quick wins como débito de hardening. Push tecnicamente LIBERADO

# João Guirunas — Smart Memory

MOC raiz. Todo arquivo novo em `docs/smart-memory/` deve ser referenciado aqui.

## Projeto
- [[project/overview]] — contexto e objetivo (síntese)
- [[project/tech-stack]] — stack (fonte: dev-analyst)
- [[project/architecture]] — padrão arquitetural + 5 fluxos Mermaid (fonte: dev-architect)
- [[project/modules]] — mapa de alto nível dos módulos (fonte: dev-architect)
- [[project/conventions]] — convenções de código (fonte: dev-analyst)
- [[project/audit-followups-diagnostico]] — diagnóstico consolidado followups (2026-04-27): 2 P0 / 6 P1 / 3 P2; 11 stories FWUP-01 a FWUP-11 (Zaelor)
- [[project/audit-sends-pro]] — auditoria adversarial SENDS PRO (2026-04-30): 5 P1 / 9 P2 / 4 P3; 18 quebras totais (Kronix)
- [[project/kiwify-integration-architecture]] — arquitetura Kiwify→CRM Fase 1 (2026-07-02): stack real Supabase, 5 edge fns + 5 tabelas, épico KFY-1.1..1.8 (Zaelor)
- [[project/growth-sales-design-system]] — design system Growth Sales p/ área de membros Kiwify (2026-07-02): tokens (void/ink/bone/ember), Fraunces+Inter Tight+JetBrains Mono, componentes, dark-editorial, zero-radius (Velax)
- [[project/kiwify-members-area-theme]] — arquitetura do tema Kiwify Growth Sales (2026-07-02, corrigido c/ arquivos REAIS): sections reais banner/courses/modules/lessons/continue+login+snippets cards/image/auth-button; `{% style %}` oficial; sem config global/input color; JS = hidratação da plataforma (não nosso); épico REPLANEJADO KFY-3.4..3.6 (Zaelor)

## Módulos — Deep-Dives
**Índice navegável:** [[project/modules/README]] — visão geral, métricas, inventário de 16 bugs/débitos, ~40 stories candidatas, 9 ADRs sugeridos.

**Foundational:**
- [[project/modules/auth-tenant-bootstrap]] — Auth + Tenant Bootstrap: estratégia RLS, role gates (parcialmente legado — herdado do desenho multi-tenant)

**Produtos PRO:**
- [[project/modules/bi-pro]] — BI PRO: dashboard, attribution, conversion tracking, chat LLM
- [[project/modules/crm-pro]] — CRM PRO: pipelines Kanban, lifecycle de leads, atribuição
- [[project/modules/sends-pro]] — SENDS PRO: broadcast multi-canal, filter builder dinâmico (⚠️ loop em browser)
- [[project/modules/prospect-pro]] — Prospect PRO: enrichment Explorium/Apollo/PDL, scoring IA (🔴 P0 v1 quebrado)
- [[project/modules/schedule-pro]] — Schedule PRO: public booking, capability tokens, GCal/Teams/Zoom
- [[project/modules/omni-pro]] — Omni PRO: WhatsApp/IG/TikTok, AI agent (14 tools), delivery engine
- [[project/modules/form-pro-lp]] — Form PRO/LP: form builder + lp builder (22 blocos Zod), lp-submit
- [[project/modules/call-pro]] — Call PRO: dialer, Atende Simples, ElevenLabs TTS
- [[project/modules/coach-pro]] — Coach PRO: avaliação IA, playbooks, tldv → coach-evaluate (novo)
- [[project/modules/score-pro]] — Score PRO: matrix JSONB, aplicação em lp-submit

**Cross-cutting:**
- [[project/modules/settings]] — 22 painéis nível 1, IntegracoesConfig 10 sub-tabs, padrões UI

## Stories
- [[stories/BACKLOG]] — stories pendentes
- `stories/active/` — em desenvolvimento
- `stories/done/` — concluídas

### Altiora CRM V1 (2026-07-25, Zaelor)
25 stories ALTIORA-01..25 em `stories/backlog/ALTIORA-*.md`. Grupos: A (pipeline base), B (entrada), C (ficha), D (workflow Closer), E (fechamento), F (admin). Todas validadas GO 5-point checklist. Sequência obrigatória: ALTIORA-01 → ALTIORA-02 → demais paralelos por grupo.

## Decisões Arquiteturais

**Auth + Tenant:**
- [[decisions/ADR-AUTH-02-fallback-profile-timeout]] — fallbackProfile timeout 2s (UX vs segurança)
- [[decisions/ADR-AUTH-04-auth-hooks-granularity]] — useAuth vs useCurrentUser vs useUserPermissions
- [[decisions/ADR-AUTH-05-csp-permissive-connect-src]] — CSP com connect-src 'self' https: wss: (AUTH-V2-08)
- [[decisions/ADR-AUTH-06-mfa-totp]] — MFA TOTP via Supabase Auth + recovery codes + step-up (AUTH-V2-03 a/b/c)
- [[decisions/ADR-AUTH-STEPUP-01-stepup-enforcement-strategy]] — step-up auth enforcement: client-side hoje (UX gate), server-side deferido (Opção D híbrida)
- [[decisions/ADR-AUTH-07-fwup17-rls-settings-users]] — **retroativo (2026-05-07)** RLS aberto USING(true) em settings_users (FWUP-17) + risco de auto-promoção aceito; reversão em FIX-USR-01
- [[decisions/ADR-AUTH-08-invariante-super-admin-user-type]] — **retroativo (2026-05-07)** invariante super_admin ↔ user_type='admin'; trigger de sincronização em FIX-USR-03
- [[decisions/ADR-AUTH-09-rbac-granular-decision]] — **2026-05-07** RBAC granular `tenant_roles + feature_key` descontinuado: 8 gates `can*` definidos com 0 callers, tabelas vazias, RLS com bug latente; execução em ARCH-RBAC-02

**Schedule PRO / Omni:**
- [[decisions/ADR-SP-02-edge-action-authentication]] — action tokens HMAC uso único para public-booking
- [[decisions/ADR-PP-03-server-verified-tenant-id]] — server-verified tenant_id (substituir extractTenantId)

**BI PRO / Voice:**
- [[decisions/ADR-BI-VOICE-01-gemini-live-architecture]] — Gemini Live + browser-direct + cost isolation per tenant + beta flag

**Release Pipeline:**
- [[decisions/ADR-REL-01-release-pipeline]] — versioned releases + ADM dispatch + drift detection + baseline squashing (épico RELEASE-PIPELINE-V1)

**Audit-Fix (2026-04-26):**
- [[decisions/ADR-SETTINGS-CONSOLIDATION]] — Opção A: registry único; Routes geradas de SETTINGS_SECTIONS (AUDIT-FIX-06, aprovada)
- [[decisions/ADR-SCHEMA-MIGRATION]] — Opção A: migrar dados crm_*→moderno + quiesce + DROP wave (AUDIT-FIX-10, proposed)

**Followups (2026-04-27):**
- [[decisions/ADR-FWUP03-leads-stages-followups-squash]] — squash de 3 migrations conflitantes; drop de stage_id, name, delay_minutes; schema canônico = leads_stages_id + days/hours/minutes

**SENDS / OMNI (2026-05-01):**
- [[decisions/ADR-SENDS-01-message-delivery-attempts]] — log de delivery WhatsApp em tabela 1:N (vs JSONB array em `messages`); habilita observabilidade permanente da story P0 FIX-SENDS-FIRST-MSG-01 (accepted)

**Kiwify (2026-07-02):**
- [[decisions/ADR-KFY-01-reuse-vs-dedicated-queue]] — automações Kiwify usam tabela+worker dedicados (`kiwify_message_jobs`/`kiwify-dispatch-worker`) espelhando o padrão `followup_queue`, não sobrecarregam o god-path com drift (accepted)
- [[decisions/ADR-KFY-02-tema-mecanismo-aplicacao-marca]] — marca Growth Sales no tema REAL da Kiwify: híbrido `{% style %}` backbone (fontes/void/texturas/override `--primary-*`) + edição direta de classes arbitrary-value nos arquivos reais; NÃO existe config global; supersede KFY-3.1/3.2/3.3 → KFY-3.4/3.5/3.6 (accepted)
- [[stories/backlog/FIX-CAL-RLS-01-gestores-see-all-calcom-manager]] — bug RLS: `gestores_see_all_calcom` usa `user_type='gestor'` (valor inexistente, deveria ser `'manager'`); única policy LIVE ainda quebrada assim (audit 2026-07-02). BLOQUEADA — aguarda OK do usuário, não aplicar.
- [[stories/active/KFY-1.1-db-schema-seeds]] — **APLICADA no LIVE** (2026-07-02): 5 tabelas kiwify + RLS + seeds 10/10 triggers + 4 automations + 4 stages novas ("Cursos Online") + `clients_people.whatsapp_optin`. Drift de 3 draft-tables órfãs resolvido (DROP+recriação). Detalhe em [[agents/data-engineer/schema]] §Kiwify e [[agents/data-engineer/migrations-log]].
- [[stories/active/KFY-1.4-kiwify-inbound]] — **IMPLEMENTADA, deploy pendente** (2026-07-02, Rexar): edge fn `kiwify-inbound` (`--no-verify-jwt`) — assinatura HMAC-SHA1 constant-time (gated por `enforce_signature`), upsert idempotente em `kiwify_webhook_events`, enqueue `kiwify-process-event` via `waitUntil`, safety-net 200. Lógica pura em `logic.ts` + 11 testes. Contrato: `docs/api/kiwify-inbound.md`. Deploy após KFY-1.5.
- [[stories/active/KFY-1.6-kiwify-reconcile]] — **IMPLEMENTADA, deploy pendente** (2026-07-02, Rexar): edge fn `kiwify-reconcile` (cron 6h, SEM `--no-verify-jwt`) — `listSales` paginado → detecta vendas sem evento (por `order_id`) → sintetiza (origem `reconcile`) + invoca `kiwify-process-event`. Auth service_role JWT rotation-proof (decode role, não string-match). Lógica pura `logic.ts` + 9 testes. Cron SQL p/ devops: `migrations/20260702140000_kiwify_reconcile_cron.sql`. Contrato: `docs/api/kiwify-reconcile.md`.

**Kiwify Fase 1.5 — Course Badge (2026-07-02, Zaelor):** arquitetura §8 de [[project/kiwify-integration-architecture]] — tabela M-N `kiwify_lead_products` + badge de curso no lead. Payload REAL capturado (§8.7) confirma que o parser já lia os campos certos (`pix_code`/`mobile`/`charge_amount`/`Product` capitalizado); só falta anotar. 1 webhook por conexão (ratificado).
- [[stories/backlog/KFY-2.1-parser-real-field-names]] — S/P2, dev-dev-beta: confirmar/anotar `EVENT_TYPE_TO_TRIGGER` (`billet_created`/`pix_created` confirmados; outros 8 TODO(verify)) + cabeçalho `kiwify-events.ts`; opcional `{{vencimento_boleto}}`. NÃO reescrever parse já correto.
- [[stories/done/KFY-2.2-lead-products-junction]] — ✅ DONE (QA PASS), data-engineer+beta: migration `kiwify_lead_products` (UNIQUE people_id,product_id) + upsert em `kiwify-process-event` só em `compra_aprovada`/`subscription_renewed`. God Node gate PASS 45/45.
- [[stories/done/KFY-2.3-course-badge-ui]] — ✅ DONE (QA CONCERNS), dev-dev-alpha: chip amber de curso (kanban/mobile/detalhe, reuso do chip) + fallback manual de produto. Débito: nome manual em localStorage (per-browser) → story futura de persistência tenant-wide.
- [[stories/done/KFY-4.1-kiwify-manual-webhook-token]] — ✅ DONE (QA PASS, 2026-07-02): (a) caminho manual de webhook — `save_credentials`+`register_manual_webhook_token`, UI accordion `?cid=` resolvível; (b) **FIX CRÍTICO `client_id ≠ account_id`** — coluna nova + campo UI + factory `row.client_id`. Migration `20260702170000` no LIVE. Débito à parte: `kiwify-reconcile` `deno check` (import supabase-js bare vs esm.sh, pré-existente KFY-1.6, type-only). Deploy functions+frontend conjunto.

## Convenções
- [[conventions/release-pipeline]] — **⚠️ BREAKING v4.72** fluxo completo release versionada: release.json, tenant sync opt-in, CI gates, force-sync manual, adm_releases/adm_client_versions schema (REL-01 AC8)
- [[conventions/migrations-discipline]] — regras lint MIG001-MIG009, rollbacks, templates, CI integration (REL-04)
- [[conventions/baseline-squashing]] — protocolo completo de squash de migrations: quando/como/quem aprova, checklist, warnings, rollback (REL-05)

## Auditoria
- [[audit/resilience]] — auditoria adversarial: auth, tenant bootstrap, settings — 4 P0 / 6 P1 / 5 P2 (Kronix, 2026-04-26)

## Operações
- [[ops/supabase-credentials]] — banco ativo (`dtsmbqrzyxhjjjvpjfjd`), access token CLI, histórico de troca (2026-07-25)
- [[ops/delegation-log]] — histórico de delegações do lead
- [[ops/teams-log]] — times formados e seus objetivos
- [[ops/wave-plan]] — **Wave Plan 2026-07-25 (Zaelor)**: 65 stories auditadas → 47 ativas em 4 waves; 16 done em backlog/ p/ limpeza; Wave 1 = 10 fixes críticos sem dep. bloqueante

## Agentes IA — Prompts
- [[agents/social-selling-v6/identity]] — Social Selling Instagram v6 (2026-06-16): identity com 3 rotas (Consultoria/Mentoria/Curso) + escalação para humano
- [[agents/social-selling-v6/general_rules]] — Social Selling v6: contrato de formatação, teto de tools, critérios de fit, fluxo de escalação
- [[agents/social-selling-v6/step_fluxo_completo]] — Social Selling v6: tabela de captura, UUIDs de roteamento, matriz de decisão por fit
- [[agents/mentoria-agent-v10/identity]] — Mentoria v10: identity João, narrativa canônica 7 semanas, tools
- [[agents/diagnostico-agent-v5/identity]] — Diagnóstico v5 (Consultoria): roteador 3 produtos, identidade João
- [[agents/curso-agent-v9/identity]] — Curso v9: atendimento Curso Online Claude Agents, upsell Mentoria
- [[agents/qualificacao-consultoria-v1/identity]] — Qualificação Consultoria v1: roteador independente (Consultoria/Mentoria/Curso)

## Agentes
- [[agents/architect/sends-backlog-triage]] — triagem do backlog SENDS PRO (2026-05-01): 16 stories inventariadas, top-3 iteração fix-sends-module (Zaelor)
- [[agents/data-engineer/schema]] — schema completo (~713 migrations, 60+ tabelas, ERD Mermaid)
- [[agents/data-engineer/altiora-schema]] — **schema Altiora V1** (2026-07-25): pipeline 13 etapas, 3 novas tabelas (r1_data/finvity/contratacao), campos referral em leads + campos R1/R2/R3 em meetings, 7 migrations aplicadas
- [[agents/data-engineer/migration-status]] — último timestamp aplicado, próximo disponível, estado das migrations ativas
- [[agents/data-engineer/migrations-log]] — log cronológico de migrations aplicadas pelo Bythak (com causa raiz, estratégia, rollback)
- [[agents/data-engineer/qualificacao-consultoria-apply-log]] — 2026-06-16: criou agente "Qualificação Consultoria" (30dad93b…) + desativou "Diagnóstico" (d0c29089…); DML via db query --linked
- [[agents/data-engineer/audit-followups-schema]] — auditoria followup/stage/pipeline: tabelas mortas, colunas N8N obsoletas, edge functions, 4 achados críticos
- [[agents/data-engineer/schema-dual-analysis]] — análise completa crm_* vs moderno: mapeamento de pares, FKs, edge functions, riscos de DROP
- [[agents/data-engineer/sends-pro-db-state]] — pipeline disparo OK (fila vazia, 3 crons succeeded); 2 pendências: crons legados c/ URL antiga + conversion-send em GUC (2026-05-01)
- [[agents/data-engineer/2026-05-01-sends-disparo-investigacao]] — RCA SENDS PRO fechado por teste empírico (campanha `eduteste1` end-to-end OK em 18:08): bug original já resolvido pelo sync JWT 17:13; gap delivered_at vira story própria
- [[agents/data-engineer/schema-analysis]] — mapeamento single-tenant p/ sim-dados-apresentacao (2026-05-02): 23 tabelas relevantes, hierarquia INSERT, NOT NULLs, enums canônicos
- [[agents/data-engineer/insertion-plan]] — plano técnico time `sim-dados-apresentacao` (2026-05-02): ordem 21 lotes, volumes-alvo (200 leads / 30 won / 1.2k msgs / 6 sends / 6 campanhas), 10 decisões pendentes p/ team-lead
- [[agents/data-engineer/user-schema-audit]] — auditoria team `validate-user-types` (2026-05-07): user_type canônico em settings_users, 8 gaps (GAP-2 crítico: RLS USING(true) em settings_users), 2 sistemas mortos (user_roles, tenant_roles)
- [[agents/data-engineer/pipeline-audit]] — auditoria team `pipeline-consolidation` (2026-05-27, rev 2): FK inventory completo (16 referrers de leads_pipelines + 13 de leads_stages), conflito ON DELETE no FK de leads (CASCADE vs SET NULL), "0 | Vendas" só em prod, 11 riscos (R1-R11), confirmação que archived/lost_at/description existem
- [[agents/data-engineer/migration-plan]] — plano Story PIPE-1.2 v2 (2026-05-27): consolidação para "0 | Vendas" com estratégia de colisão (winner = updated_at mais recente; losers viram status=lost + archived=true + description tag); SQL completo com 3 audit tables (leads, fk_referrers, disabled_rules) + rollback; ordering coupled com PIPE-3.1 (`20260527140000_pipe_3_1_dedup_constraints.sql`)
- [[agents/data-engineer/diagnostico-agent-v5-field-validation]] — validação executor p/ Diagnóstico v5 (2026-06-16): ALLOWED_Q_COLS (29 keys), custom fields globais, `close_probability` existe em atualizar_lead, `perfil_tipo=empresário` com acento, `temperature` é no-op (usar pre_sale_temperature)
- [[agents/qa/results]] — histórico de veredictos formais (Axikar)
- [[agents/qa/user-types-checklist]] — checklist formal de validação de tipos de usuário (Axikar, 2026-05-07): 5 dimensões / 30 itens, base para veredicto user-types-verdict.md
- [[agents/qa/user-types-verdict]] — **veredicto validate-user-types FAIL → CONCERNS** (Axikar, 2026-05-07): Round 1 FAIL (RLS bypass + 3 HIGH); Round 2 CONCERNS após FIX-USR-01/02/03 (CRITICAL+HIGH-1/2 fechados, HIGH-3 invalidado); push liberado
- [[agents/qa/fwup-qa-report]] — gate report epic FWUP (11 stories, 2026-04-27)
- [[agents/qa/verdict-sends-pro-revisao]] — veredicto PASS SENDS PRO IMPORT-01/02 + 9 fixes (P1-03 e P2-07 como débito declarado, 2026-04-30)
- [[agents/qa/agent-save-409-review]] — veredicto CONCERNS fix 409/23503 save_agent_complete (RPC defensivo resolve_created_by, 2026-05-01)
- [[agents/qa/coach-pro-baseline]] — baseline pré-refinamento Coach Pro (7 telas, issues + bugs, 2026-05-02)
- [[agents/qa/coach-pro-cp1235-67-verdict]] — veredicto CONCERNS Coach Pro CP-1/2/3/6/7 (1 MED + 4 LOW; tokens 100% migrados, 2 bugs baseline corrigidos, 2026-05-02)
- [[agents/ux/components]] — catálogo UI (300+ custom + 55+ shadcn em 20 domínios)
- [[agents/ux/bi-voice-spec]] — spec UX completa do assistente de voz BI (estados, componentes, a11y, interface useGeminiLive)
- [[agents/ux/bi-enterprise-spec]] — spec visual enterprise BI PRO (2026-05-02): redução density, paleta sóbria, tipografia 5-tamanhos, funnel 2D, gradients banidos exceto semânticos (Velax)
- [[agents/ux/audit-followups-componentes]] — auditoria de 12 componentes React de followup (2026-04-27): 2 QUEBRADOS, 3 PARCIAIS, 7 FUNCIONAIS; colisão de tabela meetings_followups + campos ScoreMatrix legados
- [[agents/ux/webhook-increment-spec]] — spec UX 3 seções WebhookInboundConfig (2026-05-10): Manual de envio inline (Collapsible+JSON), Comportamento (RadioGroup 4 opções), Disparo automático (Switch+Collapsible+template picker)
- `agents/research/` — research reports
- [[agents/research/2026-04-26-backlog-status]] — mapa completo do backlog: status real vs frontmatter, top-5 sprint, blockers e anomalias
- [[agents/research/audit-followups-campos-obsoletos]] — auditoria de campos obsoletos e referências n8n em configs de followup (2026-04-27): 5 obsoletos, 12 suspeitos, 2 flags mortas
- [[agents/research/2026-05-01-taskforce-sends-omni-rca]] — RCA de 2 bugs: SENDS PRO template não chega + agente IA não responde inbound (suspeita: `_app_config` vazio + type mismatch em `ai_agents.stage_ids`)
- [[agents/research/sends-pro-dispatch-flow]] — fluxo completo de disparo WhatsApp: 2 estágios (sends-dispatch-batch + omni-delivery-engine), 4 edge fns, pontos de falha P0-P3
- [[agents/research/sends-status-callback-analysis]] — `send-status-callback` órfã + `whatsapp-inbound` descarta `statuses[]` Meta: `sends_contacts.delivered_at/read_at` sempre NULL (P1)
- [[agents/research/2026-05-01-sends-disparo-rca]] — RCA consolidada disparo: bug infra (JWT desync + schema drift) fechado 17:13; validação empírica 18:08 com `eduteste1` confirmou pipeline OK + gap de tracking `delivered/read`. Saída: 4 stories candidatas
- [[agents/research/2026-05-01-sends-frontend-audit]] — auditoria frontend SENDS PRO (Sera): 11 gaps cross-layer FE↔BE (4 P1 / 4 P2 / 3 P3); template sem `meta_template_name` selecionável + sem `variables_map` na UI + erros truncados em tooltip
- [[agents/research/2026-05-01-sends-edge-fns-audit]] — auditoria 4 edge fns disparo (Rex): 19 pontos suspeitos (3 P1 latentes / 7 P2 / 9 P3); zero regressão recente; commit 7756b2a é fix anti-overwrite de metadata; `WHATSAPP_ACCESS_TOKEN` é único env var operacional manual
- [[agents/research/user-types-mapping]] — mapeamento de roles (2026-05-07): 3 tipos canônicos (admin/manager/user) + roles tenant (`tenant_role_permissions`); 3 guards de rota; 8 inconsistências (super_admin redundante, consultor morto, currentTenantId hardcoded)
- [[agents/research/dedup-analysis]] — análise de leads duplicados (2026-05-27, Rex): 4 schema gaps (UNIQUE faltando em leads/people/form_pro_submissions) + default `create_mode='criar'` causando dup. intencional; story PIPE-3.1 fecha
- [[agents/research/calcom-api-v2-integration]] — **Cal.com API v2 p/ integração CRM** (2026-06-13, Lyrak): bookings/event-types/webhooks/slots/calendars mapeados; ⚠️ Platform plan (Atoms+managed users) deprecado p/ novos signups desde 2025-12-15 → usar API key por tenant + embed open-source + webhooks HMAC; `cal-api-version` varia por endpoint; correlação via `metadata.crm_lead_id`
- [[agents/research/manychat-tiktok-dm-api]] — **ManyChat API p/ TikTok DM no Omni** (2026-06-29, Lyrak): API só request/response, SEM webhook nativo de inbound → inbound só via Flow Builder + External Request (payload custom, timeout 10s); auth `Bearer {user_id}:{token}`; outbound `POST /fb/sending/sendContent`; contato = `subscriber_id`; TikTok exige Business, sem UE/UK, 10 msgs/48h
- [[agents/research/kiwify-api-reference]] — **Kiwify API p/ integração CRM Fase 1** (2026-07-02, Lyrak): base `public-api.kiwify.com/v1`, OAuth `client_id`+`client_secret` (token cacheável), 10 triggers de webhook confirmados, `/sales` (90d max, paginado) + `/products` mapeados; ⚠️ CRÍTICO: assinatura do webhook de vendas NÃO documentada na doc nova (EdDSA/chave-pública é da Banking API, outra API) → HMAC-SHA1 `?signature=` é da comunidade, TODO(verify) com payload real; `carrinho_abandonado` sem `order_id` (chave idempotência em aberto)
- [[agents/research/kiwify-members-area-api]] — **Kiwify Área de Membros: API vs plataforma fechada** (2026-07-02, Lyrak): ❌ NÃO dá pra construir área de membros nossa hospedada consumindo conteúdo via API; "objects" course/module/lesson/progress são objetos **Liquid** do tema hospedado deles (Shopify-like, sem JS), NÃO REST; API pública só cobre vendas/produtos/webhooks; progresso é read-only dentro do tema (Fase 2 tracking inviável via API); domínio próprio OK mas aponta p/ área DELES; auth 100% Kiwify; TODO(verify): "Entrar com Kiwify" como SSO externo
## Auditorias
- [[audit/QA-VERDICT]] — **veredicto QA da auditoria geral (2026-04-26): ❌ FAIL** — 15 P0 / 25 P1 / 28 P2 após dedup, 7 causas raiz cross-report, plano de 3 sprints de correção (Axikar)
- [[audit/routes]] — auditoria completa de rotas (2026-04-26): 4 P0, 5 P1, 7 P2 — ADM existe, item de menu depende de `super_adm` no profile
- [[audit/navigation]] — auditoria UX de navegação e botões de settings (2026-04-26): 3 P0 / 6 P1 / 5 P2 — botão WhatsApp em CriarDisparo → 404, /crm/empresas não registrada, ADM sumiu explicado
- [[audit/inconsistencies]] — inconsistências de código (2026-04-26): 4 P0 / 9 P1 / 11 P2 — MobileLpPro quebrado, 18 @ts-nocheck em hooks centrais, stubs silenciosos, ANON key duplicada
- [[audit/database]] — auditoria banco de dados (2026-04-26): 3 P0 / 5 P1 / 6 P2 — timestamps duplicados em manifest, RLS USING(true) em crm_*, prospect sem tenant_id até 20260422

## Clientes
- [[clientes/README]] — índice de clientes
- [[clientes/joao-guirunas]] — João Guirunas: configuração single-tenant ativa

## FUP Programado (FUP-AUTO-01 — 2026-07-25, Bythak)
- [[stories/done/FUP-AUTO-01]] — **DB DONE (dev-beta/gamma pendente)**: tabela fup_programados + RPC agendar_fup() + cron */5min; UI/tool/worker para dev-beta/gamma

## Release Pipeline (REL-01/03/04/05 — 2026-07-25, Bythak)
- [[stories/done/REL-01]] — **DB+edge fn DONE (dev-devops/beta pendente)**: adm_releases + adm_client_versions migrations + adm-releases-register edge fn; AC2/AC5-AC8 dev-devops/beta
- [[stories/done/REL-03]] — **DB DONE (dev-beta pendente)**: adm_client_drift table + cron adm-drift-check-daily + compute_schema_hash() RPC per-tenant; AC2/AC5-AC9 dev-beta
- [[stories/done/REL-04]] — **script+manifest+backfill DONE (dev-devops pendente AC2/AC3)**: lint-migrations.js MIG001-MIG009 + backfill report 1801 erros/21 warnings
- [[stories/done/REL-05]] — **DONE (dev-beta pendente AC3/AC4/AC5-fn)**: squash-baseline.js + baseline-approve.yml + baseline-restore.yml + is_baseline flag + baseline-squashing.md; AC3/AC4/AC5-fn dev-beta
- [[ops/migrations-lint-baseline-2026-07-25]] — REL-04 AC6: baseline de débito técnico lint (902 files, 1801 erros históricos)

## Status
- [[shared-context]] — status board em tempo real
