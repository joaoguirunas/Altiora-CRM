---
title: Mapa de Módulos
type: overview
agent: dev-architect
created: 2026-04-22
updated: 2026-05-10
tags: [architecture, modules]
related: ["[[architecture]]", "[[overview]]", "[[tech-stack]]"]
---

# Mapa de Módulos — João Guirunas

Aplicação single-tenant composta por uma SPA React (`src/`), camada Supabase (`supabase/`) com 90+ edge functions e scripts de operação (`scripts/`). Este documento é o **mapa de alto nível**; cada módulo tem documentação granular dedicada.

> **📖 Para detalhes profundos por módulo, ver [[modules/README|Module Deep-Dives Index]]** — 13 docs (~270 KB, 4.7k linhas) cobrindo visão · componentes · hooks · edge fns · schema · fluxos Mermaid · débito técnico · stories candidatas.

`[[architecture]]` descreve o padrão geral. Esta página fica como overview navegável; deep-dives ficam em `modules/`.

## Estrutura raiz

```
joaoguirunas/
├── src/                    # SPA React (Vite + TS)
│   ├── pages/              # Route components (46 páginas desktop + 7 mobile)
│   ├── components/         # 27 feature-folders + ui/ (shadcn primitives)
│   ├── hooks/              # 177+ hooks de dados (useX pattern, TanStack Query)
│   ├── contexts/           # 4 providers (Tenant, Auth, Realtime, Loading, Navigation)
│   ├── integrations/       # Cliente Supabase + Database types
│   ├── lib/                # helpers (utils, mappers, motion)
│   ├── lp-core/            # runtime do editor de landing pages (FORM PRO™)
│   ├── types/              # tipos de domínio (sends, coach, call-pro, etc.)
│   ├── utils/              # logger, audit, phone, constants, cache
│   ├── i18n/               # i18n (pt-BR)
│   └── data/               # templates estáticos (LP)
├── supabase/
│   ├── functions/          # 90+ edge functions (Deno)
│   ├── migrations/         # 713+ migrations
│   ├── baseline/           # dump do schema baseline
│   ├── manual-fixes/       # SQL ad-hoc out-of-band
│   └── config.toml         # verify_jwt por função
└── scripts/                # manutenção (generate-baseline, etc.)
```

## Frontend — `src/`

### `pages/` — Route components
Cada PRO corresponde a um bloco de rotas em [[../../../src/App.tsx]]:

| Rota | Page | Produto |
|---|---|---|
| `/bipro`, `/dashboard` | [[../../../src/pages/Dashboard]] | **BI PRO™** — KPIs, funnels, attribution |
| `/crm/*` | [[../../../src/pages/Negocios]], [[../../../src/pages/NegocioSingle]], [[../../../src/pages/Clientes]] | **CRM PRO™** — pipelines, kanban, clientes |
| `/send/*` | [[../../../src/pages/Disparos]], [[../../../src/pages/CriarDisparo]] | **SENDS PRO™** — broadcast WhatsApp/email |
| `/prospect/*` | [[../../../src/pages/ProspectPro]] | **PROSPECT PRO™** — enrichment (Apollo, PDL, Explorium) |
| `/schedule`, `/schedules` | [[../../../src/pages/Reunioes]], [[../../../src/pages/Horarios]] | **SCHEDULE PRO™** — booking, Google/Teams/Zoom cal |
| `/omni/*` | [[../../../src/pages/Conversas]], [[../../../src/pages/OmniMensagens]] | **OMNI PRO™** — WhatsApp, Instagram, TikTok, SMS |
| `/lp` | [[../../../src/pages/LpPro]] | **FORM PRO™** — LP builder + submissões |
| `/call` | [[../../../src/pages/CallPro]] | **CALL PRO™** — dialer, tabulação, gravações |
| `/coach/*` | [[../../../src/pages/CoachDashboard]] | **COACH PRO™** — avaliação de reuniões |
| `/score` | [[../../../src/pages/Score]] | **SCORE PRO™** — matrix de qualificação |
| `/settings/*` | [[../../../src/pages/Configuracoes]] | configurações hierárquicas |
| `/m/*` | `pages/mobile/` | shell mobile (BI, CRM, OMNI, perfil) |
| `/agendar/:leadId`, `/f/:formId` | públicas | booking + formulário público |

**Entry:** [[../../../src/main.tsx]] importa `App` direto. As credenciais Supabase são fixas em [[../../../src/integrations/supabase/client.ts]] (single-tenant). [[../../../src/App.tsx]] compõe providers na ordem: `PageErrorBoundary → QueryClient → Theme → Loading → Tooltip → BrowserRouter → Tenant → SimpleAuth → Realtime → Navigation`.

### `components/` — Feature-folders

| Folder | Responsabilidade | Consome |
|---|---|---|
| `agendamento/` | aba de agendamento inline no NegocioSingle | `useAgendamentos` |
| `agentes-ia/` | editor de agentes IA (prompts, identidade, tools, histórico) | `useAgentesIA`, `ai-agent-execute` |
| `auth/` | `LoginPage`, `ProtectedRoute`, `ModuleProtectedRoute`, `RestrictedRoute`, `SimpleAuthProvider` | `useSimpleAuthSingleTenant` |
| `booking/` | `InlineBooking` para agendamento embed | `useBookingRuleSets`, `public-booking` |
| `brandbook/` | 20+ abas de design tokens (Colors, Spacing, Typography, Patterns) | tokens estáticos |
| `call-pro/` | dialer, histórico, popup ativo, analytics, simulator | `useCallPro*` |
| `common/` | widgets reutilizáveis cross-feature (EditableField, MultiSelect, SearchableSelect, WhatsAppInput) | — |
| `config/` | 50+ painéis de configuração (um por integração/feature) | múltiplos hooks |
| `conversas/` | caixa OMNI (sidebar, detalhes, criar agendamento, canned responses) | `useConversas*`, `useMensagensPorPessoa` |
| `dashboard/` | abas BI PRO (Comercial, Marketing, RevOps, Insights, Voice) | `useBIPro*` |
| `debug/` | ModulesDebug, PerformanceMonitor | — |
| `disparos/` | wizard criar disparo, filtros, preview, stats | `useSends*`, `useFilterLeads` |
| `error-boundaries/` | `PageErrorBoundary`, `SectionErrorBoundary`, `AdvancedErrorBoundary` | — |
| `followups/` | editor de follow-ups (stage + agendamento + email templates) | `useFollowups`, `useFollowupQueue` |
| `layout/` | `DashLayout` (sidebar colapsável), `TenantFooter` | `useSystemModules`, `useAuth` |
| `lazy/` | `LazyComponentLoader` | — |
| `loading/` | `Loader`, `StandardPageLoader` | — |
| `lp/` | `LpFormBuilder`, `FormBuilderSortable`, `MetaFormBuilder` | `useLpForms`, `lp-submit` |
| `mobile/` | `MobileShell`, `MobileBottomTabs`, subpastas negocios/conversas/clientes | `useMobileNavigation`, `useIsMobile` |
| `modals/` | 16 modais (editar/arquivar pessoas, reuniões, empresas, usuários, merge) | hooks específicos |
| `negocios/` | kanban, lista, sidebar, tabs (conversa, notas, arquivos, análise, reuniões), score | `useNegocios*`, `useAtribuicaoNegocio` |
| `pessoas/` | cards de campos extras | `useLeadFieldValues` |
| `prospect/` | modal novo campaign, steps (Empresas, Pessoas, CRM, Revisar) | `useProspect*` |
| `reunioes/` | calendário semanal/mensal, meeting records, transcripts, smart slot picker | `useAgendamentos`, `useMeetingRecords` |
| `schedule/` | navegação de abas Schedule | — |
| `status/` | `ConnectionStatusIndicator` | `useRealtimeManager` |
| `ui/` | 57 primitivos shadcn/ui (button, dialog, toast, command, form, etc.) | — |

### `hooks/` — Data layer
177+ hooks, todos `useX.ts` com TanStack Query (`useQuery`/`useMutation`). Agrupados por domínio:
- **Auth/tenant:** `useSimpleAuthSingleTenant`, `useCurrentUser`, `useTenantContext`, `useTenants`, `useUserPermissions`, `useSystemModules`
- **CRM:** `useNegocios*`, `usePessoas*`, `useCompanies*`, `useLeads*`, `useLeadFieldValues`, `usePipelines`, `useMotivosPerda`
- **OMNI:** `useConversas*`, `useMensagensPorPessoa`, `useCannedResponses`, `useOmniChannel*`, `useWhatsappChannels`, `useWhatsappTemplates`
- **BI PRO:** `useBIPro{KPIs,CRM,Funnel,Omni,RevOps,Schedules,Sends,AdAccounts,Attribution,Settings}`
- **SCHEDULE:** `useAgendamentos*`, `useBookingRuleSets`, `useCalendarConnectedUsers`, `useGoogleCalendarEvents`, `useMSTeamsStatus`, `useZoomConnection`, `useSchedules`, `useScheduleAutomations`
- **SENDS/FOLLOWUPS:** `useSends*`, `useFilterLeads`, `useSendDispatch`, `useFollowups`, `useFollowupQueue`, `useFollowupEnqueue`
- **CALL PRO:** `useCallPro{Calls,Dialer,Operators,Realtime,Settings,BIStats,ASQueues,TabulationCategories,Followups}`
- **COACH:** `useCoach{Evaluations,MeetingAssignment,Playbooks,Team}`
- **PROSPECT:** `useProspect{Actions,AuditLog,Campaigns,Companies,People,Plugins,Profiles,Providers}`
- **LP/FORM:** `useLpForms`, `useLpFormCatalog`, `useMetaLeadForms`
- **Score:** `useScore{Categories,Framings,Investments,Matrix,Objectives,Settings}`
- **Infra:** `useRealtimeSubscription`, `useRealtimeHeartbeat`, `useQueryStabilizer`, `useMessageStabilizer`, `useErrorRecovery`, `useDebounce`, `useServiceWorker`, `usePullToRefresh`
- **Settings:** `useSettings`, `useSettingsCompat`, `useConfiguracoesGerais`, `useOmniNewContactSettings`, `useElevenLabsConfig`, `useGoogleOAuthConfig`, `useWebhooks`

### `contexts/` — Global providers
- **[[../../../src/contexts/TenantContext]]** — stub para single-tenant (tenant ID fixo `'single-tenant'`). Credenciais Supabase são fixas em [[../../../src/integrations/supabase/client.ts]].
- **[[../../../src/contexts/RealtimeContext]]** — canal Supabase Realtime para `crm_messages`, `crm_pessoas`, `crm_leads` filtrado por `tenant_id`. Invalidação inteligente por rate-limit (3s por evento).
- **[[../../../src/contexts/LoadingContext]]** — loading global cross-page.
- **[[../../../src/contexts/NavigationContext]]** — histórico de navegação para back-button custom.

### `integrations/supabase/`
- **[[../../../src/integrations/supabase/client]]** — expõe um único client `supabase` apontando para `wotuyxscsfralqpoiyfv.supabase.co` (single-tenant). Helpers/clients antigos do modelo multi-tenant (control plane) podem permanecer como código morto até o refactor de cleanup.
- **`types.ts`** — tipos gerados `Database` via `supabase gen types typescript`.

### `lp-core/` — runtime do editor de landing pages
- `components/` — `VirtualBlockList`, `BlockListPerformanceMonitor`
- `render/section-presets.ts` — presets de seções
- `schema/block-validation.ts` — schema Zod dos blocos
- `tokens/` — `theme-packs.ts`, `token-injector.ts`
- `utils/` — `block-optimization.ts`, `thumbnail-generator.ts`

## Supabase — `supabase/`

### `functions/` — Edge functions (Deno)
Agrupadas por domínio. Cada função é um diretório com `index.ts`. `config.toml` controla `verify_jwt` por função.

> Helpers compartilhados vivem em `functions/_shared/` e incluem `logger.ts`, `response.ts` (CORS + `ok200`/`err200` padronizados), `llm-provider.ts`, `apollo-provider.ts`, `pdl-provider.ts`, `explorium.ts`, `prospect-providers.ts`, `tldv-matching.ts`, `crm-mapper.ts`, `capability/` (HMAC-signed action tokens — ADR-SP-02).

> **Edge functions com prefixo `adm-`** (control plane do antigo modelo multi-tenant) podem permanecer no diretório como código morto até o refactor de cleanup.

#### Auth / users
`create-tenant-user` (JWT), `delete-user` (JWT), `update-user-email` (JWT), `update-user-password` (JWT), `send-invite-email` (JWT), `data-deletion`.

#### CRM / AI
- `ai-agent-execute` — runtime do agente IA, chamado por `pg_cron` quando `message_buffer` expira. Ciclo: load context → render prompt → LLM loop (até 8 iterations) → tool_calls → whatsapp-outbound → log.

#### OMNI PRO (multi-canal)
**WhatsApp:**
- `whatsapp-inbound` (HMAC, no JWT) — webhook Meta; valida HMAC-SHA256, normaliza telefone, detecta `#apagar#`, insere `messages` + `message_buffer`
- `whatsapp-outbound` (no JWT — interno) — dispatcher Graph API
- `whatsapp-templates-sync`, `whatsapp-templates-manage` (no JWT — chamado do tenant)

**Instagram:**
- `instagram-oauth`, `instagram-outbound`, `instagram-automation-runner`, `instagram-comment-{like,reply}`, `instagram-posts-list`, `instagram-token-refresh`

**TikTok:**
- `tiktok-oauth`, `tiktok-inbound` (HMAC), `tiktok-outbound`, `tiktok-token-refresh` (cron)

**Meta (ads/lead gen):**
- `meta-inbound` (no JWT) — leadgen webhook
- `meta-leadgen-create`, `meta-leadgen-sync`, `meta-pages-{list,subscribe}`, `meta-save-credentials`

**Orchestration:**
- `omni-delivery-engine` — cron; pega `messages.status='pending'` (não-cliente) e faz dispatch pelo canal adequado
- `omni-channel-health-check`, `omni-merge-person`, `omni-retry-dead-letter`
- `channel-test-send` — test send cross-canal

#### SENDS PRO (broadcast)
- `filter-leads-for-send` (no JWT) — aplica filtros + retorna counts
- `send-dispatch-worker` (no JWT, JWT validado em código) — worker de dispatch em batch
- `sends-import-contacts` (no JWT) — import CSV
- `send-status-callback`, `dispara-webhook` (JWT)

#### SCHEDULE PRO (booking + calendars)
- `public-booking` (no JWT) — subrotas `gcal_sync`, `wa_confirm` acionadas por RPC `book_meeting`. Usa `capability/issueAction` + `consumeAction` (ADR-SP-02: HMAC-signed action tokens) para integração edge↔edge.
- **Google Cal:** `google-cal-connect`, `google-cal-availability`, `google-cal-pull-event`, `google-cal-sync-events`, `google-cal-sync-to-db`, `google-cal-upsert-event`
- **Teams:** `ms-teams-connect`, `ms-teams-upsert-event`
- **Zoom:** `zoom-connect`, `zoom-upsert-event`
- **Meeting ops:** `meeting-followup-auto-setup`, `process-meeting-followups`, `send-meeting-confirmation`
- **Transcripts:** `tldv-sync`, `tldv-webhook`

#### FOLLOW-UPS (CRM)
- `followup-enqueue`, `followup-status-callback`, `followup-trigger-worker`

#### FORM PRO (LP/forms)
- `lp-submit` (no JWT) — submissão pública de formulário; rate-limit via `form_pro_rate_limits`, upsert `clients_people`/`clients_companies`, cria lead, dispara post-submit actions
- `bi-google-oauth`, `bi-meta-oauth` (conexão OAuth de contas de ads para BI)

#### BI PRO (ads/insights)
- `bi-insights-chat` — chat de insights do BI
- `bi-sync-google-ads`, `bi-sync-meta-ads`
- `conversion-fetch-platforms`, `conversion-send` (upload de conversões customizadas)

#### CALL PRO
- `call-pro-webhook`
- `elevenlabs-agent-sync`, `elevenlabs-sync`, `elevenlabs-tts` (TTS por ElevenLabs)

#### PROSPECT PRO
- `prospect-commit`, `prospect-enrich-contacts`, `prospect-enrich-plugin`, `prospect-scorer`, `prospect-search-companies`, `prospect-search-people`, `prospect-test-connection`

#### COACH PRO
- `coach-email`, `coach-evaluate`

#### Observabilidade
- `logs-proxy` — proxy para UI logs viewer

### `migrations/` — 713 migrations
- Formato: `YYYYMMDDHHMMSS-{uuid|slug}-ok.sql`
- Aplicadas direto ao projeto Supabase João Guirunas (`wotuyxscsfralqpoiyfv`).

### `baseline/schema_baseline.sql` + `baseline.sql`
Dump consolidado do schema para greenfield. Regenerado via [[../../../scripts/generate-baseline.sh]].

### `manual-fixes/` — SQL out-of-band
Scripts aplicados manualmente. `INSTRUCTIONS.md` documenta uso.

## Scripts — `scripts/`
| Script | Função |
|---|---|
| `generate-baseline.sh` | regenera `baseline/schema_baseline.sql` |
| `test-lp-submit.ts` | integration test do lp-submit |

## Logs & dados
- `logs/` — logs locais
- `public/` — static assets
- `dist/` — build Vite
- `version.json` — versão bumpada por GitHub Actions em cada deploy ([[../../../vite.config.ts]] injeta via `__APP_VERSION__`)

---

**Relacionados:** [[architecture]] · [[overview]] · [[tech-stack]] · [[conventions]]
