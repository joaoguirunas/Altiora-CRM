# Mapeamento do Banco de Dados — Altiora CRM

> Gerado em: 2026-07-25  
> Fonte: `supabase/baseline.sql` + migrations  
> Schema principal: `public`  
> Nenhuma alteração foi feita no banco.

---

## Índice de Módulos

1. [Settings (Configurações)](#1-settings-configurações)
2. [Clients (Pessoas e Empresas)](#2-clients-pessoas-e-empresas)
3. [Pipeline CRM (Leads)](#3-pipeline-crm-leads)
4. [Reuniões](#4-reuniões)
5. [Mensagens e Comunicação](#5-mensagens-e-comunicação)
6. [Score](#6-score)
7. [Disparos (Sends)](#7-disparos-sends)
8. [Webhooks](#8-webhooks)
9. [Agentes IA](#9-agentes-ia)
10. [LP PRO (Landing Pages)](#10-lp-pro-landing-pages)
11. [Call PRO](#11-call-pro)
12. [BI PRO](#12-bi-pro)
13. [OMNI PRO](#13-omni-pro)
14. [Booking / Schedule PRO](#14-booking--schedule-pro)
15. [Prospecção](#15-prospecção)
16. [Instagram Automations](#16-instagram-automations)
17. [Conversões](#17-conversões)
18. [ElevenLabs / Voice](#18-elevenlabs--voice)
19. [Projetos e Processos](#19-projetos-e-processos)
20. [Form PRO](#20-form-pro)
21. [Meta Lead Forms](#21-meta-lead-forms)
22. [Admin (ADM)](#22-admin-adm)
23. [Outros / Internos](#23-outros--internos)

---

## 1. Settings (Configurações)

### `settings`
Configuração global da conta.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| company_name | text NOT NULL | |
| logo_url | text | |
| primary_color | text | default '#6366f1' |
| secondary_color | text | default '#8b5cf6' |
| accent_color | text | default '#ec4899' |
| email | text | |
| phone | text | |
| website | text | |
| address | text | |
| tax_id | text | |
| timezone | text | default 'America/Sao_Paulo' |
| language | text | default 'pt-br' |
| currency | text | default 'BRL' |
| whatsapp_provider | text | default 'whatsapp-oficial' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_users`
Usuários / membros da equipe.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| auth_user_id | uuid UNIQUE | FK → auth.users |
| name | text NOT NULL | |
| email | text NOT NULL | |
| phone | text | |
| avatar_url | text | |
| user_type | text | default 'atendente' |
| super_admin | boolean | default false |
| active | boolean | default true |
| deleted_at | timestamptz | soft delete |
| deleted_by | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_teams`
Times / departamentos.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| team_type | text | default 'vendas' |
| priority | integer | default 0 |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_users_teams`
Relação N:N usuário ↔ time.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → settings_users |
| team_id | uuid | FK → settings_teams |
| is_leader | boolean | default false |
| created_at | timestamptz | |
| — | UNIQUE(user_id, team_id) | |

---

### `settings_schedules`
Horários de disponibilidade por usuário.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → settings_users |
| day_of_week | integer | 0=Dom … 6=Sáb |
| start_time | time NOT NULL | |
| end_time | time NOT NULL | |
| is_available | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_system_modules`
Módulos do sistema habilitados.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| module_key | text UNIQUE NOT NULL | ex: 'dashboard', 'conversas' |
| module_name | text NOT NULL | ex: 'BI PRO™' |
| icon | text | nome do ícone Lucide |
| ordem | integer NOT NULL | |
| ativo | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_ai_providers`
Chaves de API dos provedores de IA.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| provider | text NOT NULL | openai \| anthropic \| groq \| gemini |
| label | text NOT NULL | ex: 'OpenAI Produção' |
| api_key | text NOT NULL | nunca exposta ao frontend |
| is_default | boolean | default false |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_whatsapp_channels`
Canais WhatsApp Business cadastrados.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| label | text NOT NULL | |
| phone_number_id | text UNIQUE NOT NULL | Meta WA phone_number_id |
| access_token | text NOT NULL | Meta Graph API token |
| app_secret | text | validação HMAC de webhooks |
| is_default | boolean | default false |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `settings_omni_new_contact`
Config de criação automática de negócio ao receber mensagem de novo contato.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| channel | text NOT NULL | whatsapp \| email \| instagram_dm \| instagram_comment |
| auto_create_negocio | boolean | default false |
| pipeline_id | uuid | FK → leads_pipelines |
| stage_id | uuid | FK → leads_stages |
| title_template | text | default 'Nova conversa - {{nome}}' |
| updated_at | timestamptz | |
| — | UNIQUE(channel) | |

---

## 2. Clients (Pessoas e Empresas)

### `clients_people`
Pessoas / contatos do CRM.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| email | text | |
| whatsapp | text | |
| instagram_user_id | text | Instagram DM |
| document | text | CPF/CNPJ |
| type | text | |
| notes | text | |
| status | text | default 'ativo' |
| service_status | text | |
| source | text | origem do contato |
| accepts_calls | boolean | default true |
| ai_enabled | boolean | default false |
| ai_last_message_at | timestamptz | debounce de mensagens |
| ai_processing_lock | boolean | default false — lock de execução IA |
| archived | boolean | default false |
| archived_at | timestamptz | |
| score | integer | |
| score_matrix_id | uuid | FK → score_matrix |
| score_framing_id | uuid | FK → score_framings |
| score_investment_id | uuid | FK → score_investments |
| score_objective_id | uuid | FK → score_objectives |
| income | text | renda |
| moment | text | momento de vida |
| goal | text | objetivo |
| disc_profile | text | perfil DISC |
| disc_summary | text | resumo DISC |
| conversation_summary | text | resumo de conversa IA |
| q1_age … q13_household_income | variados | campos de qualificação |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `clients_people_updates`
Histórico de alterações em pessoas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| people_id | uuid | FK → clients_people |
| user_id | uuid | FK → settings_users |
| field_name | text NOT NULL | campo alterado |
| old_value | text | |
| new_value | text | |
| created_at | timestamptz | |

---

### `clients_companies`
Empresas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| trade_name | text NOT NULL | nome fantasia |
| legal_name | text | razão social |
| tax_id | text | CNPJ |
| email | text | |
| phone | text | |
| website | text | |
| address | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `clients_people_companies`
Relação N:N pessoa ↔ empresa.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| people_id | uuid | FK → clients_people |
| company_id | uuid | FK → clients_companies |
| role | text | cargo |
| is_primary | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| — | UNIQUE(people_id, company_id) | |

---

## 3. Pipeline CRM (Leads)

### `leads_pipelines`
Pipelines de vendas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `leads_stages`
Etapas de um pipeline.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| leads_pipelines_id | uuid | FK → leads_pipelines |
| name | text NOT NULL | |
| color | text | |
| order_index | integer | default 0 |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `leads_stages_followups`
Follow-ups automáticos configurados por etapa.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| stage_id | uuid | FK → leads_stages |
| name | text NOT NULL | |
| message | text NOT NULL | |
| delay_minutes | integer | default 60 |
| whatsapp_template_id | text | |
| score_matrix_id | uuid | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `leads_loss_reasons`
Motivos de perda de negócio.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `leads`
Negócios / oportunidades de venda.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| title | text | |
| description | text | |
| control | text | |
| value | numeric | default 0 |
| status | text | default 'em-andamento' |
| people_id | uuid | FK → clients_people |
| companies_id | uuid | FK → clients_companies |
| leads_pipelines_id | uuid | FK → leads_pipelines |
| leads_stages_id | uuid | FK → leads_stages |
| leads_loss_reasons_id | uuid | FK → leads_loss_reasons |
| loss_reason | text | texto livre de perda |
| teams_id | uuid | FK → settings_teams |
| users_id | uuid | FK → settings_users |
| archived | boolean | default false |
| archived_at | timestamptz | |
| won_at | timestamptz | |
| lost_at | timestamptz | |
| last_interaction_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `leads_notes`
Notas anexadas a negócios.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| leads_id | uuid | FK → leads |
| users_id | uuid | FK → settings_users |
| title | text | |
| content | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `leads_files`
Arquivos anexados a negócios.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| leads_id | uuid | FK → leads |
| users_id | uuid | FK → settings_users |
| file_name | text NOT NULL | |
| file_url | text NOT NULL | |
| file_type | text | |
| file_size | bigint | |
| created_at | timestamptz | |

---

### `leads_updates`
Histórico de movimentação entre etapas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| leads_id | uuid | FK → leads |
| users_id | uuid | FK → settings_users |
| from_stage_id | uuid | FK → leads_stages |
| to_stage_id | uuid | FK → leads_stages |
| notes | text | |
| created_at | timestamptz | |

---

### `lead_field_definitions`
Definições de campos personalizados por pipeline.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| key | text NOT NULL | snake_case |
| type | text NOT NULL | text \| number \| single_select \| boolean \| date |
| category | text NOT NULL | qualificacao \| outros |
| pipeline_id | uuid | FK → leads_pipelines (NULL = global) |
| options | jsonb | [{label, value}] para single_select |
| required | boolean | default false |
| active | boolean | default true |
| ordem | integer | default 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `lead_field_values`
Valores de campos personalizados por negócio.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid | FK → leads |
| field_definition_id | uuid | FK → lead_field_definitions |
| value_text | text | |
| value_number | numeric | |
| value_boolean | boolean | |
| value_date | date | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| — | UNIQUE(lead_id, field_definition_id) | |

---

## 4. Reuniões

### `meetings`
Reuniões agendadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| title | text NOT NULL | |
| description | text | |
| location | text | |
| meeting_link | text | |
| notes | text | |
| status | text | default 'agendada' |
| start_time | timestamptz NOT NULL | |
| end_time | timestamptz NOT NULL | |
| people_id | uuid | FK → clients_people |
| leads_id | uuid | FK → leads |
| users_id | uuid | FK → settings_users |
| teams_id | uuid | FK → settings_teams |
| google_event_id | text | Google Calendar event ID |
| google_last_synced_at | timestamptz | |
| source | text | 'google' ou null |
| outcome | text | venda \| follow_up \| sem_interesse \| reagendada \| nao_compareceu |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `meeting_records`
Artefatos de reunião (gravações, transcrições, resumos, análise IA).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| meeting_id | uuid NOT NULL | FK → meetings |
| record_type | text NOT NULL | recording \| transcript \| summary \| ai_summary \| ai_analysis \| note |
| source | text | loom \| google_meet \| zoom \| fireflies \| fathom \| manual \| ai |
| url | text | URL do vídeo/gravação |
| duration_seconds | integer | |
| thumbnail_url | text | |
| title | text | |
| content | text | texto principal |
| content_format | text | text \| markdown \| html \| json |
| ai_sentiment | text | positivo \| neutro \| negativo \| misto |
| ai_score | integer | 0–100 |
| ai_key_topics | text[] | tópicos identificados |
| ai_next_steps | text[] | próximos passos |
| ai_objections | text[] | objeções levantadas |
| ai_metadata | jsonb | dados brutos da IA |
| recorded_at | timestamptz | |
| created_by | uuid | FK → settings_users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `meetings_followups`
Regras de follow-up pós-reunião.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| message | text NOT NULL | |
| delay_minutes | integer | |
| whatsapp_template_id | text | |
| active | boolean | |
| (+ campos de condição e agendamento) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `meeting_followup_queue`
Fila de entrega de follow-ups de reunião.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| meeting_id | uuid | FK → meetings |
| followup_id | uuid | FK → meetings_followups |
| people_id | uuid | FK → clients_people |
| scheduled_at | timestamptz | |
| sent_at | timestamptz | |
| status | text | |
| (+ campos de tracking) | | |
| created_at | timestamptz | |

---

## 5. Mensagens e Comunicação

### `messages`
Todas as mensagens trocadas (WhatsApp, Instagram, etc.).

| Coluna | Tipo | Observações |
|---|---|---|
| id | bigserial PK | |
| content | text NOT NULL | |
| from_contact | text | cliente \| ia \| humano \| sistema |
| message_type | text | texto \| audio \| imagem \| video \| documento \| chamada \| comentario \| story_reply \| story_mention \| reply_comentario \| arquivo |
| status | text | default 'pendente' |
| channel | text | whatsapp \| instagram \| email \| sms \| telefone |
| media_url | text | |
| whatsapp_template_id | text | |
| followup_id | uuid | FK → leads_stages_followups |
| people_id | uuid | FK → clients_people |
| leads_id | uuid | FK → leads |
| users_id | uuid | FK → settings_users |
| wa_message_id | text | Meta WA message ID (deduplicação) |
| wa_phone_number_id | text | canal WA que recebeu |
| execution_id | uuid | FK → ai_agents_execution_log |
| source_type | text | manual \| followup \| appointment_reminder \| campaign \| form |
| metadata | jsonb | dados adicionais |
| sent_at | timestamptz | |
| delivered_at | timestamptz | |
| read_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `message_buffer`
Buffer de debounce para mensagens inbound (substitui Redis).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| people_id | uuid NOT NULL | FK → clients_people |
| messages | jsonb[] | array de {content, message_type, media_url, wa_message_id} |
| wa_phone_number_id | text | canal WA de origem |
| expires_at | timestamptz NOT NULL | created_at + buffer_ms do agente |
| processed | boolean | default false |
| processed_at | timestamptz | |
| created_at | timestamptz | |

---

### `whatsapp_templates`
Templates de mensagem do WhatsApp Business.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| id_template | text NOT NULL | ID na Meta |
| name | text NOT NULL | |
| slug | text NOT NULL | |
| status | text | default 'ativo' |
| system_enabled | boolean | default true |
| json_data | jsonb | dados completos do template |
| variables | jsonb | variáveis do template |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `canned_responses`
Respostas padrão (atalhos de digitação).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| title | text NOT NULL | ex: 'Saudação inicial' |
| shortcut | text | atalho ex: 'ola' |
| content | text NOT NULL | texto da resposta |
| channels | text[] | default ['whatsapp','instagram'] |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `followup_queue`
Fila de entrega de follow-ups de etapa.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| followup_id | uuid | FK → leads_stages_followups |
| leads_id | uuid | FK → leads |
| people_id | uuid | FK → clients_people |
| scheduled_at | timestamptz | |
| sent_at | timestamptz | |
| status | text | |
| created_at | timestamptz | |

---

## 6. Score

### `score_objectives`
Objetivos de qualificação.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| order_index | integer | |
| active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `score_investments`
Faixas de investimento.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| order_index | integer | |
| active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `score_framings`
Enquadramentos de qualificação.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| order_index | integer | |
| active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `score_matrix`
Matriz de score — combinação de objetivo + investimento + enquadramento.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text | |
| score_number | integer NOT NULL | |
| profile_score | text | |
| pre_description_score | text | |
| detail_score | text | |
| objective_id | uuid[] | array de IDs |
| investment_id | uuid[] | array de IDs |
| framing_id | uuid[] | array de IDs |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `score_categories`
Categorias de score customizadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| created_at | timestamptz | |

---

### `score_category_items`
Itens de categorias de score.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| category_id | uuid | FK → score_categories |
| name | text NOT NULL | |
| created_at | timestamptz | |

---

### `score_settings`
Configurações gerais do sistema de score.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| (campos de configuração global) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 7. Disparos (Sends)

### `sends`
Campanhas de disparo em massa.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| template_id | text | ID do template WhatsApp |
| status | text | default 'draft' |
| pipeline_id | uuid | FK → leads_pipelines |
| stage_ids | uuid[] | etapas filtradas |
| team_id | uuid | FK → settings_teams |
| wa_channel_id | uuid | FK → settings_whatsapp_channels |
| created_by | uuid | FK → settings_users |
| total_contacts | integer | |
| sent_count | integer | |
| delivered_count | integer | |
| read_count | integer | |
| error_count | integer | |
| scheduled_at | timestamptz | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `sends_contacts`
Contatos individuais de cada campanha.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| send_id | uuid | FK → sends |
| people_id | uuid | FK → clients_people |
| whatsapp | text NOT NULL | |
| status | text | default 'pending' |
| error_message | text | |
| sent_at | timestamptz | |
| delivered_at | timestamptz | |
| read_at | timestamptz | |
| created_at | timestamptz | |

---

## 8. Webhooks

### `webhooks`
Webhooks de saída configurados.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| url | text NOT NULL | |
| event_type | text NOT NULL | |
| headers | jsonb | |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `webhook_logs`
Logs de execução de webhooks.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| webhook_id | uuid | FK → webhooks |
| request_body | jsonb | |
| response_body | jsonb | |
| status_code | integer | |
| error_message | text | |
| created_at | timestamptz | |

---

### `omni_outbound_webhooks`
Webhooks para entrega de mensagens email/SMS.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| channel | text NOT NULL | email \| sms |
| url | text NOT NULL | |
| method | text | POST \| PUT |
| headers | jsonb | |
| payload_template | text | |
| is_active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 9. Agentes IA

### `ai_agents`
Configuração dos agentes de IA.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| identity | text | identidade/persona |
| input_data | text | dados de entrada |
| general_rules | text | regras gerais |
| pipeline_id | uuid | FK → leads_pipelines |
| score_value | integer | |
| current_version | integer | default 1 |
| use_stages | boolean | default false |
| active | boolean | default true |
| llm_provider_id | uuid | FK → settings_ai_providers |
| wa_channel_id | uuid | FK → settings_whatsapp_channels |
| channel_types | text[] | whatsapp \| instagram \| email \| sms |
| stage_ids | text[] | etapas de atuação |
| (+ campos de voz ElevenLabs) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `ai_agents_history`
Versionamento de agentes.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| ai_agent_id | uuid | FK → ai_agents |
| created_by | uuid | FK → settings_users |
| version | integer NOT NULL | |
| data | jsonb NOT NULL | snapshot completo |
| changelog | jsonb | |
| created_at | timestamptz | |

---

### `ai_agents_steps`
Etapas de um agente IA.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| ai_agent_id | uuid | FK → ai_agents |
| name | text NOT NULL | |
| prompt | text NOT NULL | |
| control | text | |
| order_index | integer NOT NULL | |
| pipeline_id | uuid | FK → leads_pipelines |
| stage_id | uuid | FK → leads_stages |
| active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `ai_agents_steps_history`
Histórico de execução de etapas por lead.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| step_id | uuid | FK → ai_agents_steps |
| leads_id | uuid | FK → leads |
| success | boolean | |
| result | jsonb | |
| error_message | text | |
| executed_at | timestamptz | |

---

### `ai_agents_score_matrix`
Relação agente ↔ matriz de score.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| ai_agent_id | uuid | FK → ai_agents |
| score_matrix_id | uuid | FK → score_matrix |
| active | boolean | default true |
| created_at | timestamptz | |

---

### `ai_agents_execution_log`
Log de execuções de agentes IA.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| ai_agent_id | uuid | FK → ai_agents |
| people_id | uuid | FK → clients_people |
| leads_id | uuid | FK → leads |
| status | text | |
| input | jsonb | |
| output | jsonb | |
| tokens_used | integer | |
| duration_ms | integer | |
| error_message | text | |
| created_at | timestamptz | |

---

## 10. LP PRO (Landing Pages)

### `lp_templates`
Templates globais de landing page.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| category | text NOT NULL | lead_capture \| consultation \| product_demo \| event_registration \| webinar |
| thumbnail_url | text | |
| content | jsonb | estrutura de blocos |
| is_global | boolean | default false |
| created_at | timestamptz | |

---

### `lp_forms`
Formulários de landing page.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| pipeline_id | uuid | FK → leads_pipelines |
| fields | jsonb | [{id, type, label, required, crm_field, …}] |
| settings | jsonb | {submit_text, success_message, redirect_url} |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `lp_pages`
Páginas de landing page.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| slug | text UNIQUE NOT NULL | URL pública |
| template_id | uuid | FK → lp_templates |
| form_id | uuid | FK → lp_forms |
| content | jsonb | {meta, theme, blocks[]} |
| status | text | draft \| published \| archived |
| published_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `lp_submissions`
Submissões de formulários de LP.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| page_id | uuid NOT NULL | FK → lp_pages |
| form_id | uuid NOT NULL | FK → lp_forms |
| lead_id | uuid | FK → leads |
| data | jsonb | valores dos campos |
| utm_source | text | |
| utm_medium | text | |
| utm_campaign | text | |
| utm_content | text | |
| utm_term | text | |
| ip_address | inet | |
| user_agent | text | |
| submitted_at | timestamptz | |

---

### `lp_analytics_events`
Eventos de analytics de página.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| page_id | uuid NOT NULL | FK → lp_pages |
| event_type | text NOT NULL | page_view \| form_view \| form_start \| form_submit |
| session_id | text | |
| referrer | text | |
| user_agent | text | |
| occurred_at | timestamptz | |

---

### `lp_automation_rules`
Regras de automação pós-submissão.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| page_id | uuid | FK → lp_pages |
| name | text NOT NULL | |
| trigger_event | text | default 'on_submission' |
| conditions | jsonb | [{type: score_gte\|tag_contains\|always, value}] |
| actions | jsonb | [{type: send_campaign\|move_stage\|activate_agent\|…}] |
| ativo | boolean | default true |
| created_at | timestamptz | |

---

### `lp_automation_log`
Log de execuções de automações.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| rule_id | uuid | FK → lp_automation_rules |
| submission_id | uuid | FK → lp_submissions |
| status | text | |
| result | jsonb | |
| created_at | timestamptz | |

---

### `lp_page_analytics`
Estatísticas agregadas por página.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| page_id | uuid | FK → lp_pages |
| (métricas agregadas) | | |
| created_at | timestamptz | |

---

### `lp_ab_tests` / `lp_ab_variants` / `lp_ab_sessions` / `lp_ab_conversions`
Testes A/B de landing pages.

| Tabela | Propósito |
|---|---|
| lp_ab_tests | Definição de um teste A/B |
| lp_ab_variants | Variantes (A, B, …) com % de tráfego |
| lp_ab_sessions | Sessões atribuídas a cada variante |
| lp_ab_conversions | Conversões por variante |

---

## 11. Call PRO

### `call_pro_settings`
Configurações do módulo de chamadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| (parâmetros de integração) | | |
| created_at | timestamptz | |

---

### `call_pro_tabulation_categories`
Categorias de tabulação de chamada.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| created_at | timestamptz | |

---

### `call_pro_operator_mappings`
Mapeamento de ramais/operadores.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → settings_users |
| (campos de integração) | | |
| created_at | timestamptz | |

---

### `call_pro_calls`
Registro de chamadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| people_id | uuid | FK → clients_people |
| leads_id | uuid | FK → leads |
| users_id | uuid | FK → settings_users |
| direction | text | inbound \| outbound |
| status | text | |
| duration_seconds | integer | |
| recording_url | text | |
| tabulation_category_id | uuid | |
| outcome | text | |
| (+ campos de metadados da ligação) | | |
| started_at | timestamptz | |
| ended_at | timestamptz | |
| created_at | timestamptz | |

---

### `call_pro_as_queues`
Filas de atendimento de chamadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| (configuração de fila) | | |
| created_at | timestamptz | |

---

## 12. BI PRO

### `bi_ad_accounts`
Contas de anúncios conectadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| platform | text NOT NULL | meta \| google |
| account_id | text NOT NULL | ID na plataforma |
| account_name | text NOT NULL | |
| access_token | text | |
| refresh_token | text | |
| token_expires_at | timestamptz | |
| is_active | boolean | default true |
| last_sync_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| — | UNIQUE(platform, account_id) | |

---

### `bi_ad_campaigns`
Campanhas de anúncios.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| ad_account_id | uuid | FK → bi_ad_accounts |
| platform | text NOT NULL | meta \| google |
| campaign_id | text NOT NULL | ID na plataforma |
| campaign_name | text NOT NULL | |
| status | text | active \| paused \| deleted |
| objective | text | awareness, traffic, leads, … |
| utm_campaign | text | para matching com leads |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| — | UNIQUE(platform, campaign_id) | |

---

### `bi_ad_spend`
Gastos diários por campanha.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| ad_account_id | uuid NOT NULL | FK → bi_ad_accounts |
| campaign_id | uuid | FK → bi_ad_campaigns |
| platform | text NOT NULL | meta \| google |
| date | date NOT NULL | |
| spend | numeric(12,2) NOT NULL | em BRL |
| impressions | integer | |
| clicks | integer | |
| leads | integer | leads registrados pela plataforma |
| currency | text | default 'BRL' |
| raw_data | jsonb | dados brutos da API |
| source | text | api \| csv |
| created_at | timestamptz | |
| — | UNIQUE(campaign_id, date) | |

---

### `bi_settings`
Credenciais OAuth das plataformas de anúncio (singleton).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| meta_app_id | text | |
| meta_app_secret | text | nunca exposto ao frontend |
| google_client_id | text | |
| google_client_secret | text | nunca exposto ao frontend |
| google_developer_token | text | nunca exposto ao frontend |
| singleton | boolean | constraint UNIQUE — garante 1 row |
| updated_at | timestamptz | |

---

### `bi_sdr_targets`
Metas dos SDRs.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → settings_users |
| period | text | mês/ano |
| target_leads | integer | |
| target_meetings | integer | |
| (+ outras metas) | | |
| created_at | timestamptz | |

---

## 13. OMNI PRO

### `omni_channel_configs`
Configurações dos canais OMNI.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| channel | text NOT NULL | |
| (credenciais e config do canal) | | |
| active | boolean | |
| created_at | timestamptz | |

---

### `omni_channel_alerts`
Alertas de SLA e performance por canal.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| channel | text | |
| alert_type | text | |
| (parâmetros de alerta) | | |
| created_at | timestamptz | |

---

### `omni_delivery_dead_letter`
Mensagens com falha permanente de entrega.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| message_id | bigint | FK → messages |
| channel | text | |
| error_payload | jsonb | |
| created_at | timestamptz | |

---

## 14. Booking / Schedule PRO

### `user_calendar_connections`
Conexões Google Calendar por usuário.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid NOT NULL UNIQUE | FK → settings_users |
| google_email | text NOT NULL | |
| google_access_token | text | |
| google_refresh_token | text NOT NULL | |
| google_token_expires_at | timestamptz | |
| google_calendar_id | text | default 'primary' |
| is_active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `booking_rule_sets`
Conjuntos de regras de agendamento.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| (configurações de disponibilidade) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `booking_rules`
Regras individuais de agendamento.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| rule_set_id | uuid | FK → booking_rule_sets |
| day_of_week | integer | |
| start_time | time | |
| end_time | time | |
| active | boolean | |
| created_at | timestamptz | |

---

### `schedule_automations`
Automações de agendamento (disparo de convites, lembretes).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| trigger_type | text | |
| (ações e condições) | | |
| active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## 15. Prospecção

### `prospect_campaigns`
Campanhas de prospecção ativa.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| status | text | |
| pipeline_id | uuid | FK → leads_pipelines |
| stage_id | uuid | FK → leads_stages |
| (filtros de prospecção) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `prospect_contacts`
Contatos encontrados por prospecção.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid | FK → prospect_campaigns |
| name | text | |
| email | text | |
| whatsapp | text | |
| (dados de enriquecimento) | | |
| status | text | |
| created_at | timestamptz | |

---

### `prospect_companies`
Empresas prospectadas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| (dados da empresa) | | |
| created_at | timestamptz | |

---

### `prospect_people_v2`
Pessoas prospectadas com enriquecimento LinkedIn.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text | |
| linkedin_url | text | |
| (25 campos de dados LinkedIn/enriquecidos) | | |
| created_at | timestamptz | |

---

### `prospect_establishments`
Estabelecimentos físicos prospectados.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text | |
| (localização, contatos, dados do estabelecimento) | | |
| created_at | timestamptz | |

---

### `prospect_enrichment_plugins`
Plugins de enriquecimento de dados.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| plugin_type | text | |
| config | jsonb | |
| active | boolean | |
| created_at | timestamptz | |

---

### `prospect_enrichment_results`
Resultados de enriquecimento.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| contact_id | uuid | FK → prospect_contacts |
| plugin_id | uuid | FK → prospect_enrichment_plugins |
| data | jsonb | |
| created_at | timestamptz | |

---

### `prospect_opt_out_registry`
Registro de opt-out (LGPD/GDPR).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| email | text | |
| phone | text | |
| reason | text | |
| created_at | timestamptz | |

---

### `prospect_audit_log`
Log de auditoria de ações de prospecção.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| action | text NOT NULL | |
| actor_id | uuid | FK → settings_users |
| target_type | text | |
| target_id | uuid | |
| metadata | jsonb | |
| created_at | timestamptz | |

---

## 16. Instagram Automations

### `instagram_automations`
Regras de automação para Instagram.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| trigger_type | text | comentario \| story_mention \| dm |
| keyword_filter | text | |
| response_message | text | |
| (condições e ações) | | |
| active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `instagram_automation_log`
Log de execuções de automações Instagram.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| automation_id | uuid | FK → instagram_automations |
| people_id | uuid | FK → clients_people |
| trigger_data | jsonb | |
| result | jsonb | |
| created_at | timestamptz | |

---

## 17. Conversões

### `conversion_platform_credentials`
Credenciais de plataformas de conversão (Meta CAPI, Google, etc.).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| platform | text NOT NULL | |
| credentials | jsonb | |
| active | boolean | |
| created_at | timestamptz | |

---

### `conversion_stage_mappings`
Mapeamento de etapas do pipeline para eventos de conversão.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| stage_id | uuid | FK → leads_stages |
| platform | text | |
| event_name | text | |
| created_at | timestamptz | |

---

### `conversion_events_queue`
Fila de eventos de conversão a enviar.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| leads_id | uuid | FK → leads |
| platform | text | |
| event_name | text | |
| payload | jsonb | |
| status | text | |
| sent_at | timestamptz | |
| created_at | timestamptz | |

---

### `conversion_event_rules`
Regras de envio automático de eventos de conversão.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| trigger_type | text | |
| conditions | jsonb | |
| platform | text | |
| event_name | text | |
| active | boolean | |
| created_at | timestamptz | |

---

## 18. ElevenLabs / Voice

### `settings_elevenlabs`
Configurações da integração ElevenLabs.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| api_key | text | |
| (parâmetros de voz globais) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `elevenlabs_voices`
Vozes cadastradas no ElevenLabs.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| voice_id | text NOT NULL | ID no ElevenLabs |
| name | text NOT NULL | |
| (metadados de voz) | | |
| created_at | timestamptz | |

---

### `elevenlabs_agents`
Agentes de voz ElevenLabs.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| agent_id | text NOT NULL | ID no ElevenLabs |
| name | text NOT NULL | |
| voice_id | uuid | FK → elevenlabs_voices |
| ai_agent_id | uuid | FK → ai_agents |
| (config do agente) | | |
| created_at | timestamptz | |

---

## 19. Projetos e Processos

### `project_teams`
Times de projeto.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| color | text | |
| image_url | text | |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `project_team_members`
Membros de time de projeto.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| team_id | uuid NOT NULL | FK → project_teams |
| user_id | uuid | FK → settings_users |
| role | text | default 'member' |
| created_at | timestamptz | |
| — | UNIQUE(team_id, user_id) | |

---

### `projects`
Projetos.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| accesses | text | |
| client_id | uuid | FK → clients_companies |
| team_id | uuid NOT NULL | FK → project_teams |
| status | text | default 'active' |
| color | text | |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `project_tasks`
Tarefas de projeto.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| project_id | uuid NOT NULL | FK → projects |
| title | text NOT NULL | |
| description | text | |
| status | text | backlog \| sprint \| doing \| done |
| priority | text | default 'medium' |
| assignee_id | uuid | FK → settings_users |
| due_date | date | |
| completed_at | timestamptz | |
| estimated_hours | numeric | |
| time_spent_minutes | integer | default 0 (calculado via trigger) |
| sort_order | integer | default 0 |
| tags | text[] | |
| created_by | uuid | FK → auth.users |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `project_task_subtasks`
Subtarefas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| task_id | uuid NOT NULL | FK → project_tasks |
| title | text NOT NULL | |
| is_completed | boolean | default false |
| time_spent_minutes | integer | default 0 |
| sort_order | integer | default 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `project_task_comments`
Comentários de tarefas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| task_id | uuid NOT NULL | FK → project_tasks |
| user_id | uuid | FK → settings_users |
| content | text NOT NULL | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `project_task_attachments`
Anexos de tarefas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| task_id | uuid NOT NULL | FK → project_tasks |
| file_name | text NOT NULL | |
| file_url | text NOT NULL | |
| file_type | text | |
| created_by | uuid | FK → settings_users |
| created_at | timestamptz | |

---

### `project_documents`
Documentos de projetos.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| project_id | uuid | FK → projects |
| title | text NOT NULL | |
| content | text | |
| (metadados do documento) | | |
| created_at | timestamptz | |

---

### `project_meetings`
Reuniões de projeto.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| project_id | uuid | FK → projects |
| meeting_id | uuid | FK → meetings |
| (campos específicos de reunião de projeto) | | |
| created_at | timestamptz | |

---

### `project_status_updates`
Atualizações de status de projetos.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| project_id | uuid | FK → projects |
| status | text | |
| notes | text | |
| created_by | uuid | |
| created_at | timestamptz | |

---

### Tabelas de Processos

| Tabela | Propósito |
|---|---|
| `process_task_set_categories` | Categorias de conjuntos de tarefas de processo |
| `process_task_sets` | Conjuntos de tarefas reusáveis |
| `process_task_templates` | Templates de tarefas |
| `process_subtask_templates` | Templates de subtarefas |
| `processes` | Processos definidos |
| `process_steps` | Etapas de um processo |
| `process_nodes` | Nós do fluxo de processo |
| `process_edges` | Conexões entre nós |

---

## 20. Form PRO

### `form_pro_forms`
Formulários independentes (não LP).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| pipeline_id | uuid | FK → leads_pipelines |
| fields | jsonb | |
| webhook_url | text | |
| active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `form_pro_submissions`
Submissões de formulários Form PRO.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| form_id | uuid | FK → form_pro_forms |
| lead_id | uuid | FK → leads |
| data | jsonb | |
| utm_source … utm_term | text | rastreamento UTM |
| ip_address | inet | |
| submitted_at | timestamptz | |

---

### `form_pro_rate_limits`
Controle de taxa de submissões.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| identifier | text | IP ou fingerprint |
| form_id | uuid | |
| count | integer | |
| window_start | timestamptz | |

---

## 21. Meta Lead Forms

### `meta_lead_form_pages`
Páginas de formulário do Facebook/Meta.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| page_id | text NOT NULL | ID da página Meta |
| page_name | text | |
| access_token | text | |
| active | boolean | |
| created_at | timestamptz | |

---

### `meta_lead_forms`
Formulários de Lead Ads do Meta.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| meta_form_id | text NOT NULL | ID no Meta |
| page_id | uuid | FK → meta_lead_form_pages |
| name | text | |
| pipeline_id | uuid | FK → leads_pipelines |
| stage_id | uuid | FK → leads_stages |
| field_mappings | jsonb | mapeamento de campos |
| active | boolean | |
| created_at | timestamptz | |

---

## 22. Admin (ADM)

### `adm_clients`
Clientes gerenciados pela plataforma admin.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| slug | text UNIQUE | |
| plan | text | |
| status | text | |
| supabase_project_id | text | |
| (credenciais e configs por cliente) | | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `adm_sync_jobs`
Jobs de sincronização admin → tenant.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| client_id | uuid | FK → adm_clients |
| job_type | text | |
| status | text | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz | |

---

### `adm_sync_logs`
Logs de sincronização.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| job_id | uuid | FK → adm_sync_jobs |
| level | text | info \| warn \| error |
| message | text | |
| created_at | timestamptz | |

---

### `adm_audit_log`
Log de auditoria de ações administrativas.

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| actor_id | uuid | |
| action | text NOT NULL | |
| target_type | text | |
| target_id | uuid | |
| metadata | jsonb | |
| ip_address | inet | |
| created_at | timestamptz | |

---

## 23. Outros / Internos

### `data_deletion_requests`
Solicitações de exclusão de dados (LGPD/GDPR).

| Coluna | Tipo | Observações |
|---|---|---|
| id | uuid PK | |
| people_id | uuid | FK → clients_people |
| requested_by | uuid | |
| reason | text | |
| status | text | pending \| processing \| completed |
| completed_at | timestamptz | |
| created_at | timestamptz | |

---

### `_app_config`
Configurações internas do sistema.

| Coluna | Tipo | Observações |
|---|---|---|
| key | text PK | chave única |
| value | jsonb | valor |
| updated_at | timestamptz | |

---

## Resumo Geral

| Categoria | Tabelas |
|---|---|
| Settings | 9 |
| Clients (Pessoas/Empresas) | 4 |
| Pipeline CRM | 9 |
| Reuniões | 4 |
| Mensagens | 5 |
| Score | 6 |
| Disparos | 2 |
| Webhooks | 3 |
| Agentes IA | 6 |
| LP PRO | 10 |
| Call PRO | 5 |
| BI PRO | 5 |
| OMNI PRO | 3 |
| Booking/Schedule | 3 |
| Prospecção | 8 |
| Instagram Automations | 2 |
| Conversões | 4 |
| ElevenLabs/Voice | 3 |
| Projetos e Processos | 13 |
| Form PRO | 3 |
| Meta Lead Forms | 2 |
| Admin (ADM) | 4 |
| Outros/Internos | 2 |
| **Total** | **~125** |

---

## Padrões do Schema

- **PK padrão**: `uuid DEFAULT gen_random_uuid()`
- **Timestamps**: `created_at` e `updated_at` em `timestamptz` com `DEFAULT now()`
- **Soft delete**: `deleted_at timestamptz` (tabelas de usuários)
- **RLS**: habilitado em todas as tabelas públicas
- **Triggers**: `update_updated_at_column()` em tabelas com `updated_at`
- **Arrays**: `text[]`, `uuid[]` para relações multi-valor sem tabela pivot
- **JSONB**: configurações flexíveis, dados de enriquecimento, payloads de API
