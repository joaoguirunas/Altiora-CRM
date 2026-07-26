---
title: Schema Altiora CRM — Implementação V1
type: schema
agent: dev-data-engineer
updated: 2026-07-25
tags: [altiora, schema, referrals, pipeline, migrations]
related: [[migrations-log]], [[schema]]
---

# Schema Altiora CRM — V1

Supabase project: `dtsmbqrzyxhjjjvpjfjd`
Implementado em: 2026-07-25
Migrations aplicadas: 7 (20260725100000 → 20260725160000)

---

## Pipeline Altiora

### Tabela: `leads_pipelines` (registro inserido)

| Campo | Valor |
|---|---|
| id | `a1000000-0000-0000-0000-000000000001` |
| name | Pipeline Altiora |
| order_index | 100 |

### Tabela: `leads_stages` (13 etapas inseridas)

| order_index | id (sufixo) | name | color |
|---|---|---|---|
| 1 | ...0001-...0001 | Novo referral | `#94A3B8` |
| 2 | ...0001-...0002 | Encaminhado ao comercial | `#60A5FA` |
| 3 | ...0001-...0003 | Contato iniciado | `#34D399` |
| 4 | ...0001-...0004 | R1 agendada | `#FBBF24` |
| 5 | ...0001-...0005 | R1 realizada | `#F97316` |
| 6 | ...0001-...0006 | Análise Finvity | `#8B5CF6` |
| 7 | ...0001-...0007 | R2 agendada | `#EC4899` |
| 8 | ...0001-...0008 | R2 realizada | `#10B981` |
| 9 | ...0001-...0009 | R3 agendada | `#3B82F6` |
| 10 | ...0001-...0010 | R3 realizada / fechamento | `#6366F1` |
| 11 | ...0001-...0011 | Em contratação | `#F59E0B` |
| 12 | ...0001-...0012 | Ganho | `#22C55E` |
| 13 | ...0001-...0013 | Perdido | `#EF4444` |

---

## Colunas adicionadas em tabelas existentes

### `settings_users` — Perfil Altiora

| Coluna | Tipo | Constraints | Descrição |
|---|---|---|---|
| user_type | text | nullable, CHECK IN ('admin','gestor_comercial','closer') | Perfil Altiora |
| fuso_horario | text | nullable, DEFAULT 'America/Sao_Paulo' | Fuso horário IANA |

**Índice:** `idx_settings_users_user_type` — filtro por perfil (WHERE deleted_at IS NULL)

### `leads` — Campos de Referral Altiora

| Coluna | Tipo | Constraints | Descrição |
|---|---|---|---|
| altiora_origem | text | nullable, CHECK IN ('avenue_email','manual','outros') | Origem do referral |
| altiora_closer_id | uuid | FK settings_users, ON DELETE SET NULL | Closer responsável |
| altiora_gestor_id | uuid | FK settings_users, ON DELETE SET NULL | Gestor que atribuiu |
| altiora_data_handoff | timestamptz | nullable | Data/hora do handoff Avenue |
| altiora_data_atribuicao | timestamptz | nullable | Data/hora da atribuição ao Closer |
| altiora_email_handoff_id | text | nullable | ID do e-mail de handoff original |
| altiora_origem_atribuicao | text | nullable, CHECK IN ('email_auto','manual') | Como foi atribuído |
| altiora_possibilidade_retomada | boolean | DEFAULT false | Flag de possível retomada |
| altiora_etapa_perda | text | nullable | Etapa em que foi perdido |
| altiora_obs_atribuicao | text | nullable | Observações da atribuição/troca |

**Índices:**
- `idx_leads_altiora_closer_id` — busca por closer
- `idx_leads_altiora_gestor_id` — busca por gestor
- `idx_leads_altiora_origem` — filtro por origem
- `idx_leads_altiora_data_handoff` — ordenação por handoff

### `meetings` — Campos R1/R2/R3 Altiora

| Coluna | Tipo | Constraints | Descrição |
|---|---|---|---|
| altiora_tipo | text | nullable, CHECK IN ('R1','R2','R3') | Tipo de reunião |
| altiora_duracao_minutos | integer | nullable | Duração planejada |
| google_event_id | text | UNIQUE WHERE NOT NULL | ID evento Google Calendar |
| altiora_compareceu | boolean | nullable | Cliente compareceu (null = não registrado) |
| altiora_motivo_ausencia | text | nullable | Motivo de ausência |
| altiora_resultado | text | nullable | Resultado da reunião |
| altiora_pauta | text | nullable | Pauta (obrigatória em R2/R3) |
| altiora_proxima_acao | text | nullable | Próxima ação definida |
| altiora_created_by | uuid | FK settings_users, ON DELETE SET NULL | Quem registrou |
| altiora_data_hora | timestamptz | nullable | Timestamp de início completo |

**Índices:**
- `meetings_google_event_id_uq` — unicidade por evento GCal
- `idx_meetings_altiora_tipo` — filtro por tipo R1/R2/R3

---

## Novas tabelas

### `altiora_r1_data` — Dados da Reunião 1

| Coluna | Tipo | Constraints | Descrição |
|---|---|---|---|
| lead_id | uuid | PK, FK leads(id) CASCADE | Referral (1:1) |
| scorecard | jsonb | NOT NULL DEFAULT '{}' | Dados Elephan |
| diagnostico | jsonb | NOT NULL DEFAULT '{}' | Campos do playbook |
| elephan_importado | boolean | NOT NULL DEFAULT false | Flag de importação |
| elephan_conflito | boolean | NOT NULL DEFAULT false | Flag de conflito |
| data_r2_prevista | date | nullable | Data prevista R2 |
| created_by | uuid | FK settings_users, SET NULL | Quem preencheu |
| updated_by | uuid | FK settings_users, SET NULL | Última atualização |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | auto-updated |

**RLS:** ativo — policy `altiora_r1_data_authenticated` (authenticated, qual=true)
**Trigger:** `altiora_r1_data_updated_at` → `update_updated_at_column()`

### `altiora_finvity_analise` — Análise Finvity

| Coluna | Tipo | Constraints | Descrição |
|---|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| lead_id | uuid | NOT NULL, FK leads(id) CASCADE, UNIQUE | Referral |
| finvity_link | text | nullable | URL do relatório |
| finvity_arquivo_url | text | nullable | URL do arquivo (Storage) |
| dores | text[] | NOT NULL DEFAULT '{}' | Dores identificadas |
| necessidades | text[] | NOT NULL DEFAULT '{}' | Necessidades |
| produtos_sugeridos | text[] | NOT NULL DEFAULT '{}' | Produtos sugeridos |
| notas | text | nullable | Observações adicionais |
| created_by | uuid | FK settings_users, SET NULL | |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | auto-updated |

**Constraint:** `altiora_finvity_lead_uq UNIQUE(lead_id)`
**RLS:** ativo — policy `altiora_finvity_analise_authenticated`
**Trigger:** `altiora_finvity_analise_updated_at`

### `altiora_contratacao` — Processo de Contratação

| Coluna | Tipo | Constraints | Descrição |
|---|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() | |
| lead_id | uuid | NOT NULL, FK leads(id) CASCADE, UNIQUE | Referral |
| parceiro_emissor | text | nullable | Seguradora/parceiro |
| data_emissao | date | nullable | Data de emissão |
| data_confirmacao_emissao | date | nullable | Data de confirmação |
| valor_final | numeric(15,2) | nullable | Valor da apólice |
| premio_confirmado | numeric(15,2) | nullable | Prêmio confirmado |
| documentos_status | jsonb | NOT NULL DEFAULT '{}' | Checklist documentos |
| exames_status | jsonb | NOT NULL DEFAULT '{}' | Checklist exames |
| entrevista_financeira_status | text | NOT NULL DEFAULT 'pendente', CHECK | Status entrevista |
| underwriting_status | text | NOT NULL DEFAULT 'pendente', CHECK | Status underwriting |
| notas | text | nullable | |
| created_by | uuid | FK settings_users, SET NULL | |
| updated_by | uuid | FK settings_users, SET NULL | |
| created_at | timestamptz | NOT NULL DEFAULT now() | |
| updated_at | timestamptz | NOT NULL DEFAULT now() | auto-updated |

**Valores válidos:**
- `entrevista_financeira_status`: pendente | agendada | realizada | nao_aplicavel
- `underwriting_status`: pendente | em_analise | aprovado | recusado | nao_aplicavel

**Constraint:** `altiora_contratacao_lead_uq UNIQUE(lead_id)`
**Índices:** `idx_altiora_contratacao_underwriting`, `idx_altiora_contratacao_entrevista`
**RLS:** ativo — policy `altiora_contratacao_authenticated`
**Trigger:** `altiora_contratacao_updated_at`

---

## Mapeamento UC → Schema

| UC | Tabela/Campo | Status |
|---|---|---|
| UC01 | settings_users + auth | Existente |
| UC02 | settings_users.user_type, fuso_horario | ✅ Novo |
| UC03 | leads + filtros altiora_* | ✅ Novo |
| UC04 | leads + altiora_r1_data + altiora_finvity_analise | ✅ Novo |
| UC05 | settings_users.user_type | ✅ Novo |
| UC06 | leads_pipelines + leads_stages | ✅ Novo (dados) |
| UC10 | leads.altiora_origem, altiora_email_handoff_id, altiora_data_handoff | ✅ Novo |
| UC11 | leads.altiora_origem='manual' | ✅ Novo |
| UC12 | leads.altiora_closer_id, altiora_gestor_id, altiora_data_atribuicao, altiora_origem_atribuicao | ✅ Novo |
| UC13 | leads.altiora_obs_atribuicao | ✅ Novo |
| UC16 | leads.altiora_possibilidade_retomada, altiora_etapa_perda | ✅ Novo |
| UC17 | leads (filtro por altiora_closer_id) | ✅ Novo |
| UC18 | leads (last_interaction_at existente) | Existente |
| UC21 | meetings.altiora_tipo, google_event_id, altiora_duracao_minutos, altiora_data_hora | ✅ Novo |
| UC22 | meetings (reagendamento via google_event_id) | ✅ Novo |
| UC23 | meetings.altiora_compareceu, altiora_motivo_ausencia, altiora_resultado, altiora_proxima_acao | ✅ Novo |
| UC24 | altiora_r1_data (scorecard, diagnostico, elephan_*, data_r2_prevista) | ✅ Novo |
| UC25 | altiora_finvity_analise | ✅ Novo |
| UC26 | meetings.altiora_pauta + altiora_finvity_analise | ✅ Novo |
| UC27 | meetings.altiora_resultado + leads.status='won' | ✅ Novo |
| UC28 | altiora_contratacao | ✅ Novo |
| UC29 | altiora_contratacao (parceiro_emissor, data_emissao, valor_final, premio_confirmado) | ✅ Novo |
| UC30 | leads_files (existente) | Existente |

---

## Migrations aplicadas

| Arquivo | Status | Descrição |
|---|---|---|
| 20260725100000_altiora_pipeline.sql | ✅ Aplicada | Pipeline + 13 etapas (INSERT) |
| 20260725110000_altiora_users_profile.sql | ✅ Aplicada | user_type + fuso_horario em settings_users |
| 20260725120000_altiora_leads_referral.sql | ✅ Aplicada | 10 colunas altiora_* em leads |
| 20260725130000_altiora_meetings_r123.sql | ✅ Aplicada | 10 colunas altiora_* + google_event_id em meetings |
| 20260725140000_altiora_r1_data.sql | ✅ Aplicada | CREATE TABLE altiora_r1_data |
| 20260725150000_altiora_finvity.sql | ✅ Aplicada | CREATE TABLE altiora_finvity_analise |
| 20260725160000_altiora_contratacao.sql | ✅ Aplicada | CREATE TABLE altiora_contratacao |

Rollbacks disponíveis em `supabase/migrations/rollbacks/`.
