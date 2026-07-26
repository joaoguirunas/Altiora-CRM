---
title: Plano técnico — inserção de dados fake de apresentação
type: plan
agent: dev-data-engineer
created: 2026-05-02
updated: 2026-05-10
tenant: wotuyxscsfralqpoiyfv
team: joao-guirunas-sim-dados-apresentacao
tags: [seed, demo-data, insertion-plan, single-tenant]
related:
  - "[[schema]]"
  - "[[migrations-log]]"
  - "[[../../archive/2026-05-01-ora-schema-drift]]"
---

# Plano técnico — inserção de dados fake de apresentação

> **Tenant:** `wotuyxscsfralqpoiyfv` (João Guirunas, single-tenant pós 2026-05-01).
> **Source of truth do schema:** `src/integrations/supabase/types.ts` (6 829 linhas, gerado do banco) + `supabase/baseline.sql` (72 713 linhas).
> **ORM:** Supabase JS client (REST/RLS).
> **Restrição absoluta:** apenas `INSERT` / `UPDATE` — nunca `ALTER`, `CREATE`, `DROP`. Trabalhar no schema existente.

---

## 0 — Contexto e premissas

### 0.1 Schema é single-tenant
João Guirunas migrou para single-tenant em 2026-05-01. **As tabelas modernas (`leads`, `clients_people`, `meetings`, `messages`, `sends`, etc.) NÃO têm coluna `tenant_id`.** O isolamento é feito por instância de banco. Portanto:
- ❌ não inserir `tenant_id` em nenhum INSERT da camada moderna
- ❌ ignorar tabelas legadas `crm_*` (crm_pessoas, crm_empresas, crm_leads, crm_messages, crm_agendamentos) — não usar na simulação; o front-end consome o schema moderno
- ✅ usar apenas o schema moderno: `clients_people`, `clients_companies`, `leads`, `meetings`, `messages`, `sends`, `bi_ad_*`, `settings_*`, `leads_*`

### 0.2 Configuração de execução
Inserções via **MCP Supabase** chamado pelo team-lead (Bythak não tem acesso direto ao banco). Bythak prepara os SQLs ou as chamadas REST; team-lead executa. Mesmo padrão usado no fix de schema drift (2026-05-01).

### 0.3 Volumes-alvo (mínimos do briefing)
| Métrica | Mínimo | Sugerido |
|---|---|---|
| Vendas fechadas (won) | 20 | 30 |
| Atendimentos / conversas | 50 | 80 |
| Histórico retroativo | 30 dias | 35 dias (16/04 → 02/05) |
| Reuniões agendadas | — | 60 |
| Campanhas Meta + Google | — | 6 (3 Meta + 2 Google + 1 TikTok) |
| Leads totais | — | 200 (funnel realista) |
| Pessoas (clients_people) | — | 200 |
| Mensagens (conversa multi-turn) | — | ~1 200 (média 6/lead com conversa) |

### 0.4 Janela temporal
- Início: **2026-04-01** (aprox. 30 dias antes da data corrente 2026-05-02)
- Fim: **2026-05-02** (hoje)
- Distribuir `created_at`, `won_at`, `lost_at`, `start_time`, `sent_at` ao longo da janela com peso decrescente para datas mais antigas (curva realista — atividade aumenta com o tempo).

---

## 1 — Tabelas de configuração / lookup (precisam existir antes dos dados de domínio)

> Estas tabelas geralmente já têm registros base no tenant. **Verificar antes de inserir** (`SELECT count(*) FROM <tabela>`). Se vazias, popular com config mínima.

### 1.1 `settings_users` (operadores/SDR/closers)
**Propósito:** quem está como `user_id` em leads, meetings, messages, sends.
**Estado provável em João Guirunas:** já existe ao menos 1 usuário (joao@growthsales.ai). Confirmar com `SELECT id, name, email, user_type FROM settings_users WHERE deleted_at IS NULL`.
**Inserir se necessário:** 4 a 6 usuários fake — mix de SDR, closer, gestor.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() — ignorar (auto) |
| name | text | NOT NULL |
| email | text | NOT NULL — UNIQUE? verificar |
| phone | text | nullable |
| user_type | text | enum-like: provavelmente `closer`/`sdr`/`gestor`/`admin` (ver migration `20260502120000_user_types_canonical_refactor.sql` para valores canônicos) |
| active | boolean | default true |
| super_admin | boolean | default false |
| auth_user_id | uuid | FK → auth.users — **deixar NULL para usuários demo** (não criar usuários auth) |
| avatar_url | text | nullable |
| created_at / updated_at | timestamptz | defaults — ignorar |
| deleted_at / deleted_by | — | NULL |

**Decisão:** não criar `auth.users` para usuários demo — apenas registros em `settings_users` com `auth_user_id = NULL`. Lead/meeting referenciam `settings_users.id`, não `auth.users.id`.

### 1.2 `settings_teams`
**Propósito:** times (vendas/suporte/marketing).
**Inserir se vazia:** 2 times — "Vendas" e "Marketing".

| Coluna | Tipo | Notas |
|---|---|---|
| id, created_at, updated_at | — | ignorar |
| name | text | NOT NULL |
| description | text | nullable |
| team_type | text | livre / enum solto |
| priority | int | nullable |
| active | boolean | default true |

### 1.3 `settings_users_teams` (junction)
Após criar users e teams, associar (user_id, team_id, is_leader).

### 1.4 `leads_pipelines` + `leads_stages`
**Propósito:** funil. Provavelmente já existe um pipeline padrão. Verificar com `SELECT id, name FROM leads_pipelines WHERE active = true`.
**Inserir se necessário:** 1 pipeline "Vendas B2B" com 6 stages clássicos.

`leads_pipelines`:
| Coluna | Tipo | Notas |
|---|---|---|
| name | text | NOT NULL |
| description | text | nullable |
| active | bool | default true |
| order_index | integer | NOT NULL — default 0 |
| id, created_at, updated_at | — | ignorar |

`leads_stages`:
| Coluna | Tipo | Notas |
|---|---|---|
| name | text | NOT NULL |
| leads_pipelines_id | uuid | FK |
| color | text | nullable — usar hex `#3B82F6` etc |
| order_index | int | NOT NULL |
| active | bool | default true |

**Stages sugeridos (ordem 0–5):**
1. "Novo Lead" `#9CA3AF`
2. "Qualificação SDR" `#60A5FA`
3. "Reunião Agendada" `#A78BFA`
4. "Proposta Enviada" `#F59E0B`
5. "Negociação" `#EF4444`
6. "Fechado" `#10B981`
*(perdas vão para `status = 'lost'` em `leads`, não para um stage específico — também é comum ter "Perdido" como stage; manter como `lost` no status.)*

### 1.5 `leads_loss_reasons`
**Propósito:** motivos de perda para leads `lost`.
**Inserir 6 motivos:** "Sem orçamento", "Concorrente escolhido", "Sem fit", "Timing ruim", "Sem retorno", "Decisor mudou".

### 1.6 `whatsapp_templates`
**Propósito:** templates aprovados Meta para SENDS PRO. Verificar — provavelmente já existem alguns.
**Inserir se vazia:** 3–5 templates fake aprovados (ex: `welcome_lead`, `agendar_reuniao`, `follow_up_proposta`).

| Coluna | Notas |
|---|---|
| name, slug, id_template | textos únicos |
| status | "approved" |
| system_enabled | true |
| variables | jsonb com placeholders |
| meta_template_name | igual ao slug |

### 1.7 `bi_ad_accounts`
**Propósito:** contas Meta/Google/TikTok para campanhas.
**Inserir 3 contas:** Meta, Google, TikTok — `is_active=true`, tokens dummy.

| Coluna | Notas |
|---|---|
| platform | "meta" / "google" / "tiktok" |
| account_id | string fake (ex: "act_demo_12345") |
| account_name | "João Guirunas Demo Meta" |
| access_token | nullable — usar texto dummy ou NULL |
| is_active | true |

---

## 2 — Tabelas de domínio (ordem de inserção respeitando FKs)

> Ordem de inserção: **tabelas pais antes das filhas**. As FKs do schema moderno foram extraídas das `Relationships` em `src/integrations/supabase/types.ts`.

### Ordem global

```
1. settings_users           (FK destino de leads/meetings/messages/sends)
2. settings_teams           (FK destino de leads.teams_id, meetings.teams_id)
3. settings_users_teams     (junction)
4. leads_pipelines          (FK destino de leads.leads_pipelines_id)
5. leads_stages             (FK destino de leads.leads_stages_id)
6. leads_loss_reasons       (FK destino de leads.leads_loss_reasons_id)
7. whatsapp_templates       (FK lógica de sends.template_id — armazenado como text)
8. bi_ad_accounts           (FK destino de bi_ad_campaigns)
9. bi_ad_campaigns          (FK destino de bi_ad_daily_stats, bi_ad_spend)
10. clients_companies       (FK destino de leads.company_id)
11. clients_people          (FK destino de leads.people_id, meetings.people_id, messages.people_id, sends_contacts.people_id)
12. clients_people_companies (junction pessoa↔empresa)
13. leads                   (FK destino de meetings.lead_id, messages.lead_id, leads_notes, leads_files, leads_updates, sends_contacts via flow)
14. leads_updates           (histórico de mudança de stage)
15. leads_notes             (anotações)
16. meetings                (após leads — FK lead_id)
17. messages                (após leads e people — FK lead_id, people_id)
18. sends                   (após pipeline + template + wa_channel)
19. sends_contacts          (após sends + clients_people)
20. bi_ad_daily_stats       (após bi_ad_campaigns)
21. bi_ad_spend             (após bi_ad_accounts/campaigns)
```

---

### 2.1 `clients_companies` — empresas
**Volume:** 60–80 empresas.

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| id | uuid | gen_random_uuid() | ignorar |
| trade_name | text | **NOT NULL** | nome fantasia |
| legal_name | text | nullable | razão social |
| email | text | nullable | |
| phone | text | nullable | |
| tax_id | text | nullable | CNPJ fake |
| address | text | nullable | |
| website | text | nullable | |
| created_at / updated_at | timestamptz | default now() | distribuir entre 2026-04-01 e 2026-05-02 |

**Sem FKs.** Sem RLS (single-tenant).

### 2.2 `clients_people` — contatos
**Volume:** 200 pessoas.

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| id | uuid | gen_random_uuid() | ignorar |
| name | text | **NOT NULL** | |
| email | text | nullable | gerar emails plausíveis |
| whatsapp | text | nullable | formato `5511999998888` (sem `+`, sem espaços) — ~80% dos contatos |
| telefone | text | nullable | telefone fixo opcional |
| document | text | nullable | CPF fake |
| address | text | nullable | |
| status | text | nullable | enum-like: `active`/`inactive`/`archived` (verificar uso) — usar `active` para 90%, `archived` para 5%, `inactive` para 5% |
| service_status | text | nullable | enum-like: `open`/`closed`/`in_service` |
| source | text | nullable | livre — ex: `meta_ads`, `google_ads`, `landing_page`, `indicacao`, `prospect_outbound` |
| score | int | nullable | 0–100 |
| score_matrix_id | uuid | FK score_matrix | NULL se score_matrix vazia |
| disc_profile | text | nullable | `D`/`I`/`S`/`C` ou null |
| disc_summary | text | nullable | |
| moment | text | nullable | livre |
| goal | text | nullable | livre |
| income | text | nullable | livre |
| business_category | text | nullable | livre |
| company_description | text | nullable | |
| notes | text | nullable | |
| accepts_calls | bool | nullable | ~70% true |
| ai_enabled | bool | nullable | ~50% true |
| ai_processing_lock | bool | default false | ignorar |
| archived | bool | nullable | 95% false |
| archived_at | timestamptz | nullable | |
| profile_picture | text | nullable | URL avatar opcional |
| q1..q26 | text | nullable | qualificação B2B — preencher uma amostra (q1, q2, q3, q21, q22) para variedade |
| utm/fb/instagram fields | — | nullable | ignorar majoritariamente |
| merge_history | jsonb | default `'[]'`/null | ignorar (`{}` ou `[]`) |
| merged_into_id | uuid | nullable | NULL |
| created_at / updated_at | timestamptz | default | distribuir |

**Distribuição:**
- 200 pessoas com `created_at` espalhado entre 2026-04-01 e 2026-05-02
- 80% com `whatsapp` preenchido
- 60% com `email` preenchido (alguns só whatsapp)
- 50% têm `score` preenchido
- 30% têm respostas de qualificação Q1-Q6

### 2.3 `clients_people_companies` — junction
~70% das pessoas associadas a 1 empresa (`is_primary=true`).

| Coluna | Notas |
|---|---|
| people_id | FK |
| company_id | FK |
| is_primary | bool |
| role | text — "CEO", "Diretor de Marketing", "Gerente de Vendas", etc. |

### 2.4 `leads` — negócios/oportunidades
**Volume:** 200 leads (1 por pessoa, na média).

**Distribuição de status (alvo do briefing):**
| Status | Qtd | % |
|---|---|---|
| `won` (fechado/ganho) | **30** | 15% |
| `lost` (perdido) | 50 | 25% |
| `in_progress` (em andamento) | 120 | 60% |

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| id | uuid | gen_random_uuid() | ignorar |
| status | text | **NOT NULL** default `in_progress` | enum-like: `in_progress` / `won` / `lost` |
| people_id | uuid | FK clients_people | obrigatório no domínio |
| company_id | uuid | FK clients_companies | nullable |
| leads_pipelines_id | uuid | FK leads_pipelines | obrigatório |
| leads_stages_id | uuid | FK leads_stages | obrigatório (stage atual) |
| leads_loss_reasons_id | uuid | FK leads_loss_reasons | apenas se `status='lost'` |
| user_id | uuid | FK settings_users | responsável |
| teams_id | uuid | FK settings_teams | nullable |
| title | text | nullable | usar "Oportunidade — {company.trade_name}" |
| description | text | nullable | |
| value | numeric | nullable | R$ — gerar valores entre 1 500 e 80 000 (média ~12 000) |
| close_probability | int | nullable | 0–100 — só faz sentido para in_progress |
| pre_sale_temperature | int | nullable | 1–5 |
| lifecycle_stage | text | nullable | livre — ex: `mql`, `sql`, `customer` |
| lead_source | text | nullable | mesma lista de `clients_people.source` |
| utm_source / utm_medium / utm_campaign / utm_content / utm_term | text | nullable | distribuir: 40% meta, 20% google, 10% tiktok, 10% organico, 20% indicacao/lp |
| fb_lead_id / fbp / fbc / fbclid | text | nullable | preencher para leads vindos do Meta |
| gclid | text | nullable | preencher para leads vindos do Google |
| won_at | timestamptz | nullable | obrigatório se `status='won'` |
| lost_at | timestamptz | nullable | obrigatório se `status='lost'` |
| loss_reason | text | nullable | redundante a leads_loss_reasons_id — preencher textual também |
| last_interaction_at | timestamptz | nullable | usar created_at + alguns dias |
| archived | bool | nullable | false |
| archived_at | timestamptz | nullable | NULL |
| control | text | nullable | ignorar |
| created_at / updated_at | timestamptz | default | distribuir, **anteriores** a won_at/lost_at |

**Regras de coerência:**
- Para 30 leads `won`: `won_at` ∈ janela, `leads_stages_id` = stage "Fechado", `value` preenchido (somatório alvo: ~R$ 360 000 em vendas).
- Para 50 leads `lost`: `lost_at` ∈ janela, `leads_loss_reasons_id` preenchido, `value` opcional, `leads_stages_id` = qualquer (podem ter perdido em qualquer etapa).
- Para 120 `in_progress`: distribuir entre stages 0–4 com peso maior em stages iniciais.

### 2.5 `leads_updates` — histórico de stage
Para cada lead que avançou, criar 1–4 registros de `leads_updates` (from_stage_id → to_stage_id) com `user_id` do responsável.

| Coluna | Notas |
|---|---|
| lead_id | FK |
| from_stage_id / to_stage_id | uuid — null se primeiro registro |
| user_id | FK settings_users |
| notes | nullable |
| created_at | timestamptz — distribuído |

**Volume:** ~3 atualizações por lead avançado = ~600 registros total.

### 2.6 `leads_notes`
**Volume:** ~80 notas distribuídas em leads-chave (won + alguns in_progress).

| Coluna | Notas |
|---|---|
| lead_id | FK |
| user_id | FK |
| title | nullable |
| content | text — anotações simples ("Cliente pediu retornar amanhã", etc.) |

### 2.7 `meetings` — reuniões agendadas
**Volume:** 60 reuniões. Distribuição por status:
- `realizado` / `compareceu`: 40
- `agendado` (futuro): 8
- `nao_compareceu` / `no_show`: 6
- `cancelado`: 6

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| id | uuid | default | ignorar |
| title | text | **NOT NULL** | "Discovery — {empresa}" / "Demo — {empresa}" / "Fechamento — {empresa}" |
| start_time | timestamptz | **NOT NULL** | distribuir entre 2026-04-01 e 2026-05-09 (incluir 8 futuras) |
| end_time | timestamptz | **NOT NULL** | start_time + 30/45/60 min |
| lead_id | uuid | FK leads | obrigatório |
| people_id | uuid | FK clients_people | obrigatório (mesmo do lead) |
| user_id | uuid | FK settings_users | responsável |
| teams_id | uuid | FK | nullable |
| status | text | nullable | valores ver `src/types/meeting.ts`: `agendado`, `compareceu`, `nao_compareceu`, `cancelado`, `realizado` |
| meeting_type | text | nullable | enum-like livre: `discovery`, `demo`, `closing`, `consulting`, `mentoring`, `qbr`, `followup`, `other` |
| meeting_link | text | nullable | URL fake meet.google.com/abc-defg-hij |
| location | text | nullable | "Online (Google Meet)" / "Online (Zoom)" |
| outcome | text | nullable | livre — só para realizado/compareceu |
| description | text | nullable | |
| notes | text | nullable | preencher para realizado |
| source | text | nullable | `manual` / `google` / `tldv` |
| google_event_id / zoom_meeting_id / ms_meeting_id / zoom_join_url | — | nullable | NULL na maioria — preencher 1–2 com mock para variedade |
| google_last_synced_at | timestamptz | nullable | |
| gcal_sync_error / zoom_sync_error | text | nullable | NULL |
| attendee_emails | text[] | nullable | array com emails do user e do contato |
| created_at / updated_at | timestamptz | default | |

### 2.8 `messages` — mensagens (conversas)
**Volume:** ~1 200 mensagens, distribuídas em ~80 leads (média 15 msgs por conversa, com algumas conversas curtas e outras longas).

> ⚠️ **`messages.id` é `bigint` (serial / `messages_id_seq`)** — NÃO inserir `id`, deixar autoincrement. Importante para evitar quebrar a sequence.

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| id | bigint | sequence | **ignorar** (auto) |
| content | text | **NOT NULL** | corpo da msg |
| people_id | uuid | FK clients_people | obrigatório no domínio |
| lead_id | uuid | FK leads | obrigatório quando vinculada a um deal (a maioria) |
| user_id | uuid | FK settings_users | preenchido quando `from_contact='humano'` |
| channel | text | nullable | enum-like: `whatsapp`, `instagram`, `email`, `sms`, `telefone`, `tldv` — usar `whatsapp` para 80%, `instagram` 10%, `email` 10% |
| from_contact | text | nullable | enum-like: `cliente`, `humano`, `agente_ia`, `follow_up` — alternar para criar conversação realista |
| message_type | text | nullable | `texto`, `audio`, `imagem`, `video`, `documento`, `chamada`, `private_reply`, `email`. Maioria `texto`. |
| status | text | nullable | enum-like: `pending`, `sending`, `sent`, `delivered`, `read`, `error`. Para histórico, usar `delivered` / `read` em outbound; inbound em geral `delivered`. |
| sent_at | timestamptz | nullable | preencher para outbound enviadas |
| delivered_at | timestamptz | nullable | sent_at + 1–10s |
| read_at | timestamptz | nullable | delivered_at + 1–60min |
| wa_message_id | text | nullable | mock `wamid.HBgL...` — preencher para outbound whatsapp |
| ig_message_id | text | nullable | apenas channel=instagram |
| wa_phone_number_id | text | nullable | id do canal WA configurado |
| metadata | jsonb | nullable | NULL ou `{}` |
| media_url / media_metadata | — | nullable | NULL para `texto` |
| post_id / instagram_interaction_type | — | nullable | NULL |
| source_type | text | nullable | livre |
| module_ref_id | text | nullable | NULL |
| parent_message_id | bigint | nullable | NULL |
| execution_id | uuid | FK ai_agents_execution_log | NULL |
| followup_id | uuid | FK leads_stages_followups | NULL |
| whatsapp_template_id | uuid | FK whatsapp_templates | preencher quando msg disparada por template |
| created_at / updated_at | timestamptz | default | distribuir cronologicamente — **dentro da janela do lead** |

**Padrão de conversa realista:**
- Inbound do cliente (`from_contact='cliente'`)
- Outbound do humano ou IA (`from_contact='humano'`/`'agente_ia'`)
- 6 a 30 mensagens por lead com conversa
- ~80 leads com conversa = 50+ "atendimentos" do briefing satisfeitos com folga

### 2.9 `sends` — campanhas de disparo
**Volume:** 6 campanhas (3 completed, 1 running, 1 scheduled, 1 draft).

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| id | uuid | default | ignorar |
| name | text | **NOT NULL** | "Disparo Welcome Maio", "Reativação Q2", etc. |
| description | text | nullable | |
| type | text | NOT NULL default 'imported' | `imported` / `filtered` |
| channel | text | NOT NULL default 'whatsapp' | `whatsapp` (todas) ou alguns `email` |
| status | text | nullable | enum: `draft`/`scheduled`/`running`/`completed`/`paused`/`failed` |
| template_id | text | nullable | UUID de whatsapp_templates **gravado como text** |
| pipeline_id | uuid | FK leads_pipelines | nullable |
| stage_ids | text[] | nullable | array de UUIDs de stages — usado quando type=filtered |
| wa_channel_id | uuid | FK settings_whatsapp_channels | nullable — preencher se canal WA existir |
| webhook_id | uuid | FK | NULL |
| message_content | text | nullable | NULL para WhatsApp template; preencher para email/sms |
| filter_config | jsonb | nullable | NULL ou objeto SendFilters |
| scheduled_at / started_at / completed_at | timestamptz | nullable | conforme status |
| send_interval_seconds | int | NOT NULL default 5 | 5–30 |
| total_contacts | int | nullable | 50–500 |
| sent_count / delivered_count / read_count / failed_count / error_count | int | nullable | coerentes com total_contacts |
| created_by | uuid | FK settings_users | |
| created_at / updated_at | timestamptz | default | |

### 2.10 `sends_contacts`
Para cada `sends.completed`, criar `total_contacts` registros referenciando `clients_people` reais.

| Coluna | Notas |
|---|---|
| send_id | FK |
| people_id | FK clients_people |
| whatsapp | text — copiar de people.whatsapp |
| status | enum: `pending`/`sent`/`delivered`/`read`/`failed`/`invalid` |
| error_message | nullable |
| retry_count | 0 |
| sent_at / delivered_at / read_at | conforme status |

**Atenção volume:** se total_contacts=500 × 6 sends, são 3000 sends_contacts — ok mas considerar capping em 200 por send para evitar bloat.

### 2.11 `bi_ad_campaigns` — campanhas de anúncios
**Volume:** 6 campanhas (2 Meta, 2 Google, 1 TikTok, 1 paused).

| Coluna | Tipo | Obrigatória? | Notas |
|---|---|---|---|
| account_id | uuid | FK bi_ad_accounts | obrigatório |
| ad_account_id | uuid | FK bi_ad_accounts | mesmo que account_id (compat) |
| campaign_id | text | **NOT NULL** | id externo da plataforma — fake (`23857234982374` etc) |
| campaign_name | text | nullable | "Awareness Q2 — Meta", "Search João Guirunas Brand", etc. |
| platform | text | nullable | `meta` / `google` / `tiktok` |
| objective | text | nullable | `LEAD_GENERATION`, `CONVERSIONS`, `TRAFFIC`, etc. |
| status | text | nullable | `ACTIVE` / `PAUSED` |
| date_start / date_end | date | nullable | janela de 30 dias |
| utm_campaign | text | nullable | corresponder ao utm dos leads |
| spend | numeric | nullable | total da campanha |
| revenue | numeric | nullable | atribuído |
| impressions / clicks / conversions | int | nullable | métricas agregadas |
| synced_at | timestamptz | default now() | |

### 2.12 `bi_ad_daily_stats` — métricas diárias
Para cada campanha ativa, gerar 30 dias de stats.

| Coluna | Notas |
|---|---|
| campaign_id | FK bi_ad_campaigns |
| stat_date | date — 1 por dia da janela |
| impressions / clicks / conversions / spend / revenue | numéricos coerentes (ratio CTR ~2%, conversão ~5%) |

**Volume:** 6 campanhas × 30 dias = 180 registros.

### 2.13 `bi_ad_spend` — gasto diário (legado/paralelo)
| Coluna | Notas |
|---|---|
| ad_account_id | FK bi_ad_accounts |
| campaign_id | FK bi_ad_campaigns (nullable) |
| platform | "meta"/"google"/"tiktok" |
| date | date |
| spend | numeric NOT NULL default 0 |
| currency | text default 'BRL' |
| impressions / clicks / leads | int |
| source | text — "manual_import" / "api" |
| raw_data | jsonb — NULL ou `{}` |

> Decidir entre usar `bi_ad_daily_stats` OU `bi_ad_spend` — ambos coexistem. Olhar qual o **dashboard atual** (BI PRO) consome. Se ambos, popular ambos com mesma fonte para coerência. **Pendência de decisão:** team-lead deve confirmar qual o canônico para o dashboard.

---

## 3 — Tabelas que NÃO precisam ser populadas

Tabelas que ficam vazias / não são necessárias para a apresentação comercial:

| Tabela | Razão |
|---|---|
| `crm_*` (legado) | substituído pelo schema moderno |
| `prospect_*` | módulo Prospect PRO — opcional, fora do escopo |
| `lp_*` (lp_forms, lp_pages, lp_submissions) | landing pages — pode mockar 1–2 forms se demo incluir, senão ignorar |
| `meta_lead_form_pages`, `meta_lead_forms` | igual lp — opcional |
| `meeting_records`, `meeting_evaluations` | CoachPRO — opcional |
| `playbooks`, `playbook_*` | CoachPRO — opcional |
| `call_pro_*` | Call PRO — opcional |
| `ai_agents`, `ai_agents_*` | configuração de agentes IA — não precisa para a demo de dados |
| `score_matrix`, `score_*` | Score PRO — pode ficar com 1 entry default ou vazio |
| `omni_*` | configurações de canal — pode estar vazio |
| `bi_settings`, `_app_config` | configs sistema — não tocar |
| `secret_access_log`, `booking_token_jti_usage`, `action_token_consumed` | auditoria — não tocar |
| `crm_security_audit_log` | auditoria — não tocar |
| `data_deletion_requests` | LGPD — vazia |
| `n8n_chat_histories`, `msg_buffer`, `message_buffer` | runtime/buffer — vazias |
| `whatsapp_templates` | já configurado em 1.6 (lookup) |

---

## 4 — Campos que devem ser ignorados em INSERTs

Em todas as tabelas, **ignorar (deixar default)** estes campos:

- `id` (uuid PK ou bigint sequence)
- `created_at`, `updated_at` — exceto quando precisamos forçar valor histórico (ver §5)
- `*_processing_lock` (booleans default false)
- `merge_history` (jsonb default `{}` ou `[]`)
- Campos `*_sync_*` que não façam parte do mock
- `auth_user_id` em settings_users (manter NULL para usuários demo)

---

## 5 — Forçar `created_at` histórico

Para que o histórico apareça na UI / BI, **precisamos** sobrescrever `created_at` em vez de usar default. Isso é permitido (todas as colunas `created_at` são `nullable` ou `default now()`, mas aceitam INSERT explícito).

**Regra:** sempre passar `created_at` no INSERT distribuído na janela 2026-04-01 → 2026-05-02 com pesos:
- 30% nas últimas 7 dias (mais densidade recente)
- 40% nos 8–21 dias atrás
- 30% nos 22–32 dias atrás

Curva sugerida (valores absolutos por dia para 200 leads):
- 2026-04-01..07: 5 leads/dia (35 total)
- 2026-04-08..14: 6 leads/dia (42 total)
- 2026-04-15..21: 7 leads/dia (49 total)
- 2026-04-22..28: 8 leads/dia (56 total)
- 2026-04-29..05-02: 4–5 leads/dia (18 total)

Para `won_at` / `lost_at`: desfasar do `created_at` em 3–25 dias (ciclo de venda).

---

## 6 — Resumo de volumes finais

| Tabela | Registros |
|---|---|
| settings_users | 4–6 (incluir os já existentes) |
| settings_teams | 2 |
| settings_users_teams | ~6 |
| leads_pipelines | 1 |
| leads_stages | 6 |
| leads_loss_reasons | 6 |
| whatsapp_templates | 3–5 |
| bi_ad_accounts | 3 |
| clients_companies | 60–80 |
| clients_people | 200 |
| clients_people_companies | ~140 |
| **leads** | **200 (30 won + 50 lost + 120 in_progress)** |
| leads_updates | ~600 |
| leads_notes | ~80 |
| **meetings** | **60** |
| **messages** | **~1 200** |
| **sends** | **6** |
| sends_contacts | ~600 (capando 100/send) |
| bi_ad_campaigns | 6 |
| bi_ad_daily_stats | ~180 |
| bi_ad_spend | ~180 |

**Total aproximado:** ~3 600 registros — leve, rápido de inserir, sem risco de bloat.

---

## 7 — Pontos de decisão pendentes (para team-lead)

1. **`bi_ad_daily_stats` vs `bi_ad_spend`** — qual é canônico para o dashboard BI PRO atual? Se ambos, popular os dois.
2. **`whatsapp_templates`** — já existe template configurado em João Guirunas? Se sim, reusar IDs reais; se não, criar fakes.
3. **`settings_whatsapp_channels`** — já configurado? `sends.wa_channel_id` precisa de canal real ou pode ser NULL.
4. **`settings_users` existentes** — já existe usuário ativo (joao@growthsales.ai). Confirmar quantos demais criar como SDR/closer fakes (sugestão: 4 fakes + 1 real).
5. **`user_type` enum em settings_users** — confirmar valores canônicos pós-migration `20260502120000_user_types_canonical_refactor.sql` (ler arquivo antes de inserir).
6. **`lifecycle_stage` em leads** — quais valores aceitos? Default `mql`/`sql`/`customer`?
7. **`messages.id` é serial bigint** — confirmar `messages_id_seq` está no estado correto (não inserir id manualmente para não quebrar sequence).
8. **Storage / arquivos** — `leads_files` aponta para Supabase Storage; precisa de buckets configurados? Sugestão: ignorar `leads_files` na simulação inicial.
9. **`prospect_campaigns`** — incluir 1–2 campanhas de prospecção fake para mostrar Prospect PRO? Ou fora do escopo?
10. **Contagem de "atendimentos"** — briefing pede 50 atendimentos. Definir: 1 atendimento = 1 lead com conversa multi-turn (>= 3 messages)? Sugiro essa definição.

---

## 8 — Plano de execução

1. **Pré-flight (Bythak prepara, team-lead executa via MCP):**
   ```sql
   SELECT count(*) FROM settings_users WHERE deleted_at IS NULL;
   SELECT id, name FROM leads_pipelines WHERE active = true;
   SELECT count(*) FROM leads_stages;
   SELECT count(*) FROM whatsapp_templates;
   SELECT count(*) FROM clients_people;
   SELECT count(*) FROM leads;
   ```
   → Confirmar volumes existentes e decidir se inserir do zero ou complementar.

2. **Lookup tables (lote 1):** settings_users, settings_teams, settings_users_teams, leads_pipelines, leads_stages, leads_loss_reasons, whatsapp_templates, bi_ad_accounts.

3. **Domain layer 1 (lote 2):** clients_companies (60–80) → clients_people (200) → clients_people_companies (140).

4. **Domain layer 2 (lote 3):** leads (200) com referência aos people/companies/pipeline/stages/users.

5. **Histórico (lote 4):** leads_updates, leads_notes.

6. **Engagement (lote 5):** meetings (60) → messages (1200, em batches de 100).

7. **Campanhas (lote 6):** sends (6) → sends_contacts (600) → bi_ad_campaigns (6) → bi_ad_daily_stats (180) → bi_ad_spend (180).

8. **Pós-validação (Bythak prepara queries, team-lead executa):**
   ```sql
   -- Verificações de coerência
   SELECT status, count(*), sum(value) FROM leads GROUP BY status;
   SELECT count(DISTINCT lead_id) FROM messages;
   SELECT status, count(*) FROM meetings GROUP BY status;
   SELECT name, status, sent_count, total_contacts FROM sends;
   SELECT platform, sum(spend), sum(impressions), sum(conversions) FROM bi_ad_daily_stats GROUP BY platform;
   ```

9. **Rollback strategy (se algo sair errado):**
   Como tudo é INSERT puro, rollback = `DELETE` por janela de `created_at` ou por marker.
   **Sugestão:** anexar marker em `description` / `notes` (ex: `[DEMO_SEED_2026-05-02]`) para rollback fácil. Aplicar em pelo menos `clients_people.notes`, `clients_companies.legal_name`, `leads.description`, `meetings.description`, `sends.description`.

---

## 9 — Riscos e mitigações

| Risco | Mitigação |
|---|---|
| FKs quebradas (referência antes do insert) | Seguir ordem do §2 estritamente; validar count antes de cada lote |
| `messages_id_seq` corrompido | NUNCA inserir `id` manualmente; usar default |
| `whatsapp_templates.slug` UNIQUE conflito | Verificar slugs existentes antes de inserir |
| Volume alto em `messages` (1 200) | Inserir em batches de 100, transação por batch |
| Métricas de campanha incoerentes (sends_count > total) | Calcular ratios fixos (delivered ~95% do sent, read ~70% do delivered) |
| Triggers `updated_at` interferirem | OK — eles só atualizam o updated_at, não bloqueiam |
| RLS bloqueando insert via REST | Bythak não executa direto; team-lead via MCP usa service_role → RLS bypass |
| Dados ficarem isolados (lead sem msg/meeting) | Garantir que ao menos 80 dos 200 leads tenham messages e 60 tenham meetings (overlap aceito) |

---

## 10 — Arquivos relacionados / próximos passos

- Próximo: gerar **scripts SQL de seed** organizados por lote — sugerir local: `supabase/seeds/demo-2026-05-02/` (criar diretório).
- Cada arquivo = 1 lote (ex: `01_lookups.sql`, `02_companies_people.sql`, `03_leads.sql`, `04_history.sql`, `05_engagement.sql`, `06_campaigns.sql`).
- Cada arquivo deve ser **idempotente** se possível (usar `ON CONFLICT DO NOTHING` em UNIQUE keys, mas a maioria dos PKs é uuid gen_random_uuid → aceitar não-idempotência e usar marker para rollback).
- Confirmar com team-lead os 10 pontos de decisão pendentes antes de iniciar a geração.
