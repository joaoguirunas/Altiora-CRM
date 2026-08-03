---
title: Schema Gap Report — SD-01
type: audit-report
agent: dev-data-engineer
updated: 2026-07-26
tags: [database, schema, drift, audit, meetings]
related: [[schema]], [[migrations-log]]
---

# Schema Gap Report — SD-01

Auditoria executada em 2026-07-26 contra Supabase project `dtsmbqrzyxhjjjvpjfjd`.
Método: query direto a `information_schema.columns` via `supabase db query --linked`.

---

## meetings

### Colunas presentes no banco (confirmadas via query live)
`id`, `leads_id`, `users_id`, `date`, `start_time`, `end_time`, `location`, `notes`, `status`, `source`, `quantity`, `attendees`, `google_meet_link`, `calendar_id`, `created_at`, `outcome`, `gcal_sync_error`, `meeting_type`, `altiora_tipo`, `altiora_duracao_minutos`, `google_event_id`, `altiora_compareceu`, `altiora_motivo_ausencia`, `altiora_resultado`, `altiora_pauta`, `altiora_proxima_acao`, `altiora_created_by`, `altiora_data_hora`

### Gaps — colunas referenciadas no código mas AUSENTES no banco

| Coluna | Tipo esperado | Referenciada em | Observação |
|---|---|---|---|
| `title` | `text` | `useAgendamentosSimple`, `useMeetingSingle`, `biTools.ts` | Migration 20260726200000 criada, não aplicada |
| `people_id` | `uuid FK → clients_people(id)` | `useAgendamentos`, `useAgendamentosSimple`, `useMeetingSingle`, `useDeletarPessoa`, `useDashboardAgendamentos` | Migration 20260726200000 criada, não aplicada |
| `description` | `text` | `useAgendamentosSimples` | Migration 20260726200000 criada, não aplicada |
| `meeting_link` | `text` | `useMeetingSingle`, `useAltioraMeetings` | Migration 20260726200000 criada, não aplicada |
| `updated_at` | `timestamptz` | `useMeetingSingle` (type def) | Nunca adicionada |
| `ms_meeting_id` | `text` | `useMeetingSingle` (type def) | Migration 20260219220000_ms_teams_integration não aplicada |
| `google_last_synced_at` | `timestamptz` | `useAgendamentosSimple` (type def) | Migration 20260219130000_google_cal_sync_to_db não aplicada |

### Observação sobre nomes de colunas
A migration `20260227140000_p6_fk_column_consistency` renomeou `meetings.leads_id → lead_id` e `meetings.users_id → user_id` — porém essa migration **não foi aplicada** no banco real. O banco ainda tem `leads_id` e `users_id`. Os hooks mais recentes (Altiora) já usam os nomes corretos (`leads_id`, `users_id`). Os hooks antigos de BI que usam `lead_id`/`user_id` falham silenciosamente. **Isso é bug de código, não de schema** — fora do escopo da migration SD-02.

---

## leads

### Colunas presentes no banco (seleção de FKs auditadas)
`people_id`, `users_id`, `leads_pipelines_id`, `leads_stages_id`, `altiora_closer_id`, `altiora_gestor_id` (entre outras)

### Gaps
| Coluna | Situação | Observação |
|---|---|---|
| `user_id` | NÃO existe — banco tem `users_id` | Migration de rename não foi aplicada. Bug de código nos hooks de BI que usam `user_id`. Fora do escopo Bythak. |
| `company_id` | NÃO existe — sem coluna de empresa em leads no banco real | Código usa `.eq('company_id', ...)` — bug de código. Fora do escopo. |

---

## clients_people

### Colunas ausentes mas INTENCIONALMENTE REMOVIDAS
As colunas `score`, `income`, `moment`, `goal`, `disc_profile`, `disc_summary` foram **removidas intencionalmente** pela migration `20251026025557` ("Remove campos antigos de score da tabela clients_people"). O código que ainda as referencia (`ConversaDetalhes.tsx`, `MobileConversaSingle.tsx`, `useAgentEligibility`, hooks de BI) usa colunas inexistentes — são bugs de código, **não gaps de schema**. Bythak não re-adiciona colunas intencionalmente removidas.

---

## settings_users

### Gaps de nomenclatura
O banco usa `nome` e `ativo`. O código em `useAltioraClosers.ts` e `biTools.ts` usa `name` e `active`. Esses são bugs de código — o schema é correto. Fora do escopo da migration.

---

## Tabelas inexistentes (kiwify)
`kiwify_lead_products` — confirmada como inexistente. Todas as referências já foram removidas do código conforme indicado no contexto SD-01.

---

## Resumo executivo dos gaps acionáveis

Apenas a tabela `meetings` tinha gaps acionáveis via migration `ADD COLUMN IF NOT EXISTS`.
Migration `20260726210000_schema_drift_fix.sql` aplicada em 2026-07-26 via `supabase db query --linked`.

| # | Tabela | Coluna | Status | Migration |
|---|---|---|---|---|
| 1 | meetings | title | APPLIED | 20260726210000 |
| 2 | meetings | people_id | APPLIED | 20260726210000 |
| 3 | meetings | description | APPLIED | 20260726210000 |
| 4 | meetings | meeting_link | APPLIED | 20260726210000 |
| 5 | meetings | updated_at | APPLIED | 20260726210000 |
| 6 | meetings | ms_meeting_id | APPLIED | 20260726210000 |
| 7 | meetings | google_last_synced_at | APPLIED | 20260726210000 |

Smoke test executado: todos os 7 columns confirmados via `information_schema.columns`. Índices `idx_meetings_people_id` e `meetings_ms_meeting_id_idx` confirmados via `pg_indexes`.

**Nota sobre `supabase db push`:** O push falha em migration anterior (`20250801010922`) que tenta criar índice em `crm_messages` (tabela inexistente). A migration SD-02 foi aplicada diretamente via `db query` — safe porque usa somente `ADD COLUMN IF NOT EXISTS`. O blocker do push é pré-existente e fora do escopo SD-02.
