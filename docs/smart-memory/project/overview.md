---
title: Project Overview
type: overview
status: active
agent: team-os
created: 2026-04-22
updated: 2026-05-10
tags: [project, overview]
related: ["[[tech-stack]]", "[[architecture]]", "[[modules]]", "[[conventions]]", "[[../stories/BACKLOG]]"]
---

# João Guirunas

## Objetivo

Plataforma SaaS single-tenant dedicada à operação comercial de **João Guirunas**, consolidando o ciclo ponta-a-ponta em **10 módulos "PRO"** sob uma SPA única: BI, CRM, SENDS, PROSPECT, SCHEDULE, OMNI, FORM (LP), CALL, COACH e SCORE. Toda a aplicação aponta para um único projeto Supabase dedicado (`wotuyxscsfralqpoiyfv`); não há resolução de tenant em runtime nem catálogo de clientes — credenciais são fixas no client.

## Stack principal

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 5 (SWC) + React 18 + TypeScript 5.5 + Tailwind 3 + shadcn/ui + Radix |
| Routing | react-router-dom 7 (BrowserRouter) |
| Data | TanStack Query 5 + `@supabase/supabase-js` 2.81 |
| State | 4 contexts React (Tenant stub, Navigation, Loading, Realtime) + Zustand 5 (pontual, UI state) |
| Forms | react-hook-form 7 + zod 3 |
| Backend | Supabase (Postgres 15 + Auth + Storage + Realtime + ~86 Edge Functions Deno) |
| Package manager | bun |
| Versionamento | `version.json` injetado via `__APP_VERSION__` — bumpado por GitHub Actions no deploy |

Detalhe completo em [[tech-stack]].

## Padrão arquitetural

**Single-tenant** — a aplicação aponta para um único projeto Supabase (`wotuyxscsfralqpoiyfv.supabase.co`) com credenciais fixas em [[../../../src/integrations/supabase/client.ts]]. Não há control plane, não há resolução por hostname, não há `adm_clients` ativo. **Edge-function-first** para I/O externo; **RLS como autorização primária** (JWT claim `app_metadata.tenant_id` mantido por compatibilidade — ver §3); **action tokens HMAC** para edge↔edge (ADR-SP-02).

**Bootstrap simplificado:** [[../../../src/main.tsx]] importa `App.tsx` direto. Vestígios de `bootstrapClientConfig()` podem ainda existir no código por herança do antigo modelo multi-tenant — qualquer chamada de `adm-client-config` deve ser removida em refactor futuro.

Fluxos de dados documentados (Mermaid) em [[architecture]] §5: inbound WhatsApp → AI agent → outbound · OMNI delivery engine · FORM submission · public booking.

## Módulos principais

SPA organizada em **46 rotas desktop + 7 rotas mobile** (shell dedicado em `/m/*`), cobrindo 10 produtos:

| Rota | Produto | Responsabilidade |
|---|---|---|
| `/bipro`, `/dashboard` | **BI PRO** | KPIs, funnels, attribution (Google Ads + Meta Ads + TikTok) |
| `/crm/*` | **CRM PRO** | Pipelines kanban, negócios, pessoas, companies |
| `/send/*` | **SENDS PRO** | Broadcast WhatsApp/email com filtros dinâmicos |
| `/prospect/*` | **PROSPECT PRO** | Enrichment via Apollo, PDL, Explorium |
| `/schedule`, `/schedules` | **SCHEDULE PRO** | Booking público + Google Cal / Teams / Zoom integration |
| `/omni/*` | **OMNI PRO** | Caixa unificada WhatsApp, Instagram, TikTok, SMS |
| `/lp` | **FORM PRO** | LP builder + submissões públicas |
| `/call` | **CALL PRO** | Dialer, tabulação, gravações, ElevenLabs TTS |
| `/coach/*` | **COACH PRO** | Avaliação estruturada de reuniões (playbooks + critérios) |
| `/score` | **SCORE PRO** | Matrix de qualificação de leads |
| `/settings/*` | — | Configurações hierárquicas |

Estrutura: **300+ componentes custom** em 20 domínios + **177+ hooks** `useX.ts` com TanStack Query + **90+ edge functions Deno** agrupadas por domínio. Detalhe em [[modules]].

## Escala

- **~713 migrations** aplicadas no projeto Supabase João Guirunas
- **300+ componentes custom** (20 domínios) + **55+ primitivos shadcn/ui**
- **177+ hooks** de dados
- **90+ edge functions** Deno
- **46 páginas desktop** + 7 mobile

## Segurança

- **RLS** em todas as tabelas com `tenant_id` (policies usam `auth.jwt() -> 'app_metadata' -> 'tenant_id'`) — herdado do desenho multi-tenant; mantido como camada de defesa.
- **HMAC-SHA256** em webhooks externos (Meta, TikTok)
- **Action tokens HMAC** (TTL 10–120s) para edge↔edge (ADR-SP-02)
- **Capability tokens** para booking público (ADR-SP-01)
- **Vault** pra service-role credentials (ADR-SP-05)
- **Rate limiting** DB-backed em endpoints públicos (lp-submit, public-booking)

## Design system

Tokens duais light/dark, brand orange `#FF4400`, radius brutalist 2px. Fonts Outfit (sans), Inter, JetBrains Mono. shadcn/ui default style com overrides. Gap de a11y identificado: sidebar colapsado sem `aria-label` (candidato a story futura).

Detalhe em [[../agents/ux/components]].

## Dados

Schema complexo documentado em [[../agents/data-engineer/schema]]. Destaques recentes (Abr/2026):

- Prospect tenant isolation + scoring columns + stuck recovery cron (pg_cron)
- Zoom + tl;dv integration (meeting_records, omni_channel_configs)
- Coach schema: playbooks, evaluations, meeting_playbook_assignments
- Capability tokens: `booking_token_jti_usage`, `action_token_consumed`
- Vault: service-role credentials, `secret_access_log`

## Equipe

Squad dinâmica via `/team-os`. Teammates disponíveis em `.claude/agents/`: architect, analyst, data-engineer, dev-alpha (frontend), dev-beta (backend), dev-gamma (fullstack), dev-delta (hardening), qa, devops, ux.

## Links
- [[tech-stack]] — stack (fonte: dev-analyst)
- [[architecture]] — padrão arquitetural + fluxos Mermaid (fonte: dev-architect)
- [[modules]] — mapa de módulos detalhado (fonte: dev-architect)
- [[conventions]] — convenções de código (fonte: dev-analyst)
- [[../agents/data-engineer/schema]] — schema Supabase completo (fonte: dev-data-engineer)
- [[../agents/ux/components]] — catálogo UI (fonte: dev-ux)
- [[../stories/BACKLOG]] — backlog de stories
- [[../shared-context]] — status board em tempo real
