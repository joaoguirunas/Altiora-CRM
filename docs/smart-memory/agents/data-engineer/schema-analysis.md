---
title: "Schema Analysis — Sim Dados Apresentação João Guirunas"
type: research
agent: dev-analyst
created: 2026-05-02
updated: 2026-05-10
tags: [schema, simulacao, joao-guirunas, apresentacao]
related: ["[[schema]]", "[[../project/tech-stack]]"]
---

# Schema Analysis — Time `joao-guirunas-sim-dados-apresentacao`

**Solicitado por:** team-lead
**Objetivo:** Mapear schema do tenant João Guirunas (`wotuyxscsfralqpoiyfv`) para gerar dados fake de apresentação comercial.

---

## Contexto crítico (LER ANTES DE INSERIR DADOS)

### 1. João Guirunas é SINGLE-TENANT

Após a refatoração de 2026-03-12 (`baseline tenant epoch`), o tenant João Guirunas opera em **schema single-tenant**:

- **NÃO existem mais** as tabelas legadas `crm_pessoas`, `crm_leads`, `crm_messages`, `crm_agendamentos`, `crm_campanhas`, `crm_tenants`, etc.
- **NÃO existe coluna `tenant_id`** nas tabelas de negócio. Isolamento é feito pelo Supabase project (`wotuyxscsfralqpoiyfv`).
- A tabela `crm_messages` foi explicitamente dropada em `20260423016000_drop_crm_messages.sql`.
- O schema canônico vivo é o produzido por `20260312150001_ensure_full_tenant_baseline.sql` + migrations subsequentes.

### 2. Tenant ID = Supabase Project ID

`wotuyxscsfralqpoiyfv` é o **Project Ref** do Supabase do João Guirunas (URL: `https://wotuyxscsfralqpoiyfv.supabase.co`). Não é uma coluna em tabela alguma.

### 3. Auth users vs settings_users

- `auth.users` → managed pelo Supabase Auth
- `public.settings_users` → tabela de aplicação, FK `auth_user_id` para `auth.users(id)`
- Para criar dados fake de "atendentes/SDRs" basta `INSERT` em `settings_users` (pode deixar `auth_user_id = NULL` se não houver login real)

---

## Tabelas relevantes para simulação

### A. Identidade & estrutura (criar primeiro)

#### `settings_users` — usuários (SDRs/atendentes/gestores)
```
id                  uuid PK default gen_random_uuid()
auth_user_id        uuid UNIQUE → auth.users(id) ON DELETE CASCADE  (nullable)
name                text NOT NULL
email               text NOT NULL
phone               text
avatar_url          text
user_type           text default 'atendente'   -- 'atendente' | 'gestor' | etc
super_admin         boolean default false
active              boolean default true
deleted_at          timestamptz
deleted_by          uuid
created_at          timestamptz default now()
updated_at          timestamptz default now()
```
**Obrigatórios:** `name`, `email`. RLS habilitada.

#### `settings_teams` — times (vendas/SDR/etc)
```
id          uuid PK
name        text NOT NULL
description text
team_type   text default 'vendas'
priority    integer default 0
active      boolean default true
created_at  / updated_at
```

#### `settings_users_teams` — N:N usuário↔time
```
id        uuid PK
user_id   uuid → settings_users(id) ON DELETE CASCADE
team_id   uuid → settings_teams(id) ON DELETE CASCADE
is_leader boolean default false
created_at
UNIQUE (user_id, team_id)
```

---

### B. Pipeline & estágios

#### `leads_pipelines`
```
id          uuid PK
name        text NOT NULL
description text
active      boolean default true
created_at / updated_at
```
*Obs.:* há também `order_index` adicionada por `fwup20`.

#### `leads_stages`
```
id                   uuid PK
leads_pipelines_id   uuid → leads_pipelines(id) ON DELETE CASCADE
name                 text NOT NULL
color                text
order_index          integer NOT NULL default 0
active               boolean default true
created_at / updated_at
```

#### `leads_loss_reasons`
```
id, name (NOT NULL), description, active, created_at, updated_at
```

---

### C. Pessoas / Empresas / Contatos

#### `clients_people` — base de contatos (fonte de leads, atendimentos, vendas)
```
id                       uuid PK
name                     text NOT NULL
email                    text
whatsapp                 text                 -- principal canal de identificação
document                 text                 -- CPF/CNPJ
type                     text                 -- 'lead' | 'cliente' | etc (livre)
notes                    text
status                   text default 'ativo' -- pode virar 'merged' (dedup)
service_status           text                 -- 'aberto' | 'encerrado' (atendimento)
source                   text                 -- 'whatsapp' | 'instagram' | 'manual' | ...
accepts_calls            boolean default true
ai_enabled               boolean default false
archived                 boolean default false
archived_at              timestamptz
-- Score (FKs adicionados depois — ON DELETE SET NULL)
score                    integer
score_matrix_id          uuid → score_matrix(id)
score_framing_id         uuid → score_framings(id)
score_investment_id      uuid → score_investments(id)
score_objective_id       uuid → score_objectives(id)
-- Profile
income, moment, goal     text
disc_profile             text
disc_summary             text
conversation_summary     text
-- Q1..Q13 (qualificação) — todos nullable
q1_age                   integer
q2_has_children          boolean
q3_number_of_children    integer
q4_qualification_1       text
q5_qualification_area    text
q6_profession_current    text
q7_profession_years      text
q8_professional_recognition text
q9_foreign_citizenship   boolean
q10_migration_process    text
q11_decision_move_usa    text
q12_start_process_time   text
q13_household_income     text
created_at / updated_at
-- Adicionados por fwup27 (Omni/dedup):
instagram_id             text UNIQUE
instagram_user_id        text UNIQUE
instagram_handle         text
merged_into_id           uuid → clients_people(id)   -- self-FK p/ dedup
merge_history            jsonb default '[]'
telefone                 text
ai_last_message_at       timestamptz
ai_processing_lock       boolean default false
tiktok_open_id           text
```
**Obrigatórios:** apenas `name`. Tudo o resto é opcional. RLS habilitada.

#### `clients_companies`
```
id, trade_name (NOT NULL), legal_name, tax_id, email, phone, website, address, created_at, updated_at
```

#### `clients_people_companies` (N:N)
Existe — referenciada em `merge_persons()` — mas a definição aparece em migrations posteriores ao baseline. Se for popular pessoas com empresas, criar registros. Caso contrário, pode pular (não é obrigatório).

#### `clients_people_updates` (audit log opcional)
```
id, people_id → clients_people, user_id → settings_users, field_name (NOT NULL),
old_value, new_value, created_at
```

---

### D. Leads (negócios / oportunidades) — TABELA CENTRAL

#### `leads`
```
id                      uuid PK
title                   text                 -- nome do negócio
description             text
control                 text
value                   numeric default 0    -- VALOR DA VENDA
status                  text default 'in_progress'
                          CHECK IN ('in_progress', 'won', 'lost', 'archived')
people_id               uuid → clients_people(id) ON DELETE SET NULL
company_id              uuid → clients_companies(id) ON DELETE SET NULL
                        -- ATENÇÃO: foi renomeado de companies_id em R2 (etapa repair)
leads_pipelines_id      uuid → leads_pipelines(id) ON DELETE SET NULL
leads_stages_id         uuid → leads_stages(id) ON DELETE SET NULL
leads_loss_reasons_id   uuid → leads_loss_reasons(id) ON DELETE SET NULL
loss_reason             text                 -- texto livre fallback
teams_id                uuid → settings_teams(id) ON DELETE SET NULL
user_id                 uuid → settings_users(id) ON DELETE SET NULL
                        -- ATENÇÃO: renomeado de users_id em R2
archived                boolean default false
archived_at             timestamptz
won_at                  timestamptz          -- timestamp do ganho (sale closed)
lost_at                 timestamptz          -- timestamp da perda
last_interaction_at     timestamptz
created_at / updated_at

-- Adicionados por R3 (UTM tracking):
fb_lead_id              text
utm_source              text
utm_medium              text
utm_campaign            text                 -- KEY: liga a bi_ad_campaigns.utm_campaign
utm_term                text
utm_content             text
gclid                   text
fbclid                  text

-- Adicionados em 2026-05-02:
recomendante            text                 -- nome de quem indicou
relacao_recomendante    text
relacao_corretor        text
nome_evento             text                 -- evento de origem
origem_lista            text                 -- lista/campanha de origem
```

**Obrigatórios:** nenhum NOT NULL sem default além de `id`. Pode-se inserir `leads` com apenas `(id, status)` — todo o resto é opcional. RLS habilitada.

**Para "venda fechada":**
- `status = 'won'`
- `won_at = <timestamp>`
- `value = <valor>`
- `leads_stages_id` deve apontar para um stage que represente "Fechado" (criar via UI ou seed)

#### Auxiliares de lead
- `leads_notes` (id, lead_id, user_id, title, content, created_at, updated_at)
- `leads_files` (id, lead_id, user_id, file_name, file_url, file_type, file_size, created_at)
- `leads_updates` (id, lead_id, user_id, from_stage_id, to_stage_id, notes, created_at) — histórico de movimentação

> **Nota R2 nas auxiliares:** todas tinham colunas `leads_id`/`users_id` e foram renomeadas para `lead_id`/`user_id`. Use os nomes singulares.

#### `lead_field_definitions` + `lead_field_values` (campos customizados)
Se quiser variar dados por pipeline. Para uma sim básica, ignorar.

---

### E. Conversas (mensagens)

#### `messages` — única tabela de mensagens (substituiu `crm_messages`)
```
id                    bigserial PK
content               text NOT NULL
from_contact          text default 'cliente'   -- 'cliente' | 'humano' | 'agente_ia' | 'follow_up'
                       (constraint não rígida, valores convencionais)
message_type          text default 'texto'
                       -- 'texto' | 'audio' | 'chamada' | 'private_reply' | 'email'
                       -- (private_reply add em 2026-04-30, email/chamada em 2026-04-30)
status                text default 'pendente'   -- 'pendente' | 'sent' | 'delivered' | 'read' | 'failed'
channel               text default 'whatsapp'
media_url             text
whatsapp_template_id  text
followup_id           uuid → leads_stages_followups(id) ON DELETE SET NULL
people_id             uuid → clients_people(id) ON DELETE CASCADE
lead_id               uuid → leads(id) ON DELETE SET NULL
                        -- renomeado de leads_id em R2
user_id               uuid → settings_users(id) ON DELETE SET NULL
                        -- renomeado de users_id em R2
sent_at               timestamptz
delivered_at          timestamptz
read_at               timestamptz
created_at / updated_at

-- Adicionados por fwup26:
source_type           text CHECK IN ('inbound', 'manual', 'ai_agent',
                                     'campaign', 'form', 'followup',
                                     'appointment_reminder')
wa_message_id         text     -- Meta WhatsApp message ID
wa_phone_number_id    text     -- número Business que enviou/recebeu
media_metadata        jsonb
metadata              jsonb
```

**Obrigatórios:** apenas `content`. Para cada conversa simulada, recomenda-se variar `from_contact` (cliente vs humano vs agente_ia) e timestamp `sent_at`/`created_at`.

---

### F. Reuniões (agendamentos)

#### `meetings`
```
id              uuid PK
title           text NOT NULL
description     text
location        text
meeting_link    text
notes           text
status          text default 'agendada'
                 CHECK (após P7 normalize):
                 IN ('agendado', 'compareceu', 'não compareceu',
                     'cancelado', 'bloqueio manual')
                 -- ATENÇÃO: 'agendada' (feminino) foi normalizado para 'agendado'
start_time      timestamptz NOT NULL
end_time        timestamptz NOT NULL
people_id       uuid → clients_people(id) ON DELETE SET NULL
lead_id         uuid → leads(id) ON DELETE SET NULL          -- renomeado em R2
user_id         uuid → settings_users(id) ON DELETE SET NULL  -- renomeado em R2
teams_id        uuid → settings_teams(id) ON DELETE SET NULL
created_at / updated_at
source          text                                          -- adicionado depois (Google sync vs manual)
```

**Obrigatórios:** `title`, `start_time`, `end_time`. RLS habilitada.

#### `meeting_records` (gravações/transcrições — opcional p/ sim)
```
id, meeting_id (NOT NULL → meetings), record_type CHECK IN
('recording','transcript','summary','ai_summary','ai_analysis','note'),
source, url, duration_seconds, thumbnail_url, title, content, content_format,
ai_sentiment, ai_score (0-100), ai_key_topics text[], ai_next_steps text[],
ai_objections text[], ai_metadata jsonb, recorded_at, created_by, created_at, updated_at
```

#### `meetings_followups` + `meeting_followup_queue`
Regras de follow-up por status. Se a sim quiser mostrar automações ativas, popular `meetings_followups` (estática, regras). A `meeting_followup_queue` é runtime — provavelmente vazia para sim.

---

### G. Campanhas / Investimento de marketing

> **MUITO IMPORTANTE:** No schema atual João Guirunas NÃO existe mais `crm_campanhas`. Campanhas comerciais agora são tracked via **BI PRO** (Meta Ads / Google Ads).

#### `bi_settings` (singleton de credenciais OAuth)
```
id PK, meta_app_id, meta_app_secret, google_client_id, google_client_secret,
google_developer_token, singleton (UNIQUE = true), updated_at
```
Uma única linha. Se já existir, pular.

#### `bi_ad_accounts` — contas conectadas (Meta/Google)
```
id PK
platform        text NOT NULL CHECK IN ('meta', 'google')
account_id      text NOT NULL                -- ID na plataforma
account_name    text NOT NULL
access_token    text                          -- pode deixar NULL na sim
refresh_token   text                          -- pode deixar NULL
token_expires_at timestamptz
is_active       boolean default true
last_sync_at    timestamptz
created_at / updated_at
UNIQUE (platform, account_id)
```

#### `bi_ad_campaigns` — campanhas
```
id PK
ad_account_id   uuid NOT NULL → bi_ad_accounts ON DELETE CASCADE
platform        text CHECK IN ('meta','google')
campaign_id     text NOT NULL                -- ID externo
campaign_name   text NOT NULL
status          text default 'active' CHECK IN ('active','paused','deleted')
objective       text                          -- 'leads', 'conversions', etc
utm_campaign    text                          -- KEY: faz match com leads.utm_campaign
created_at / updated_at
UNIQUE (platform, campaign_id)
```

#### `bi_ad_spend` — INVESTIMENTO DIÁRIO POR CAMPANHA
```
id PK
ad_account_id   uuid NOT NULL → bi_ad_accounts ON DELETE CASCADE
campaign_id     uuid → bi_ad_campaigns(id) ON DELETE SET NULL
platform        text CHECK IN ('meta','google')
date            date NOT NULL                -- dia do gasto
spend           numeric(12,2) NOT NULL default 0   -- VALOR EM R$
impressions     integer
clicks          integer
leads           integer                      -- leads atribuídos pela plataforma
currency        text default 'BRL'
raw_data        jsonb
source          text default 'api' CHECK IN ('api','csv')
created_at
UNIQUE (campaign_id, date)
```

**Para apresentação:** popular `bi_ad_spend` com 1 row/dia/campanha por 30+ dias.

#### `bi_sdr_targets` — metas de reuniões por SDR
```
id PK, user_id → settings_users (NOT NULL), year, month (1-12), daily_target,
created_at, updated_at, UNIQUE (user_id, year, month)
```

---

### H. Disparos (Sends Pro) — opcional para apresentação

#### `sends` — campanha de disparo de mensagem
```
id PK
name             text NOT NULL
description      text
template_id      uuid → whatsapp_templates(id) ON DELETE SET NULL
status           text default 'draft'
                  -- 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'paused'
pipeline_id      uuid → leads_pipelines(id) ON DELETE SET NULL
stage_ids        uuid[]   -- CHECK validate_stage_ids() — todos devem existir
team_id          uuid → settings_teams(id) ON DELETE SET NULL
created_by       uuid → settings_users(id) ON DELETE SET NULL
total_contacts   integer default 0
sent_count       integer default 0
delivered_count  integer default 0
read_count       integer default 0
error_count      integer default 0
scheduled_at, started_at, completed_at  timestamptz
created_at / updated_at

-- Adicionados por fwup31:
channel               text NOT NULL default 'whatsapp' CHECK IN ('whatsapp','email','sms','phone')
type                  text NOT NULL default 'filtered' CHECK IN ('imported','filtered')
failed_count          integer default 0
send_interval_seconds integer default 60 CHECK IN (5,10,30,60,300,600,1800,3600)
webhook_id            uuid → webhooks(id) ON DELETE SET NULL
filter_config         jsonb
wa_channel_id         uuid → settings_whatsapp_channels(id) ON DELETE SET NULL
message_content       text
last_batch_at         timestamptz
```

#### `sends_contacts`
```
id PK, send_id → sends ON DELETE CASCADE, people_id → clients_people,
whatsapp text NOT NULL, status default 'pending', error_message,
sent_at, delivered_at, read_at, created_at
```

#### `sends_import_sessions` (estado de import — opcional p/ sim)

---

### I. WhatsApp / Omni Channel

#### `settings_whatsapp_channels` — números Business (credenciais Meta)
```
id, label NOT NULL, phone_number_id NOT NULL UNIQUE, access_token NOT NULL,
is_default default false, active default true, created_at / updated_at,
meta_template_name (R3)
```
**Atenção:** `phone_number_id` e `access_token` são NOT NULL. Para sim, pode usar valores fake (`'fake-phone-id-001'`, `'FAKE_TOKEN'`).

#### `whatsapp_templates`
```
id PK, id_template text NOT NULL, name NOT NULL, slug NOT NULL,
status default 'ativo', system_enabled default true, json_data jsonb, variables jsonb
```

#### `omni_channel_configs` (centralização de config por canal)
```
id, channel UNIQUE CHECK IN ('whatsapp','instagram','email','sms','telefone'),
is_active default false, display_name NOT NULL, credentials/settings/webhook_fallback/business_hours jsonb
```

---

### J. AI / Score (opcional)

- `ai_agents`, `ai_agents_history`, `ai_agents_steps`, `ai_agents_steps_history`, `ai_agents_score_matrix`
- `score_objectives`, `score_investments`, `score_framings`, `score_matrix`

Para apresentação **comercial focada em CRM**, esses módulos podem ser deixados vazios ou com seed mínimo (1 agente padrão).

---

## Hierarquia de inserção (ordem correta)

```
1. settings_users                    -- 0 dependências (auth_user_id pode ser NULL)
2. settings_teams                    -- 0 deps
3. settings_users_teams              -- depende de 1, 2
4. leads_pipelines                   -- 0 deps
5. leads_stages                      -- depende de 4
6. leads_loss_reasons                -- 0 deps
7. clients_companies                 -- 0 deps
8. clients_people                    -- 0 deps (FKs de score são SET NULL)
   ├─ score_objectives, score_investments, score_framings, score_matrix
   │  podem ser inseridos antes se quiser score real
9. clients_people_companies          -- depende de 7, 8 (se for usar)
10. leads                            -- depende de 4, 5, 6, 7, 8
11. leads_notes / leads_files / leads_updates  -- dependem de 10
12. messages                         -- depende de 8, 10
13. meetings                         -- depende de 8, 10, 1, 2
14. meeting_records                  -- depende de 13

Marketing (independente do funil):
15. bi_ad_accounts                   -- 0 deps
16. bi_ad_campaigns                  -- depende de 15
17. bi_ad_spend                      -- depende de 15, 16
18. bi_sdr_targets                   -- depende de 1

Sends (opcional):
19. settings_whatsapp_channels       -- 0 deps
20. whatsapp_templates               -- 0 deps
21. webhooks                         -- 0 deps
22. sends                            -- depende de 4, 5, 19, 20, 21, 1, 2
23. sends_contacts                   -- depende de 8, 22
```

---

## Campos NOT NULL sem DEFAULT (lista de obrigatórios)

| Tabela | Coluna(s) sem default |
|---|---|
| `settings_users` | `name`, `email` |
| `settings_teams` | `name` |
| `leads_pipelines` | `name` |
| `leads_stages` | `name` (FK `leads_pipelines_id` é nullable) |
| `clients_people` | `name` |
| `clients_companies` | `trade_name` |
| `leads` | nenhum (todos têm default ou são nullable) |
| `messages` | `content` |
| `meetings` | `title`, `start_time`, `end_time` |
| `bi_ad_accounts` | `platform`, `account_id`, `account_name` |
| `bi_ad_campaigns` | `ad_account_id`, `platform`, `campaign_id`, `campaign_name` |
| `bi_ad_spend` | `ad_account_id`, `platform`, `date`, `spend` (default 0) |
| `bi_sdr_targets` | `user_id`, `year`, `month` |
| `settings_whatsapp_channels` | `label`, `phone_number_id`, `access_token` |
| `whatsapp_templates` | `id_template`, `name`, `slug` |
| `sends` | `name`, `channel` (default), `type` (default) |
| `sends_contacts` | `send_id` (CASCADE), `whatsapp` |

---

## Enums e valores convencionais

| Tabela.coluna | Valores válidos |
|---|---|
| `leads.status` | `in_progress`, `won`, `lost`, `archived` |
| `meetings.status` | `agendado`, `compareceu`, `não compareceu`, `cancelado`, `bloqueio manual` |
| `messages.from_contact` | `cliente`, `humano`, `agente_ia`, `follow_up` (convenção, sem CHECK rígido) |
| `messages.message_type` | `texto`, `audio`, `chamada`, `email`, `private_reply` |
| `messages.status` | `pendente`, `sent`, `delivered`, `read`, `failed` (convenção) |
| `messages.source_type` | `inbound`, `manual`, `ai_agent`, `campaign`, `form`, `followup`, `appointment_reminder` |
| `clients_people.status` | `ativo`, `merged` (e outros livres) |
| `clients_people.service_status` | `aberto`, `encerrado` |
| `bi_ad_accounts.platform` | `meta`, `google` |
| `bi_ad_campaigns.status` | `active`, `paused`, `deleted` |
| `sends.channel` | `whatsapp`, `email`, `sms`, `phone` |
| `sends.type` | `imported`, `filtered` |
| `sends.send_interval_seconds` | `5, 10, 30, 60, 300, 600, 1800, 3600` |

---

## Observações finais

1. **RLS está habilitada** em todas as tabelas. Se você inserir como `service_role` (Supabase admin), passa direto. Como `authenticated` user, RLS exige que o user esteja em `settings_users` ativo.

2. **Não criar nem alterar schema** — política do projeto é só `INSERT`/`UPDATE` em estrutura existente. Se faltar alguma tabela/coluna no banco real do tenant João Guirunas, a falha é problema de migration drift, não de seed.

3. **Para 30+ dias de histórico:**
   - Variar `created_at`, `updated_at`, `won_at`, `last_interaction_at` em `leads`
   - Variar `start_time` em `meetings` ao longo de 30 dias
   - Variar `created_at`, `sent_at` em `messages` (~10-20 mensagens por conversa típica)
   - Variar `date` em `bi_ad_spend` (1 row/dia/campanha × N campanhas)

4. **Para "20 vendas fechadas":**
   ```sql
   leads SET status='won', won_at=<timestamp>, value=<R$>
   ```
   distribuir os 20 entre 30 dias e múltiplos `user_id` (SDRs).

5. **Para "50 atendimentos":**
   - 50 `clients_people` distintos com `service_status='aberto'` (ou `'encerrado'`)
   - Cada um com pelo menos 5-15 `messages` linkadas via `people_id` (e `lead_id` se houver lead associado)

6. **UTM tracking liga lead↔campanha:** `leads.utm_campaign = bi_ad_campaigns.utm_campaign`. Para mostrar CAC/ROAS no BI, popular ambos coerentemente.

7. **Tenant ID na conexão:** o seed deve rodar contra `https://wotuyxscsfralqpoiyfv.supabase.co` com a `service_role_key` do projeto João Guirunas. Não inserir nenhuma coluna `tenant_id` (não existe).

---

## Fontes (migration files lidos)

- `supabase/migrations/20260312150001_ensure_full_tenant_baseline.sql` (1342 linhas — SOURCE OF TRUTH)
- `supabase/migrations/20260217000000_bipro_ad_tables-ok.sql` (BI Ads)
- `supabase/migrations/20260308110000_bi_sdr_targets-ok.sql`
- `supabase/migrations/20260412000000_sends_import_sessions.sql`
- `supabase/migrations/20260423015000_sends_fk_constraints.sql`
- `supabase/migrations/20260430140000_fwup26_messages_missing_columns.sql`
- `supabase/migrations/20260430150000_fwup27_clients_people_missing_columns.sql`
- `supabase/migrations/20260430220000_fwup31_sends_missing_columns.sql`
- `supabase/migrations/20260501100000_fix_leads_status_ativo.sql`
- `supabase/migrations/20260502130000_leads_add_indicacao_evento_fields.sql`
- `supabase/migrations/20260502140000_leads_add_origem_lista.sql`
- `supabase/migrations/20260228000000_p7_meetings_status_normalize-ok.sql`
- `supabase/migrations/20260423016000_drop_crm_messages.sql` (confirma drop do legado)
