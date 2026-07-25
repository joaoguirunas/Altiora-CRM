---
title: Arquitetura
type: overview
agent: dev-architect
created: 2026-04-22
updated: 2026-05-10
tags: [architecture]
related: ["[[modules]]", "[[overview]]", "[[tech-stack]]"]
---

# Arquitetura — João Guirunas

## 1. Visão geral

SPA React (Vite + TS) servida em domínio fixo, com backend 100% Supabase em projeto único e dedicado (`wotuyxscsfralqpoiyfv`): Postgres + Auth + Storage + Realtime + Edge Functions Deno. **Single-tenant** — sem control plane, sem catálogo de clientes, sem resolução de tenant em runtime; credenciais Supabase ficam fixas em [[../../../src/integrations/supabase/client.ts]]. Navegação mobile é redirect-based para uma shell dedicada em `/m/*`.

**Padrão:** single-tenant + edge-function-first para integrações externas (Meta, Google, Microsoft, TikTok, ElevenLabs, Apollo, PDL, Explorium, tl;dv, Zoom).

## 2. Deployment topology

```mermaid
flowchart LR
    User[Usuário browser] -->|app João Guirunas| CDN[Vercel CDN]
    CDN --> SPA[SPA React<br/>Vite build]

    SPA -->|2. data queries| DB[(Supabase DB<br/>wotuyxscsfralqpoiyfv)]
    SPA -->|3. edge fns| FN[Edge Functions]
    SPA -->|Realtime WS| DB

    FN -->|Meta Graph API| META[Meta WhatsApp/IG/Ads]
    FN -->|Google APIs| GOOGLE[Calendar + Ads]
    FN -->|LLMs| LLM[OpenAI / Groq / Anthropic / Gemini]
    FN -->|Enrichment| PROV[Apollo / PDL / Explorium]

    DB -->|pg_cron + pg_net| FN
```

## 3. Bootstrap do client

[[../../../src/main.tsx]] importa `App` direto. As credenciais Supabase (`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`) estão hardcoded em [[../../../src/integrations/supabase/client.ts]] apontando para `wotuyxscsfralqpoiyfv.supabase.co`.

**Vestígios do antigo desenho multi-tenant** (resolução por hostname + `sessionStorage._supabase_client_config` + edge fn `adm-client-config`) podem ainda existir em código por herança, mas **não são exercitados em runtime** nesta operação single-tenant. Refactor futuro deve eliminá-los (ver backlog).

**Listener de deploy:** `window.addEventListener('vite:preloadError', () => location.reload())` auto-recarrega em deploys novos (hashes de chunk antigos).

## 4. Client/server boundary

### Client (SPA)
- **Auth:** `@supabase/supabase-js` em modo client (localStorage persist, autoRefreshToken). [[../../../src/hooks/useSimpleAuthSingleTenant.ts]] gerencia o auth.
- **Data fetching:** TanStack Query v5 com cache agressivo (`staleTime: 60s`, `gcTime: 5min`, `refetchOnWindowFocus: false`). 177+ hooks `useX.ts`.
- **Server state only:** nenhum estado de servidor em Zustand. Zustand é usado pontualmente para UI state (ex: wizard steps).
- **RLS-first:** queries usam anon key + JWT do usuário; Postgres decide autorização via RLS (ver §6).

### Server (Supabase)
- **Postgres 15** com ~713 migrations.
- **RLS** ativo em todas as tabelas com `tenant_id`. JWT claim `app_metadata.tenant_id` mantido como fonte de verdade do filtro RLS — herdado do desenho multi-tenant; mantido como defesa em profundidade mesmo em single-tenant. (ver [[../decisions/ADR-PP-03]] histórico: deprecação de `extractTenantId` unsigned).
- **Edge Functions Deno** para I/O externo e orquestração. 90+ funções agrupadas em §5 de [[modules]].
- **pg_cron + pg_net** disparam edge fns por evento de DB (ex: `ai-agent-execute` quando `message_buffer` expira; `omni-delivery-engine` processando `messages.status='pending'`).
- **Realtime** via canal Supabase filtrado por `tenant_id=eq.*` em [[../../../src/contexts/RealtimeContext.tsx]].

## 5. Fluxos de dados principais

### 5.1 Inbound WhatsApp → AI Agent → Outbound

```mermaid
sequenceDiagram
    participant Meta as Meta Cloud API
    participant WI as whatsapp-inbound
    participant DB as Postgres
    participant Cron as pg_cron
    participant AIE as ai-agent-execute
    participant LLM as LLM Provider
    participant WO as whatsapp-outbound

    Meta->>WI: POST webhook (HMAC signed)
    WI->>WI: validar HMAC-SHA256
    WI->>DB: UPSERT clients_people
    WI->>DB: INSERT messages (status=delivered)
    WI->>DB: UPSERT message_buffer (buffer_ms)
    Note over DB,Cron: buffer expira
    Cron->>AIE: pg_net POST { people_id }
    AIE->>DB: SELECT agent by pipeline
    AIE->>DB: load context (person, lead, company, Q-fields, meetings, score)
    loop max 8 tool iterations
        AIE->>LLM: chat completion + tools
        LLM-->>AIE: response OR tool_calls
        AIE->>DB: execute tool (buscar_reunioes, mover_etapa, etc)
    end
    AIE->>WO: POST final text
    WO->>Meta: POST graph API
    AIE->>DB: INSERT messages (from=AI) + log
```

**Invariantes:**
- `verify_jwt=false` em `whatsapp-inbound` (Meta não envia JWT). Segurança via HMAC-SHA256.
- `whatsapp-outbound` é interno, também `verify_jwt=false` — chamado de edge↔edge.
- Timeout de LLM: 30s dentro do limite de 60s do edge.

### 5.2 OMNI Delivery Engine (outbound broadcast)

```mermaid
flowchart TB
    MSG[messages<br/>status=pending<br/>from != cliente] -->|pg_cron tick| ODE[omni-delivery-engine]
    ODE -->|channel=whatsapp| WO[whatsapp-outbound]
    ODE -->|channel=instagram| IO[instagram-outbound]
    ODE -->|channel=email/sms/tel| WH[omni_channel_configs.webhook_fallback]
    WO --> Graph[Meta Graph]
    IO --> Graph
    ODE -->|age > 24h| DEAD[status=error + retry-dead-letter]
```

### 5.3 Public Form submission (FORM PRO)

```mermaid
sequenceDiagram
    participant LP as Landing Page
    participant LS as lp-submit
    participant DB as Supabase DB

    LP->>LS: POST { _form_id, pessoa.*, empresa.*, score.*, custom.*, utm }
    LS->>DB: rate limit (form_pro_rate_limits, 10/min/IP)
    LS->>DB: INSERT form_pro_submissions
    LS->>DB: UPSERT clients_people (dedup por email/phone)
    LS->>DB: UPSERT clients_companies + junction
    LS->>DB: apply score.* + async re-evaluation
    LS->>DB: RPC upsert_crm_field_value (custom.*)
    LS->>DB: INSERT leads (pipeline + first stage, no dup per pipeline)
    LS->>DB: post-submit actions (OMNI welcome msg)
    LS-->>LP: { success, redirect_url }
```

### 5.4 Public Booking (SCHEDULE PRO)

```mermaid
sequenceDiagram
    participant Lead as Lead (público)
    participant FE as /agendar/:leadId
    participant RPC as Postgres RPC
    participant PB as public-booking
    participant GC as Google Calendar
    participant WA as WhatsApp

    Lead->>FE: load página
    FE->>RPC: get_booking_session(leadId)
    RPC-->>FE: slots disponíveis
    Lead->>FE: selecionar slot
    FE->>RPC: book_meeting(...)
    RPC-->>FE: meeting_id
    FE->>PB: POST { action: gcal_sync, meeting_id }
    PB->>PB: issueActionToken (HMAC, TTL 60s)
    PB->>GC: push event
    FE->>PB: POST { action: wa_confirm, meeting_id }
    PB->>PB: consumeActionToken
    PB->>WA: template confirmação
```

**Decisão-chave (ADR-SP-02):** Ações edge↔edge autenticam via **action tokens HMAC-SHA256** (`issueAction`/`consumeAction` em [[../../../supabase/functions/_shared/capability/]]) em vez de JWT, pois as sub-ações operam sem contexto de usuário. TTL máximo 120s, chave rotacionada via vault.

## 6. Segurança (RLS + capability)

| Camada | Mecanismo | Onde |
|---|---|---|
| **Auth app** | Supabase Auth + magic link + Google OAuth | [[../../../src/hooks/useSimpleAuthSingleTenant.ts]] |
| **RLS tenant_id** | policy usa `auth.jwt() -> 'app_metadata' -> 'tenant_id'` (defesa em profundidade) | migrations de cada tabela |
| **Role roles** | `settings_users.user_type ∈ {gestor, consultor, atendente, cliente}` + `super_admin` | [[../../../src/components/auth/RestrictedRoute.tsx]], [[../../../src/components/auth/ModuleProtectedRoute.tsx]] |
| **Webhooks externos** | HMAC-SHA256 assinatura (Meta, TikTok) | `whatsapp-inbound`, `tiktok-inbound`, `meta-inbound` |
| **Edge↔Edge** | Action tokens HMAC com TTL 10-120s | [[../../../supabase/functions/_shared/capability/]] |
| **Public endpoints** | Rate limit DB-backed (lp-submit: `form_pro_rate_limits`; public-booking: in-memory 30/min/IP) | — |

**ADR histórico (contexto):** `extractTenantId` em [[../../../supabase/functions/_shared/response.ts]] usa decode **unsigned** de JWT — marcado @deprecated, substituir por `supabase.auth.getUser(token)` → `user.app_metadata.tenant_id` (ver comentário no arquivo citando ADR-PP-03).

## 7. Mobile strategy

Não é app nativo — é a mesma SPA com shell dedicado em `/m/*`:

- [[../../../src/hooks/use-mobile.tsx]] detecta viewport < md.
- [[../../../src/App.tsx]] redireciona usuários mobile autenticados para `/m/bi` se pousarem em rota desktop (exceção: `PUBLIC_ROUTES`).
- `MobileShell` + `MobileBottomTabs` = layout mobile; rotas `bi`, `crm`, `omni`, `perfil` (subset do desktop).
- `MobileModuleGuard` replica `ModuleProtectedRoute` com UI mobile.

## 8. Performance

- **QueryClient agressivo:** `staleTime: 60s`, `refetchOnWindowFocus: false`, `retry: 1` ([[../../../src/App.tsx]]).
- **Realtime com rate limit:** 3s por evento em [[../../../src/contexts/RealtimeContext.tsx]]; `stabilizedInvalidate` com debounce diferenciado por tabela.
- **Auth com timeout agressivo:** 2s para profile fetch, 3s para init ([[../../../src/hooks/useSimpleAuthSingleTenant.ts]]). Fallback profile em caso de timeout — UI nunca trava.
- **Heartbeat realtime:** 45s ping, max 2 falhas antes de reconnect ([[../../../src/hooks/useRealtimeHeartbeat.ts]]).
- **Exponential backoff:** realtime reconnect usa `min(2000 * 1.5^n, 15000)` até 50 tentativas.
- **No manualChunks:** [[../../../vite.config.ts]] deixa o rollup decidir code-splitting. `vite:preloadError` auto-reload.

## 9. Padrões arquiteturais identificados

1. **Single-tenant** com credenciais Supabase fixas no client.
2. **Edge-function-first** para qualquer I/O externo ou trabalho assíncrono. Cron em DB, execução em edge.
3. **RLS como autorização primária** — backend lógica é mínimo, Postgres decide.
4. **Response uniforme HTTP 200 + `{ ok: boolean }`** em edge fns do Prospect PRO (ver `_shared/response.ts`), para contornar limitação do `supabase.functions.invoke()` que descarta body em não-2xx.
5. **Action tokens HMAC** para edge↔edge em vez de JWT compartilhado.
6. **Feature-folder + hooks-per-domain:** cada produto PRO tem `components/<produto>/` + `hooks/use<Produto>*`.
7. **shadcn/ui para primitivos, feature-folders para composição** — nenhuma abstração de "design system interna" acima de `ui/`.
8. **Mobile como subset** da mesma SPA (redirect-based), não app separado.
9. **Deploy-aware:** versão injetada via [[../../../vite.config.ts]] (`__APP_VERSION__`) e auto-reload em chunk stale.

## 10. Decisões arquiteturais relevantes

ADRs numerados vivem em `docs/smart-memory/decisions/`. ADRs identificados por referência no código:

- **ADR-SP-02** — capability tokens HMAC para autenticação edge↔edge em `public-booking` ([[../../../supabase/functions/_shared/capability/issueAction.ts]])
- **ADR-PP-03** — server-verified tenant_id (deprecação de `extractTenantId` unsigned)
- **N8N-WAA-5/6/7/8** — rework da integração WhatsApp → AI Agent (referências em `whatsapp-inbound/index.ts` e `ai-agent-execute/index.ts`)

Recriar ADRs será responsabilidade posterior quando revisitados.

---

**Relacionados:** [[modules]] · [[overview]] · [[tech-stack]] · [[conventions]] · [[../decisions/|ADRs]]
