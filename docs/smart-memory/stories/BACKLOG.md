---
title: Story Backlog
type: backlog
updated: 2026-07-25
tags: [story, altiora, webhook-inbound, pipeline-consolidation]
---

# Backlog de Stories

## 🏢 ALTIORA CRM V1 — Pipeline de Referrals Altiora Advisory Group (2026-07-25)

Épico: `altiora-crm-v1`. Objetivo: adaptar o CRM GrowthSales para o pipeline de referrals da Altiora Advisory Group com 13 etapas, 3 perfis de usuário (Closer/Gestor/Admin), entrada automática por e-mail, workflow completo de R1/R2/R3, análise Finvity e indicadores operacionais.
Use-cases: [[../project/use-cases-v1]]. Mapeamento: Negócio → Referral | Responsável → Closer | Gestor → Gestor Comercial.
Sequência obrigatória: ALTIORA-01 → ALTIORA-02 → (ALTIORA-03 ‖ ALTIORA-04) → (ALTIORA-05 ‖ ALTIORA-06) → ALTIORA-07 → ALTIORA-08 → ... (ver grupos abaixo).
5-point checklist: todas as 25 stories validadas **GO** em 2026-07-25.

### Grupo A — Pipeline e configuração base (pré-requisito de tudo)

| Story | Título | Complexidade | Status | Agente sugerido |
|---|---|---|---|---|
| [[backlog/ALTIORA-01-db-schema-pipeline-altiora]] | DB — Schema base do pipeline Altiora (13 etapas, motivos perda, campos customizados) | L | backlog | dev-data-engineer |
| [[backlog/ALTIORA-02-pipeline-altiora-ativar]] | Pipeline Altiora — ativar e exibir 13 etapas no Kanban | M | backlog | dev-dev-gamma |
| [[backlog/ALTIORA-03-kanban-card-altiora]] | Kanban card — Closer, tempo na etapa, última atividade, próxima ação | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-04-terminologia-referral]] | Terminologia UI — "Negócio" → "Referral" no pipeline Altiora | S | backlog | dev-dev-alpha |

### Grupo B — Entrada de referrals

| Story | Título | Complexidade | Status | Agente sugerido |
|---|---|---|---|---|
| [[backlog/ALTIORA-05-email-referral-inbound]] | Edge function — receber referral automaticamente por e-mail (UC10) | L | backlog | dev-dev-beta |
| [[backlog/ALTIORA-06-cadastrar-referral-manual]] | Cadastrar referral manualmente — adaptar NovoNegocioModal (UC11) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-07-atribuir-closer]] | Atribuir Closer ao referral — automático por e-mail + manual (UC12) | M | backlog | dev-dev-gamma |

### Grupo C — Ficha do referral

| Story | Título | Complexidade | Status | Agente sugerido |
|---|---|---|---|---|
| [[backlog/ALTIORA-08-ficha-referral-campos-altiora]] | Ficha do referral — campos específicos Altiora (UC04) | L | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-09-filtros-busca-pipeline]] | Filtros e busca avançada no pipeline Altiora (UC03) | M | backlog | dev-dev-alpha |

### Grupo D — Workflow do Closer

| Story | Título | Complexidade | Status | Agente sugerido |
|---|---|---|---|---|
| [[backlog/ALTIORA-10-minha-carteira-closer]] | Minha Carteira — visão filtrada pelo Closer autenticado (UC17) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-11-primeiro-contato-proxima-acao]] | Registrar primeiro contato e definir próxima ação (UC18/UC19) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-12-atualizar-etapa-campos-obrigatorios]] | Atualizar etapa com campos obrigatórios por transição (UC20) | L | backlog | dev-dev-gamma |
| [[backlog/ALTIORA-13-reunioes-google-calendar]] | Reuniões — agendar, reagendar e cancelar via Google Calendar (UC21/UC22) | XL | backlog | dev-dev-gamma |
| [[backlog/ALTIORA-14-registrar-realizacao-reuniao]] | Registrar realização e comparecimento da reunião (UC23) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-15-registro-r1-diagnostico]] | Registrar diagnóstico da R1 (UC24) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-16-analise-finvity]] | Análise Finvity — link/anexo, dores e produtos sugeridos (UC25) | S | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-17-registro-r2]] | Registrar informações da R2 — produto, objeções e data da R3 (UC26) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-18-registro-r3-decisao-final]] | Registrar R3 e decisão final — avançar ou encerrar (UC27) | M | backlog | dev-dev-alpha |

### Grupo E — Fechamento e histórico

| Story | Título | Complexidade | Status | Agente sugerido |
|---|---|---|---|---|
| [[backlog/ALTIORA-19-encerrar-perdido]] | Encerrar referral como Perdido — motivo obrigatório e reabertura (UC16) | S | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-20-contratacao-e-ganho]] | Acompanhar contratação e registrar Ganho (UC28/UC29) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-21-historico-linha-do-tempo]] | Linha do tempo e histórico do referral (UC04/RF-07) | M | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-22-reatribuicao-correcao-dados]] | Reatribuição de Closer e correção de dados pelo Gestor/Admin (UC08/UC13) | M | backlog | dev-dev-alpha |

### Grupo F — Admin / RevOps

| Story | Título | Complexidade | Status | Agente sugerido |
|---|---|---|---|---|
| [[backlog/ALTIORA-23-gestao-usuarios-perfis]] | Gestão de usuários com perfis Altiora — Closer, Gestor, Admin (UC05) | L | backlog | dev-dev-gamma |
| [[backlog/ALTIORA-24-indicadores-operacionais]] | Indicadores operacionais do funil Altiora (UC09) | L | backlog | dev-dev-alpha |
| [[backlog/ALTIORA-25-alertas-referrals-parados]] | Alertas — referrals parados ou sem próxima ação (UC15) | M | backlog | dev-dev-alpha |

---

## 🧪 CENTRAL DE TESTES v2 — Port do simulador evoluído do ironberg (2026-07-03)

Épico: `central-testes`. Objetivo: substituir o simulador atual (seleção livre de pessoa + activity log) pelo modelo **Testador singleton** do ironberg: contato de teste fixo/renomeável movível por qualquer pipeline/etapa, com follow-ups da etapa (Enviar agora), campos personalizados do lead e Dev Panel (prompt renderizado/tools/tokens por execução).
Arquitetura + decisões (Testador adotado, seletor de Agente **mantido**, RAG/Unidade/cached_tokens **omitidos**): [[../project/central-de-testes-v2]].
Backend `ai-agent-execute` já suporta `test_mode`/`agent_id`/`direct_message`/`prompt_rendered`. Hooks de followups/campos/pipelines/templates já existem — reusar, não recriar.
Sequência: TESTES-1.1 (hooks) → (1.2 ‖ 1.3 ‖ 1.4 ‖ 1.5) → 1.6 (integração + remover órfãos `TestPersonSelector`/`TestActivityLog`).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[done/TESTES-1.1-hooks-testador-context]] | Hooks — Testador singleton, execution log e useTestContext | 🟠 P1 | M | ✅ done | Serak (dev-dev-gamma) |
| [[done/TESTES-1.2-pipeline-stage-selector]] | TestPipelineStageSelector (port 1:1) | 🟡 P2 | S | ✅ done | Novik (dev-dev-alpha) |
| [[backlog/TESTES-1.3-followup-panel]] | TestFollowupPanel — follow-ups da etapa + Enviar agora | 🟡 P2 | M | backlog | dev-dev |
| [[backlog/TESTES-1.4-lead-fields-panel]] | TestLeadFieldsPanel — campos personalizados do lead | 🟡 P2 | S | backlog | dev-dev |
| [[backlog/TESTES-1.5-dev-panel]] | TestDevPanel — execuções do agente (sem RAG) | 🟡 P2 | M | backlog | dev-dev |
| [[backlog/TESTES-1.6-integracao-central]] | Integração — reescrever CentralDeTestes.tsx (Testador + agente + Dev) | 🟠 P1 | M | backlog | dev-dev |

---

## 🎨 KIWIFY MEMBERS AREA — Tema Growth Sales na área hospedada (2026-07-02, REPLANEJADO)

Épico: `KFY-3`. Objetivo: tematizar a **área de membros HOSPEDADA pela Kiwify** com a identidade Growth Sales via tema Liquid (não é LMS próprio). Arquitetura e limites reais: [[../project/kiwify-members-area-theme]]. Design system: [[../project/growth-sales-design-system]]. Mecanismo: [[../decisions/ADR-KFY-02-tema-mecanismo-aplicacao-marca]].

> ⚠️ **REPLANEJADO (2026-07-02):** KFY-3.1/3.2/3.3 foram construídas sobre **suposições** de estrutura (arquivos inventados, deletados) e estão **SUPERSEDED** em `done/`. O usuário colou os **arquivos REAIS** do Code Editor em `kiwify-theme/`. Trabalho correto = **editar os reais**: KFY-3.4 (foundation `{% style %}`) → KFY-3.5 (recolorir sections de conteúdo) ‖ KFY-3.6 (recolorir login).

Viabilidade: **alta** — `{% style %}` (oficial) aceita CSS arbitrário → fontes/fundo void/texturas/`::selection`/override de `--primary-*`. Não há config global (sem `settings_schema.json`, sem input `color`). Perdas: sem `<script>` autoral (mas carousel/tooltips/router/imagens já vêm hidratados pela plataforma), só templates index+login (telas de aula = Kiwify-default), fontes custom com fallback de sistema.
Sequência: KFY-3.4 → (KFY-3.5 ‖ KFY-3.6). Publicação via Code Editor do painel Kiwify (não deploya na nossa infra) — Grav não entra.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[active/KFY-3.4-tema-foundation-arquivos-reais]] | Foundation — backbone `{% style %}` (fontes/void/texturas/override `--primary-*`) | 🟠 P1 | M | active | Novik (dev-dev-alpha) |
| [[active/KFY-3.5-tema-recolor-sections-conteudo]] | Recolorir sections reais (banner/courses/modules/lessons/continue + cards) via arbitrary-value | 🟠 P1 | L | active | Novik (dev-dev-alpha) |
| [[backlog/KFY-3.6-tema-recolor-login]] | Recolorir `login.liquid` real (respeita `club` + auth-button/image hidratados) | 🟡 P2 | S | backlog | dev-ux |
| ~~[[done/KFY-3.1-tema-foundation-tokens]]~~ | ~~Foundation (arquivos inventados)~~ | — | M | 🛑 superseded | → KFY-3.4 |
| ~~[[done/KFY-3.2-tema-pagina-index]]~~ | ~~Index recriado do zero~~ | — | L | 🛑 superseded | → KFY-3.5 |
| ~~[[done/KFY-3.3-tema-pagina-login]]~~ | ~~Section `gs-login` inventada~~ | — | S | 🛑 superseded | → KFY-3.6 |

---

## 🛒 KIWIFY INTEGRAÇÃO — Vendas/assinaturas Kiwify → pipelines + automações WhatsApp (Fase 1, 2026-07-02)

Épico: `kiwify-integracao`. Objetivo: receber os 10 triggers de webhook da Kiwify, mover contatos entre pipelines/stages conforme o evento (com precedência e idempotência) e disparar automações de WhatsApp configuráveis por produto. Área de membros = Fase 2 (fora de escopo).
Arquitetura: [[../project/kiwify-integration-architecture]]. Decisão de fila: [[../decisions/ADR-KFY-01-reuse-vs-dedicated-queue]]. Research: [[../agents/research/kiwify-api-reference]] (⚠️ ainda não existe — dev-analyst).
Reuso: `whatsapp-outbound`, `app_encrypt_secret`, padrão `whatsapp-inbound`/`followup-*`/`pg_cron`. Fila dedicada `kiwify_message_jobs` (ADR-KFY-01), não `followup_queue`.
KFY-1.5 é **GOD NODE** (toca `leads`+`messages`) → QA obrigatório (KFY-1.8) antes de push.
Sequência: KFY-1.1 → KFY-1.2 → (KFY-1.3 ‖ KFY-1.4) → KFY-1.5 → (KFY-1.6 ‖ KFY-1.7) → KFY-1.8 → deploy (Grav).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/KFY-1.1-db-schema-seeds]] | DB — schema Kiwify (5 tabelas) + seeds | 🟠 P1 | L | backlog | dev-data-engineer |
| [[backlog/KFY-1.2-kiwify-api-client]] | KiwifyApiClient — OAuth/rate-limit/retries | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/KFY-1.3-kiwify-connect]] | kiwify-connect — conectar/testar/webhook/desconectar | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/KFY-1.4-kiwify-inbound]] | kiwify-inbound — assinatura + idempotência + enqueue | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/KFY-1.5-kiwify-process-event]] | kiwify-process-event — contato/mapping/precedência/automações (GOD NODE) | 🔴 P0 | XL | backlog | dev-dev-beta |
| [[backlog/KFY-1.6-kiwify-reconcile]] | kiwify-reconcile — cron de reconciliação | 🟡 P2 | M | backlog | dev-dev-beta |
| [[active/KFY-1.7-ui-kiwify-panel]] | UI — aba Kiwify em IntegracoesConfig | 🟠 P1 | L | active | Novik (dev-dev-alpha) |
| [[backlog/KFY-1.8-qa-gate]] | QA Gate — idempotência/precedência/assinatura/e2e | 🔴 P0 | M | backlog | dev-qa |

### Fase 1.5 — Course Badge (multi-curso por lead, 2026-07-02)
Extensão: cada lead Kiwify carrega badge(s) do(s) curso(s) — relação M-N. Arquitetura §8: [[../project/kiwify-integration-architecture]]. Payload real capturado corrige suposições da Fase 1 (§8.7). 1 webhook por conexão (ratificado) — `Product.product_id/name` em todo evento identifica o curso.
Sequência: KFY-2.1 (‖ KFY-2.2) → KFY-2.3 (blocked-by KFY-2.2). KFY-2.2 toca God Node → QA gate antes do push.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/KFY-2.1-parser-real-field-names]] | Parser — confirmar/anotar nomes de campo reais do payload | 🟡 P2 | S | backlog | dev-dev-beta |
| [[backlog/KFY-2.2-lead-products-junction]] | Tabela `kiwify_lead_products` (M-N) + população em process-event (God Node) | 🟠 P1 | M | backlog | dev-data-engineer + dev-dev-beta |
| [[active/KFY-2.3-course-badge-ui]] | Badge de curso no lead (kanban/lista/detalhe) + fallback manual de produto | 🟠 P1 | M | active | Novik (dev-dev-alpha) |

---

## 📲 MANYCHAT TIKTOK DM — TikTok DM via ManyChat como canal Omni (2026-06-29)

Épico: `manychat-tiktok-dm`. Objetivo: adicionar ManyChat como canal alternativo de TikTok DM, com mensagens caindo no Omni Channel (paralelo à integração nativa `tiktok-inbound`/`tiktok-outbound`). Canal `tiktok-manychat` distinto do `tiktok` nativo para não colidir threads. Inbound via Flow Builder → External Request; outbound via `POST /fb/sending/sendContent`.
Research: [[../agents/research/manychat-tiktok-dm-api]]. mc-1 é DB CRÍTICO (toca constraint de `messages`) — recomendado QA gate antes do push.
Sequência: mc-1 → (mc-2 ‖ mc-3) → mc-4 → mc-5 (deploy).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/mc-1-db-manychat-channel]] | DB — canal tiktok-manychat (constraint + identidade + config) | 🟠 P1 | S | backlog | dev-data-engineer |
| [[backlog/mc-2-edge-inbound]] | Backend — edge fn tiktok-manychat-inbound | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/mc-3-edge-outbound-routing]] | Backend — edge fn tiktok-manychat-outbound + routing no delivery engine | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/mc-4-ui-manychat-config]] | UI — ManyChatIntegrationConfig + entrada em IntegracoesConfig | 🟠 P1 | M | backlog | dev-dev-alpha |
| [[backlog/mc-5-devops-deploy-secrets]] | DevOps — deploy das edge fns + secrets ManyChat | 🟠 P1 | S | backlog | dev-devops |

---

## 🎯 PIPELINE CONSOLIDATION — Consolidar todos os leads em "0 | Vendas" (2026-05-27)

Épico: `joaoguirunas-crm-pipeline-consolidation`. Objetivo: (1) consolidar todos os pipelines em "0 | Vendas" inativando os demais, (2) migrar leads existentes preservando integridade, (3) adicionar campo personalizado `curso` e padrão de webhook-por-curso, (4) corrigir leads duplicados sob o novo modelo. PIPE-1.2 é DB CRÍTICO — exige QA gate antes do push.
Sequência: PIPE-1.1 → PIPE-1.2 ‖ (PIPE-2.1 ‖ PIPE-3.1) → PIPE-4.1 → push (Grav).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/PIPE-1.1-pipeline-audit]] | Auditoria de pipelines e leads (READ-ONLY) | 🔴 P0 | S | backlog | dev-data-engineer |
| [[backlog/PIPE-1.2-migrate-leads-to-vendas]] | Migração de leads para "0 | Vendas" (DB CRÍTICO) | 🔴 P0 | M | backlog | dev-data-engineer |
| [[backlog/PIPE-2.1-curso-field-and-webhook]] | Campo personalizado "Curso" + webhook por curso | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/PIPE-3.1-fix-duplicate-leads]] | Investigar e corrigir leads duplicados | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/PIPE-4.1-qa-gate-consolidation]] | QA Gate — validar PIPE-1.2, PIPE-2.1, PIPE-3.1 | 🔴 P0 | M | backlog | dev-qa |

---

## 🔌 WEBHOOK INBOUND — Incremento (2026-05-10)

Épico: `joaoguirunas-webhook-increment`. Objetivo: incrementar a feature de Webhook Inbound (já em produção via stories wh-01..04) com 4 epics: (1) manual de envio com payload dinâmico, (2) defaults de mapping pré-configurados, (3) `create_mode` controlável (criar/atualizar/somente-etapa), (4) disparo automático de WhatsApp pós-ingestão com paridade ao Form PRO.
Sequência sugerida:
- Epic 1: 1.1 → 1.2 (linear)
- Epic 2: 2.1 → 2.2 (linear)
- Epic 3: 3.1 → (3.2 ‖ 3.3) (3.2 e 3.3 paralelizáveis após 3.1)
- Epic 4: 4.1 → (4.2 ‖ 4.3) (4.2 e 4.3 paralelizáveis após 4.1)
- Cross-epic: epics 1, 2, 3, 4 são independentes — pode rodar todos em paralelo.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/story-1.1-payload-manual-ui]] | Manual de envio — seção "Como enviar" com payload dinâmico | 🟠 P1 | M | backlog | dev-dev-alpha |
| [[backlog/story-1.2-payload-fallback-exemplo]] | Payload de exemplo genérico quando sem field_mappings | 🟠 P1 | S | backlog | dev-dev-alpha |
| [[backlog/story-2.1-mapping-defaults-pre-config]] | Campos padrão pré-configurados (Nome, WhatsApp, E-mail) | 🟠 P1 | S | backlog | dev-dev-alpha |
| [[backlog/story-2.2-defaults-editaveis-comportamento]] | Defaults editáveis — QA do comportamento de mapping | 🟢 P2 | S | backlog | dev-dev-alpha |
| [[backlog/story-3.1-create-mode-migration]] | Migration — coluna `create_mode` (enum) em `inbound_webhooks` | 🟠 P1 | S | backlog | dev-data-engineer |
| [[backlog/story-3.2-create-mode-ui-selector]] | UI — selector "Comportamento" (create_mode) | 🟠 P1 | S | backlog | dev-dev-alpha |
| [[done/story-3.3-create-mode-edge-function]] | Edge function aplicar `create_mode` no fluxo | 🟠 P1 | M | done | dev-dev-beta |
| [[backlog/story-4.1-trigger-config-migration]] | Migration — coluna `trigger_config` JSONB | 🟠 P1 | S | backlog | dev-data-engineer |
| [[backlog/story-4.2-trigger-config-ui-painel]] | UI — painel "Disparo automático" (paridade Form PRO) | 🟠 P1 | L | backlog | dev-dev-alpha |
| [[done/story-4.3-trigger-config-edge-dispatch]] | Edge function enfileirar disparo WA via `trigger_config` | 🟠 P1 | L | done | dev-dev-beta |

---

## 🔌 WEBHOOK INBOUND — Settings/Integrações (2026-05-10)

Épico: `joaoguirunas-webhook-inbound`. Objetivo: permitir que clientes recebam dados de sistemas externos via webhook configurável (token + field mapping → upsert pessoa + criação opcional de lead). Tela em Settings/Geral, separada do feature outbound existente.
Sequência: wh-01 → (wh-02 ‖ wh-03) → wh-04.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/story-wh-01]] | DB Migration — tabela `inbound_webhooks` | 🔴 P0 | S | backlog | dev-data-engineer |
| [[backlog/story-wh-02]] | Edge Function — `webhook-inbound` (token auth + ingestão CRM) | 🔴 P0 | M | backlog | dev-dev-beta |
| [[backlog/story-wh-03]] | Frontend — `WebhookInboundConfig` (lista + editor + tester) | 🔴 P0 | L | backlog | dev-dev-alpha |
| [[backlog/story-wh-04]] | Registry + Sidebar — wiring `/settings/general/webhook-inbound` | 🔴 P0 | S | backlog | dev-dev-gamma |

---

## 📤 SENDS PRO — Melhorias de Import (2026-05-03)

Épico: `joao-guirunas-sends-pro-melhorias`. Objetivo: melhorias incrementais no fluxo de importação de listas do módulo Disparos. Ciclo atual focado em paridade de formato de template (CSV + XLS).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/SP-01]] | Adicionar download de template em XLS além de CSV no Sends Pro | 🟢 P2 | S | backlog | dev-dev-alpha |

---

## 🎯 COACH PRO — Refinamento UX completo (2026-05-02)

Épico: `coach-pro-refinamento`. Objetivo: elevar todas as telas Coach Pro ao look enterprise (alinhado a `bi-enterprise-spec`), com filtros time/consultor consistentes, charts Recharts (line+area, donut, radar, sparkline, ring), config single-screen com auto-save, e enriquecimento da lista/single de Reunioes com dados de avaliação inline.
Spec base: [[../agents/ux/coach-pro-specs]].
Sequência sugerida: (CP-1 ‖ CP-2 ‖ CP-3) → (CP-4 ‖ CP-5) → (CP-6 ‖ CP-7). `src/components/coach/utils.ts` é dependência transversal — primeira story a fechar cria.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/CP-1-coach-dashboard-enterprise]] | CoachDashboard — visual enterprise + filtros time/corretor + charts | 🟠 P1 | L | backlog | dev-dev-alpha |
| [[backlog/CP-2-coach-team-board-enterprise]] | CoachTeamBoard — visual enterprise + filtros + benchmark refinado | 🟠 P1 | M | backlog | dev-dev-alpha |
| [[backlog/CP-3-coach-consultant-profile]] | CoachConsultantProfile — refinamento visual enterprise + radar + breakdown | 🟠 P1 | L | backlog | dev-dev-alpha |
| [[backlog/CP-4-coach-pro-config-single-screen]] | CoachProConfig — redesign single-screen + auto-save + preview scorecard | 🟠 P1 | XL | backlog | dev-dev-gamma |
| [[backlog/CP-5-reunioes-lista-coach-data]] | Reunioes lista — coluna Coach Score + Deal Risk + Playbook + filtros | 🟠 P1 | M | backlog | dev-dev-gamma |
| [[backlog/CP-6-reuniao-single-refinement]] | ReuniaoSingle — refinamento completo + bloco Coach enriquecido | 🟠 P1 | L | backlog | dev-dev-beta |
| [[backlog/CP-7-coach-meeting-evaluation-enterprise]] | CoachMeetingEvaluation — refinamento enterprise + radial + radar + bug fix | 🟠 P1 | L | backlog | dev-dev-beta |

---

## 🧠 BI PRO — Refinamento visual e voz inteligente (2026-05-02)

Épico: `bi-pro-refinamento`. Objetivo: sanitizar voz do TTS e aplicar look enterprise (whitespace, hierarquia, padronização) em todas as 4 telas BI + SummaryBar.
Sequência sugerida: bi-1 (standalone) ‖ bi-2 → (bi-3 ‖ bi-4).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/bi-1-voice-sanitizer]] | Voice sanitizer: markdownToVoiceText() + sumarizador semântico para ElevenLabs TTS | 🟠 P1 | M | backlog | dev-dev-alpha |
| [[backlog/bi-2-insights-enterprise]] | Redesign enterprise do BIProInsightsTab + BIProSummaryBar | 🟠 P1 | L | backlog | dev-ux + dev-dev-alpha |
| [[backlog/bi-3-comercial-enterprise]] | Redesign enterprise do BIProComercialTab | 🟠 P1 | L | backlog | dev-ux + dev-dev-alpha |
| [[backlog/bi-4-revops-marketing-enterprise]] | Redesign enterprise BIProRevOpsTab + BIProMarketingTab | 🟠 P1 | L | backlog | dev-ux + dev-dev-alpha |

---

## 🎬 JOAO-GUIRUNAS-SIM — Base de dados fake para apresentação comercial (2026-05-02)

Épico: `joao-guirunas-sim-dados-apresentacao`. Tenant alvo: `wotuyxscsfralqpoiyfv`.
**Constraint crítica:** apenas INSERT/UPDATE — nunca ALTER/CREATE/DROP.
Sequência sugerida: sim-1 → sim-2 → (sim-3 ‖ sim-4) → (sim-5 ‖ sim-6).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/sim-1-dados-config-base]] | Dados de configuração base (pipelines, stages, motivos perda, usuários demo) | 🟠 P1 | M | backlog | dev-data-engineer |
| [[backlog/sim-2-leads-contacts]] | ~100 leads + ~30 empresas com 30 dias de histórico e UTMs | 🟠 P1 | L | backlog | dev-data-engineer |
| [[backlog/sim-3-conversas]] | Mínimo 50 conversas WhatsApp/Instagram com IA + humano + cliente | 🟠 P1 | L | backlog | dev-data-engineer |
| [[backlog/sim-4-deals-vendas]] | 20+ vendas fechadas + 15+ perdidas + pipeline ativo | 🟠 P1 | M | backlog | dev-data-engineer |
| [[backlog/sim-5-reunioes]] | 40+ reuniões (passadas/hoje/futuras) correlacionadas com funil | 🟠 P1 | M | backlog | dev-data-engineer |
| [[backlog/sim-6-campanhas-investimentos]] | 6 campanhas Meta+Google + 30 dias de spend + ROAS coerente | 🟠 P1 | L | backlog | dev-data-engineer |

---

## 🤖 AGENTS PRO — Bug fixes (2026-05-01)

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[done/1.1-fix-agents-pro-save]] | Fix: botão de salvar em agents pro não persiste dados | 🔴 P0 | M | ✅ done | alpha (FE) + data-engineer (RPC) |

---

## 📤 SENDS — Revisão completa do módulo SENDS PRO (2026-04-30 / triagem 2026-05-01)

Triagem: [[../agents/architect/sends-backlog-triage]]
Sequência sugerida (joao-guirunas-fix-sends-module, iteração corrente): FIX-SENDS-FIRST-MSG-01 → FIX-SENDS-FILTER-01 → FIX-SENDS-DISPATCH-01.

### SENDS PRO disparo — saída do team `joao-guirunas-sends-pro-disparo-rca` (2026-05-01)

RCA: [[../agents/research/2026-05-01-sends-disparo-rca]]. Disparo end-to-end OK desde 2026-05-01T17:13. As 4 stories abaixo são **dívidas remanescentes** validadas com 5-point checklist (GO 5/5 cada).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/FIX-SENDS-STATUS-BRIDGE-01]] | Bridge de delivered/read da Meta para sends_contacts via whatsapp-inbound + trigger SQL | 🟠 P1 | M | backlog | dev-dev-beta + dev-data-engineer |
| [[backlog/FIX-SENDS-CRON-LEGACY-URLS]] | Sanear 3 crons periféricos com URL/config legados (URLs Supabase antigas + GUC app.settings) | 🟠 P1 | S | backlog | dev-data-engineer |
| [[backlog/FIX-SENDS-FE-VALIDATION]] | Filtro de templates APPROVED + variables_map UI + handleAtivar invoca worker | 🟡 P2 | M | backlog | dev-dev-alpha + dev-dev-beta |
| [[backlog/OBS-DISPATCH-HEALTH-01]] | View v_dispatch_health + RPC get_send_health + DispatchHealthCard UI | 🟢 P3 | M | backlog | dev-data-engineer + dev-dev-alpha |

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/FIX-SENDS-FIRST-MSG-01]] | Primeira mensagem do disparo + observabilidade permanente do delivery WhatsApp (ADR-SENDS-01 accepted) | 🔴 P0 | L | active | byte (schema, em paralelo) + beta (edge fns, pós-RCA) + alpha/Aria (UI) + gamma/Iris (hooks) + ux |
| [[backlog/SENDS-IMPORT-01]] | Simplificar fluxo de importação — remover templates prontos | 🟡 P2 | S | backlog | dev-dev-gamma |
| [[backlog/SENDS-IMPORT-02]] | Expandir campos mapeáveis — Q-fields, empresa estruturada e cobertura completa | 🟠 P1 | L | ✅ done | dev-dev-gamma |
| [[backlog/SENDS-FIX-01]] | Auditoria completa de quebras no módulo SENDS PRO | 🟠 P1 | M | backlog | dev-dev-delta |
| [[backlog/FIX-SENDS-FILTER-01]] | Corrigir filtro person_status ignorado em filter-leads-for-send | 🟠 P1 | S | backlog | dev-dev-delta |
| [[backlog/FIX-SENDS-FILTER-02]] | Corrigir has_more com count real em filter-leads-for-send | 🟠 P1 | S | backlog | dev-dev-delta |
| [[backlog/FIX-SENDS-DISPATCH-01]] | Atomic claim em sends-dispatch-batch via UPDATE+RETURNING (race) | 🟠 P1 | M | backlog | dev-dev-beta |
| [[backlog/FIX-SENDS-DISPATCH-02]] | Reduzir retry delays inline para prevenir timeout em batch | 🟡 P2 | S | backlog | dev-dev-beta |
| [[backlog/FIX-SENDS-IMPORT-03]] | Criar lead para contatos existentes quando create_leads=true | 🟡 P2 | M | backlog | dev-dev-delta |
| [[backlog/FIX-SENDS-IMPORT-04]] | Dedup e insert em bulk para imports >1000 contatos | 🟡 P2 | L | backlog | dev-dev-delta |
| [[backlog/FIX-SENDS-IMPORT-05]] | Campos personalizados de negócio/lead visíveis no FieldMapper sem createLeads | 🟡 P2 | S | backlog | dev-dev-gamma |
| [[backlog/FIX-SENDS-IMPORT-06]] | Reintroduzir input estático de lead_control no ImportListaTab | 🟡 P2 | S | backlog | dev-dev-gamma |
| [[backlog/FIX-SENDS-UI-01]] | Não sobrescrever started_at ao retomar disparo pausado | 🟡 P2 | S | backlog | dev-dev-gamma |
| [[backlog/FIX-SENDS-UI-02]] | Corrigir timezone em scheduled_at ao criar disparo agendado | 🟡 P2 | S | backlog | dev-dev-gamma |
| [[backlog/CLEAN-SENDS-MIGRATION-01]] | Remover migration duplicada + config.toml para sends-dispatch-batch | 🟢 P3 | XS | ✅ done | dev-qa |

---

## 🔧 FWUP — Refactor Followups (auditoria 2026-04-27)

Diagnóstico: [[../project/audit-followups-diagnostico]]
Sequência sugerida: FWUP-01 (urgente) → FWUP-02 → (FWUP-03 ‖ FWUP-04) → (FWUP-05, FWUP-06, FWUP-07, FWUP-08) → (FWUP-09, FWUP-10, FWUP-11).

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/FWUP-01]] | Rotacionar JWT service_role hardcoded em pg_cron | 🔴 P0 | M | backlog | dev-data-engineer |
| [[backlog/FWUP-02]] | Resolver colisão de tabela meetings_followups (CallPro vs Agendamento) | 🔴 P0 | L | backlog | data-engineer + alpha |
| [[backlog/FWUP-03]] | Canonicalizar schema de leads_stages_followups | 🟠 P1 | M | backlog | dev-data-engineer |
| [[backlog/FWUP-04]] | Migrar componentes ScoreMatrix para category_selections | 🟠 P1 | M | backlog | dev-dev-alpha |
| [[backlog/FWUP-05]] | FollowupModal — capturar UUID do template e nome amigável | 🟠 P1 | S | backlog | dev-dev-alpha |
| [[backlog/FWUP-06]] | Implementar retry e dead-letter em followup_queue | 🟠 P1 | M | backlog | data-engineer + beta |
| [[backlog/FWUP-07]] | Padronizar valores de meeting_status (eliminar 'não compareceu') | 🟠 P1 | S | backlog | data-engineer + alpha |
| [[backlog/FWUP-08]] | Corrigir validação timing CallPro + unificar canal 'ligacao' | 🟠 P1 | M | backlog | dev-dev-alpha |
| [[backlog/FWUP-09]] | DROP de tabelas mortas e remoção de phantom fields | 🟡 P2 | S | backlog | dev-data-engineer |
| [[backlog/FWUP-10]] | Cleanup de campos UI obsoletos e flags mortas | 🟡 P2 | S | backlog | alpha + analyst |
| [[backlog/FWUP-11]] | Padronizar nomenclatura PT→EN em followup_queue | 🟡 P2 | M | backlog | dev-data-engineer |

---

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/FWUP-18b]] | Hardening buckets storage — MIME types + path-prefix policies | 🟠 P1 | S | backlog | dev-dev-gamma |
| [[backlog/FIX-PP-01]] | Fix edge fns prospect-scorer + prospect-commit (v1 schema) | 🔴 P0 | M | backlog | dev-data-engineer (byte) |
| [[backlog/FIX-SP-01]] | Fix capability token user_id → tenant_id (linha 108) | 🟠 P1 | S | backlog | dev-dev-beta (rex) |
| [[backlog/FIX-SENDS-01]] | Mover dispatch loop do browser para servidor (pg_cron) | 🟠 P1 | L | ✅ done | dev-dev-gamma (sera) |
| [[backlog/FIX-COACH-01]] | Fix mismatch view coach_meeting_evaluations vs meeting_evaluations | 🟠 P1 | S | backlog | dev-data-engineer (byte) |
| [[done/FIX-IG-AUT-01]] | Comentário IG com keyword 'brandbook' não dispara automação configurada | 🟠 P1 | M | ✅ done | dev-dev-beta (rex) |
| [[backlog/FIX-IG-AUT-02]] | UI Automações IG não distingue 'comentário não chegou' de 'chegou e não bateu' | 🟡 P2 | S | backlog | dev-dev-alpha |
| [[backlog/FIX-OMNI-01]] | Action tokens em whatsapp-outbound + IG token refresh | 🟡 P2 | M | backlog | dev-dev-beta (rex) |
| [[backlog/FIX-BI-01]] | OAuth token refresh BI + localizar/criar edge fn TikTok sync | 🟡 P2 | M | backlog | dev-analyst (lyra) |
| [[backlog/FIX-SCORE-01]] | Atualizar types.ts score-pro, remover as any, re-avaliação assíncrona | 🟡 P2 | M | backlog | dev-analyst (lyra) |
| [[backlog/FIX-ADM-01]] | Rollback em adm-create-user + remover hints secrets plaintext | 🟡 P2 | M | backlog | dev-architect (zael) |
| [[backlog/FIX-AUTH-01]] | Hardening auth — fallbackProfile, rate limit, remover stubs legados | 🟡 P2 | M | backlog | dev-architect (zael) |
| [[backlog/FIX-SCH-02]] | Double-booking, Zoom refresh e RLS em meeting_evaluations | 🟡 P2 | M | backlog | dev-dev-beta (rex) |
| [[backlog/FIX-COACH-02]] | Auto-trigger pós-transcrição + cron weekly_summary | 🟡 P2 | M | backlog | dev-data-engineer (byte) |
| [[backlog/CLEAN-CRM-01]] | Round-robin, alias PT/EN, corrigir useMotivosPerda | 🟢 P3 | S | backlog | dev-dev-gamma (sera) |
| [[backlog/CLEAN-OMNI-01]] | Remover crm_messages legado + completar PDF extraction | 🟢 P3 | S | backlog | dev-dev-beta (rex) |
| [[backlog/CLEAN-SETTINGS-01]] | 9 débitos UX em Settings | 🟢 P3 | M | backlog | dev-ux |
| [[backlog/CLEAN-SENDS-01]] | Tipos gerados sends_contacts + FK stage_ids/template_id | 🟢 P3 | S | backlog | dev-dev-gamma (sera) |
| [[backlog/US-CFG-01]] | MFA / Two-Factor Authentication para gestores | 🟡 P2 | L | backlog | dev-dev-alpha |
| [[backlog/US-CFG-02]] | Rate limit de login com feedback visual | 🟡 P2 | S | backlog | dev-dev-alpha |
| [[backlog/US-CFG-03]] | Audit log de ações em Settings | 🟢 P3 | M | backlog | dev-dev-alpha |
| [[backlog/US-CFG-04]] | Gestão de API Keys internas (geração, rotação, revogação) | 🟡 P2 | M | backlog | dev-dev-alpha |
| [[backlog/US-CFG-05]] | Central de Notificações — preferências por canal e evento | 🟢 P3 | M | backlog | dev-dev-alpha |
| [[backlog/US-CFG-06]] | Módulo de Permissões granulares por role | 🟡 P2 | L | backlog | dev-architect |
| [[backlog/US-CFG-07]] | White-label — domínio customizado e branding completo | 🟢 P3 | L | backlog | dev-dev-alpha |
| [[backlog/US-CFG-08]] | Export de dados e conformidade LGPD | 🟡 P2 | M | backlog | dev-dev-alpha |
| [[backlog/AUTH-V2-01]] | Substituir extractTenantId unsigned por supabase.auth.getUser | 🟠 P1 | M | backlog | dev-data-engineer |
| [[backlog/AUTH-V2-02]] | fallbackProfile com isProvisional — bloquear mutations e exibir warning | 🟡 P2 | M | backlog | dev-dev-beta |
| [[backlog/AUTH-V2-03]] | MFA opcional via TOTP (Supabase Auth) | 🟡 P2 | L | backlog | dev-dev-alpha |
| [[backlog/AUTH-V2-04]] | Centralizar PUBLIC_ROUTES em src/utils/constants.ts | 🟢 P3 | S | backlog | dev-dev-gamma |
| [[backlog/AUTH-V2-05]] | Renomear useSimpleAuthSingleTenant → useAuth | 🟢 P3 | M | backlog | dev-dev-beta |
| [[backlog/AUTH-V2-06]] | enabled_modules via Supabase Realtime (substituir polling 30s) | 🟢 P3 | M | backlog | dev-dev-beta |
| [[backlog/AUTH-V2-07]] | Cleanup crm_tenants, useTenants e user_has_tenant_access | 🟢 P3 | M | backlog | dev-data-engineer |
| [[backlog/AUTH-V2-08]] | CSP + COOP/COEP headers no Vercel | 🟡 P2 | S | backlog | dev-architect |
| [[backlog/AUTH-V2-09]] | Rate limit real no login via edge function intermediária | 🟡 P2 | M | backlog | dev-dev-alpha |
| [[backlog/AUTH-V2-10]] | Audit log de eventos de auth (login, logout, falhas) | 🟢 P3 | M | backlog | dev-dev-alpha |
| [[backlog/AUTH-V2-11]] | Recovery flow robusto — não depender de type=recovery na URL | 🟡 P2 | S | backlog | dev-dev-beta |
| [[backlog/AUTH-V2-12]] | RestrictedRoute requireSuperAdmin — validar via fetch ao control plane | 🟡 P2 | M | backlog | dev-architect |
| [[backlog/ADM-V3-01]] | Unificar catálogo de módulos — extrair ALL_MODULES para constante única | 🟡 P2 | S | backlog | dev-architect |
| [[backlog/ADM-V3-02]] | Rollback em adm-create-user — transação compensatória | 🟠 P1 | M | backlog | dev-data-engineer |
| [[backlog/ADM-V3-03]] | Retry com backoff exponencial em adm-sync-client por migration falhada | 🟡 P2 | M | backlog | dev-data-engineer |
| [[backlog/ADM-V3-04]] | Cache server-side em adm-client-config (Deno KV) | 🟢 P3 | M | backlog | dev-architect |
| [[backlog/ADM-V3-05]] | Rotação automática de management_token | 🟡 P2 | M | backlog | dev-data-engineer |
| [[backlog/ADM-V3-06]] | Índices em adm_audit_log para queries de paginação | 🟡 P2 | S | backlog | dev-data-engineer |
| [[backlog/ADM-V3-07]] | Versionar migrations RPCs e audit_log em migrations_adm/ | 🟡 P2 | M | backlog | dev-data-engineer |
| [[backlog/ADM-V3-08]] | UI badge de drift de schema por tenant na sidebar do ADM | 🟢 P3 | S | backlog | dev-architect |
| [[backlog/ADM-V3-09]] | Health check periódico via cron — popular last_health_check_at | 🟡 P2 | M | backlog | dev-data-engineer |
| [[backlog/ADM-V3-10]] | Soft-delete de tenant com grace period de 30 dias | 🟡 P2 | L | backlog | dev-architect |

## 🚀 RELEASE-PIPELINE-V1 — sistema robusto multi-tenant updates

ADR: [[../decisions/ADR-REL-01-release-pipeline]]
Sequência sugerida: REL-04 → REL-01 → REL-02 → REL-03 → REL-05.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/REL-01]] | Versioned Releases — release.json + adm_releases + adm_client_versions + GH Action tag | 🟠 P1 | M | backlog | data-engineer + devops |
| [[backlog/REL-02]] | ADM "Atualizar Cliente" UI — botão + bulk + modal + Realtime status | 🟠 P1 | L | backlog | alpha + ux |
| [[backlog/REL-03]] | Drift Detection cron + Self-Healing Repair button | 🟡 P2 | M | backlog | beta + data-engineer |
| [[backlog/REL-04]] | Migration Discipline — lint-migrations.js + CI block + dry-run | 🟠 P1 | M | backlog | devops + data-engineer |
| [[backlog/REL-05]] | Schema Baseline Squashing — script + arquivamento + onboarding rápido | 🟡 P2 | M | backlog | data-engineer |

## 🎙️ BI-VOICE — Gemini Live voice assistant pra BI PRO

Sequência: BI-VOICE-00 → BI-VOICE-01 → BI-VOICE-02 → BI-VOICE-03 → BI-VOICE-04.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[active/BI-VOICE-00]] | Provider Gemini em settings_ai_providers + helper backend cost-isolation | 🟡 P2 | S | active (AC1-5 done, AC6 deferido) | dev-data-engineer + dev-dev-alpha |
| [[active/BI-VOICE-01]] | Edge fn gemini-live-token (ephemeral, per-tenant cost isolation) | 🟡 P2 | M | active (DONE — commit adef507d) | dev-dev-beta |
| [[active/BI-VOICE-02]] | Hook useGeminiLive — audio pipeline + WebSocket + tool calls async | 🟡 P2 | L | active | dev-dev-alpha |
| [[active/BI-VOICE-03]] | Tools BI integration — async function calling sobre RPCs existentes | 🟡 P2 | M | active (blocked by BI-VOICE-02) | dev-dev-gamma |
| [[backlog/BI-VOICE-04]] | Integração final voz↔tools + telemetria tenant_id + UI feature gate | 🟠 P1 | M | in_progress (task #22 Nova) | dev-dev-alpha |

---

## 👥 USER-TYPES — Auditoria de tipos de usuário (2026-05-07)

Épico: `joao-guirunas-validate-user-types`. Origem: veredicto FAIL da auditoria QA — 1 CRITICAL (RLS bypass via FWUP-17) + 3 HIGH + 3 MED + 6 LOW. Push bloqueado até CRITICAL fechar.

| Story | Título | Prioridade | Complexidade | Status | Agente |
|---|---|---|---|---|---|
| [[backlog/FIX-USR-01]] | Restaurar RLS restritivo em settings_users (CRITICAL) | 🔴 P0 | M | in_progress | dev-data-engineer |
| [[backlog/FIX-USR-02]] | Remover SELECT em settings_users.tenant_id | 🟠 P1 | S | done | dev-data-engineer |
| [[backlog/FIX-USR-03]] | Trigger para invariante super_admin ↔ user_type='admin' | 🟠 P1 | S | in_progress | dev-data-engineer |
| ~~FIX-USR-04~~ | ~~Drop stacks RBAC mortos~~ — invalidada (superseded por ARCH-RBAC-02) | — | — | invalidated | — |
| [[done/ARCH-RBAC-01]] | Decisão arquitetural — sistema RBAC granular: veredicto Opção B (descontinuar) → ADR-AUTH-09 | 🟠 P1 | M | done | dev-architect |
| [[backlog/ARCH-RBAC-02-drop-rbac-granular]] | Drop completo do sistema RBAC granular (tenant_roles + UI + hooks + 1 migration) | 🟠 P1 | S | backlog | dev-data-engineer |
| [[done/ADR-USR-01]] | ADRs retroativos — FWUP-17 + invariante super_admin | 🟡 P2 | S | done | dev-architect |
