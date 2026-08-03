# Full Schema Drift Audit — 2026-07-26

**Executado por:** data-engineer agent  
**Supabase project:** dtsmbqrzyxhjjjvpjfjd  
**Branch:** feature/04-terminologia-referral  
**Migration gerada:** `20260726260000_full_schema_drift_fix.sql` — APPLIED  

---

## Metodologia

1. Esquema real obtido via `information_schema.columns` (live DB).  
2. Referências de código extraídas de todos os hooks em `src/hooks/`.  
3. Cada referência foi classificada como:
   - **MISSING_TABLE** — tabela inexistente no DB
   - **MISSING_COLUMN** — coluna inexistente (tabela existe) → candidata a migration
   - **WRONG_COLUMN_NAME** — nome errado no código (bug de código, não de schema)
   - **FALSE_POSITIVE** — campo TypeScript que não é query SQL real
4. Migration gerada apenas para MISSING_COLUMN acionáveis.
5. MISSING_TABLE e WRONG_COLUMN_NAME documentados separadamente.

---

## Fixes já aplicados ANTES deste audit (não repetidos)

- `meetings`: title, people_id, description, meeting_link, updated_at, ms_meeting_id, google_last_synced_at — ADDED
- `meetings.users_id` FK → `settings_users(id)` — FIXED  
- `meetings`: start_time, end_time → TIMESTAMPTZ — FIXED
- `meetings_followups`: channel, webhook_url, name, source, whatsapp_template_id, control, as_queue_id, business_hours_only, bh_only_last — ADDED
- `meeting_followup_queue`: tabela criada
- `followup_queue`: tabela criada
- `fn_schedule_automation_on_status_change`: NEW.leads_id fix — APPLIED

---

## Parte 1 — MISSING_COLUMN (resolvidos nesta migration)

### 1.1 `leads` — 6 colunas adicionadas

| Coluna | Tipo | Arquivo(s) | Observação |
|--------|------|------------|------------|
| `next_action_type` | text | useAltioraContatos, useAltioraR1Data, useAltioraR2Data | Tipo de próxima ação |
| `next_action_description` | text | useAltioraContatos, useAltioraR1Data, useAltioraR2Data | Descrição da próxima ação |
| `next_action_due_at` | timestamptz | useAltioraContatos, useAltioraR1Data, useAltioraR2Data, useAltioraPendencias | Prazo da próxima ação |
| `next_action_responsavel_id` | uuid → settings_users | useAltioraContatos | Responsável pela próxima ação |
| `altiora_motivo_perda` | text | useAltioraMetrics | Motivo de perda (texto livre Altiora) |
| `company_id` | uuid (sem FK — clients_companies inexistente) | useCompanyRelations | FK solta até tabela ser criada |

### 1.2 `ai_agents` — 7 colunas adicionadas

| Coluna | Tipo | Arquivo(s) | Observação |
|--------|------|------------|------------|
| `is_template` | boolean DEFAULT false | useAgentesIAReal, useAgentEligibility | Flag de template |
| `template_type` | text | useAgentesIAReal | Tipo do template |
| `humanizacao` | text CHECK enum | useAgentesIAReal | Nível humanização IA |
| `voice_enabled` | boolean DEFAULT false | useAgentesIAReal | Liga modo voz |
| `voice_id` | text | useAgentesIAReal | ID de voz ElevenLabs (distinto de voice_model_id) |
| `wa_channel_id` | text | useAgentesIAReal | Canal WA alternativo |
| `elevenlabs_agent_id` | text | useAiAgents, useAgentesIAReal | ID agente ElevenLabs conversacional |

### 1.3 `ai_agents_steps` — 1 coluna adicionada

| Coluna | Tipo | Arquivo(s) | Observação |
|--------|------|------------|------------|
| `current_version` | integer DEFAULT 1 | useAgentSteps | Versão do step |

### 1.4 `meeting_records` — 3 colunas adicionadas

| Coluna | Tipo | Arquivo(s) | Observação |
|--------|------|------------|------------|
| `tldv_meeting_id` | text | useMeetingRecords | ID da gravação no tl;dv |
| `transcript_json` | jsonb | useMeetingRecords | Transcrição completa |
| `highlights` | jsonb | useMeetingRecords | Momentos destacados |

### 1.5 `settings_teams` — 5 colunas alias inglês adicionadas + trigger bidirecional

| Coluna DB original | Coluna alias adicionada | Arquivo(s) |
|--------------------|------------------------|------------|
| `nome` | `name` | useTeamsNew, useAtribuicaoNegocio, useDashboardNegociosOptimized |
| `descricao` | `description` | useTeamsNew |
| `tipo` (enum tipo_time) | `team_type` | useTeamsNew, useAtribuicaoNegocio |
| `prioridade` | `priority` | useTeamsNew |
| `ativo` | `active` | useTeamsNew, useAtribuicaoNegocio |

**Trigger:** `trg_sync_settings_teams_bilingual` — sincroniza inglês↔português em ambas as direções. Cast `tipo_time::text` e `text::tipo_time` com handler de erro.

### 1.6 `settings_users_teams` — 2 colunas alias inglês adicionadas + trigger bidirecional

| Coluna DB original | Coluna alias adicionada | Arquivo(s) |
|--------------------|------------------------|------------|
| `usuario_id` | `user_id` | useTimesCompat, useAtribuicaoNegocio, useUsersTeams, useTeamsNew, useUsersNew |
| `time_id` | `team_id` | useTimesCompat, useAtribuicaoNegocio, useUsersTeams, useTeamsNew |

**Trigger:** `trg_sync_settings_users_teams_bilingual`

### 1.7 `settings_users` — 3 colunas alias inglês adicionadas + trigger bidirecional

| Coluna DB original | Coluna alias adicionada | Arquivo(s) |
|--------------------|------------------------|------------|
| `nome` | `name` | useCurrentUser, useBIProCRM, useBIProRevOps, useBIProOmni, useBIProSchedules, useAltioraClosers, useCalendarConnectionsHealth, useConversas, useAgenteTeste |
| `ativo` | `active` | useAltioraClosers, useDashboardNegociosOptimized |
| `super_adm` | `super_admin` | useAtribuicaoNegocio, useUsersTeams |

**Trigger:** `trg_sync_settings_users_bilingual`

---

## Parte 2 — MISSING_TABLE (código referencia tabelas inexistentes)

Estas tabelas são referenciadas no código mas NÃO existem no banco. Não foram criadas neste audit pois pertencem a features pendentes ou foram descontinuadas. Os hooks afetados falham silenciosamente (erro de PostgREST 404/42P01).

| Tabela | Arquivo(s) | Status Recomendado |
|--------|------------|-------------------|
| `ai_agent_callback_configs` | useAgentCallbackConfig.ts | Criar — feature RETORNO-01 pendente |
| `ai_agents_execution_log` | useAgentConversation.ts, useAgentesIAReal.ts | Criar — feature de logging de execução |
| `ai_scheduled_callbacks` | useAgentConversation.ts | Criar — feature RETORNO-01 pendente |
| `lead_field_definitions` | useAgenteTeste.ts, useLeadFieldDefinitions.ts | Criar — campos customizados de lead |
| `lead_field_values` | useAgenteTeste.ts, useDeletarPessoa.ts, useLeadFieldValues.ts | Criar — valores dos campos customizados |
| `settings_ai_providers` | useAgentesIAReal.ts | Criar — registro de provedores de LLM |
| `settings_whatsapp_channels` | useAgentesIAReal.ts | Criar — canais WhatsApp múltiplos |
| `adm_client_drift` | useClientDrift.ts | Criar — monitoramento de drift entre clientes |
| `clients_companies` | useCompanies.ts, useCompanyRelations.ts | Criar — módulo empresas |
| `clients_people_companies` | useCompanyAssociations.ts, useCompanyRelations.ts | Criar — N:N pessoa↔empresa |
| `settings_business_hours` | useBusinessHours.ts | Criar — horários comerciais |
| `message_buffer` | useDeletarPessoa.ts | Criar — buffer de mensagens AI |
| `fup_programados` | useFupProgramados.ts | Criar (era view?) — fila de follow-ups programados |
| `v_dispatch_health` | useDispatchHealth.ts | Criar view — saúde do disparo |
| `settings_elevenlabs` | useElevenLabsConfig.ts | Criar — configuração ElevenLabs |
| `elevenlabs_voices` | useElevenLabsConfig.ts | Criar — catálogo de vozes |
| `elevenlabs_agents` | useElevenLabsConfig.ts | Criar — agentes ElevenLabs |
| `email_templates` | useEmailTemplates.ts | Criar — templates de email |
| `omni_channel_configs` | useInstagramAutomations.ts | Criar — configuração canais omni |
| `conversion_event_rules` | useConversionConfig.ts | Criar — regras de conversão |
| `conversion_events_queue` | useConversionConfig.ts | Criar — fila de eventos de conversão |
| `lead_types` | useLeadTypes.ts | Criar — tipos de lead |
| `form_pro_forms` | useLpForms.ts, useBIProAttribution.ts | Criar — formulários Pro |
| `form_pro_submissions` | useLpForms.ts, useBIProAttribution.ts | Criar — submissões formulários Pro |

---

## Parte 3 — WRONG_COLUMN_NAME (bugs de código, não de schema)

Estes hooks usam nomes errados de coluna. Não precisam de migration — precisam de correção no código TypeScript.

### 3.1 `meetings.leads_id` usado como `lead_id`

**Impacto:** Queries retornam zero resultados silenciosamente (PostgREST ignora coluna desconhecida em filtros com `.eq('lead_id', ...)`).

| Arquivo | Linha(s) | Coluna errada | Coluna correta |
|---------|----------|---------------|----------------|
| useAltioraMetrics.ts | 139-140 | `lead_id` | `leads_id` |
| useBIProCRM.ts | 222 | `lead_id` | `leads_id` |
| useBIProFunnel.ts | (meetings query) | `lead_id` | `leads_id` |
| useBIProKPIs.ts | (meetings query) | `lead_id` | `leads_id` |
| useDashboardLeadsConversao.ts | (meetings query) | `lead_id` | `leads_id` |

### 3.2 `leads.users_id` usado como `user_id`

**Impacto:** Filtros por responsável não funcionam; sorts por user ficam incorretos.

| Arquivo | Referência | Coluna errada | Coluna correta |
|---------|------------|---------------|----------------|
| useLeads.ts | filtros, select | `user_id` | `users_id` |
| useDashboardNegociosOptimized.ts | `.eq('user_id', ...)` | `user_id` | `users_id` |
| useDashboardLeadsEvolucao.ts | select, filtro | `user_id` | `users_id` |
| useBIProRevOps.ts | select | `user_id` | `users_id` |
| useBIProCRM.ts | select | `user_id` | `users_id` |
| useBIProSchedules.ts | select | `user_id` | `users_id` |
| useAtribuicaoNegocio.ts | `.update({user_id: ...})` | `user_id` | `users_id` |
| useAltioraClosers.ts | `.eq('user_id', ...)` | `user_id` | `users_id` |
| useBulkUpdateNegocios.ts | update payload | `user_id` | `users_id` |

### 3.3 `meetings.users_id` usado como `user_id`

| Arquivo | Referência | Coluna errada | Coluna correta |
|---------|------------|---------------|----------------|
| useAgendamentosSimples.ts | `select('...user_id...')` | `user_id` | `users_id` |
| useBIProCRM.ts | meetings select | `user_id` | `users_id` |
| useBIProAttribution.ts | meetings select | `user_id` | `users_id` |

### 3.4 `messages.users_id` usado como `user_id`

| Arquivo | Referência | Coluna errada | Coluna correta |
|---------|------------|---------------|----------------|
| useConversas.ts | select `user_id` | `user_id` | `users_id` |

### 3.5 `leads_updates.leads_id` usado como `lead_id`

| Arquivo | Referência | Coluna errada | Coluna correta |
|---------|------------|---------------|----------------|
| useLeads.ts | `.eq('lead_id', leadId)` | `lead_id` | `leads_id` |

### 3.6 `ai_agents_steps_history` colunas erradas

**Contexto:** A tabela foi renomeada de `ai_agents_stages_history` via migration (20251026182118). O campo `step_id` deveria ser `ai_agent_step_id` e `executed_at` deveria ser `changed_at`.

| Arquivo | Referência | Coluna errada | Coluna correta |
|---------|------------|---------------|----------------|
| useAgentStepHistory.ts | `.eq('step_id', stepId)` | `step_id` | `ai_agent_step_id` |
| useAgentStepHistory.ts | `.order('executed_at', ...)` | `executed_at` | `changed_at` |

### 3.7 `clients_people.resumo_contador` — FALSE POSITIVE

`useIncrementarContadorResumo.ts` na verdade acessa `summary_message_counter` (existe no DB). A referência ao campo `resumo_contador` é apenas no comentário da interface TypeScript, não em uma query SQL. Classificado como **FALSE_POSITIVE**.

---

## Parte 4 — Verificação pós-migration

Todas as colunas adicionadas foram verificadas via `information_schema.columns`:

```
leads: next_action_type, next_action_description, next_action_due_at,
       next_action_responsavel_id, altiora_motivo_perda, company_id ✓

ai_agents: is_template, template_type, humanizacao, voice_enabled,
           voice_id, wa_channel_id, elevenlabs_agent_id ✓

ai_agents_steps: current_version ✓

meeting_records: tldv_meeting_id, transcript_json, highlights ✓

settings_teams: name, description, team_type, priority, active ✓
settings_users_teams: user_id, team_id ✓
settings_users: name, active, super_admin ✓

Triggers criados:
  trg_sync_settings_teams_bilingual ✓
  trg_sync_settings_users_teams_bilingual ✓
  trg_sync_settings_users_bilingual ✓
```

---

## Próximos passos recomendados

### P0 — Correções de código urgentes (WRONG_COLUMN_NAME)

1. **`meetings.lead_id → leads_id`** — afeta 5 hooks de métricas/dashboard; queries retornam zero sem erro visível
2. **`leads.user_id → users_id`** — afeta 9 hooks; filtros por responsável quebrados
3. **`leads_updates.lead_id → leads_id`** — afeta useLeads
4. **`ai_agents_steps_history.step_id → ai_agent_step_id`** e `executed_at → changed_at` — afeta useAgentStepHistory

### P1 — Tabelas críticas a criar

1. `ai_agent_callback_configs` + `ai_scheduled_callbacks` — feature RETORNO-01 (hooks já escritos, aguardando schema)
2. `ai_agents_execution_log` — logging de execução de agentes IA
3. `lead_field_definitions` + `lead_field_values` — campos customizados
4. `clients_companies` + `clients_people_companies` — módulo empresas (+ adicionar FK constraint em leads.company_id)

### P2 — Tabelas de apoio

1. `settings_ai_providers`, `settings_whatsapp_channels` — multi-provider IA
2. `settings_business_hours` — horários comerciais
3. `message_buffer` — buffer de mensagens
4. `form_pro_forms`, `form_pro_submissions` — formulários Pro
5. `fup_programados` (view ou tabela) — fila programada de follow-ups
6. `v_dispatch_health` (view) — saúde do disparo

---

## Referência de arquivos

| Arquivo | Tabela(s) afetada(s) |
|---------|---------------------|
| `supabase/migrations/20260726260000_full_schema_drift_fix.sql` | leads, ai_agents, ai_agents_steps, meeting_records, settings_teams, settings_users_teams, settings_users |
| `src/hooks/useAgentCallbackConfig.ts` | ai_agent_callback_configs (MISSING) |
| `src/hooks/useAgentConversation.ts` | ai_agents_execution_log, ai_scheduled_callbacks (MISSING) |
| `src/hooks/useAgentesIAReal.ts` | settings_ai_providers, settings_whatsapp_channels (MISSING) |
| `src/hooks/useAgentStepHistory.ts` | ai_agents_steps_history (wrong cols: step_id, executed_at) |
| `src/hooks/useAltioraMetrics.ts` | meetings.lead_id → leads_id (WRONG) |
| `src/hooks/useLeads.ts` | leads.user_id → users_id, leads_updates.lead_id → leads_id (WRONG) |
| `src/hooks/useTeamsNew.ts` | settings_teams (English aliases now fixed) |
| `src/hooks/useUsersTeams.ts` | settings_users_teams (English aliases now fixed) |
| `src/hooks/useCurrentUser.ts` | settings_users.name (now fixed via alias) |
