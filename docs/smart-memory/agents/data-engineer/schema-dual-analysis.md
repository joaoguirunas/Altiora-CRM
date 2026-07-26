---
title: Schema Dual Analysis — crm_* vs moderno
type: analysis
agent: dev-data-engineer
created: 2026-04-26
updated: 2026-04-26
tags: [database, schema, migration, audit-fix-10]
related: ["[[schema]]", "[[migrations-log]]", "[[../../decisions/ADR-SCHEMA-MIGRATION]]", "[[../../stories/backlog/AUDIT-FIX-10]]"]
---

# Schema Dual Analysis — `crm_*` (legado) vs moderno

Documento complementar ao [[../../decisions/ADR-SCHEMA-MIGRATION]]. Produzido por Bythak (dev-data-engineer) via análise estática de `supabase/baseline.sql`, migrations, `client-migrations.json`, edge functions e código frontend.

---

## 1. Mapeamento de pares legado ↔ moderno

| # | Tabela legado | Tabela(s) moderna(s) | Status no banco | Em client-migrations? |
|---|---|---|---|---|
| 1 | `crm_leads` | `leads` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 2 | `crm_pessoas` | `clients_people` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 3 | `crm_empresas` | `clients_companies` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 4 | `crm_agendamentos` | `meetings` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 5 | `crm_messages` | `messages` | **Dropado** em `20260423016000_drop_crm_messages.sql` ✅ propagado | Sim (order_index 151) |
| 6 | `crm_negocio_arquivos` | `leads_files` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 7 | `crm_negocio_notas` | `leads_notes` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 8 | `crm_stages` | `leads_stages` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 9 | `crm_pipelines` | `leads_pipelines` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 10 | `crm_pessoa_empresas` | `clients_people_companies` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 11 | `crm_security_audit_log` | `security_audit_logs` | **Dropado** em `20251006011101` (não propagado a tenants) | Não |
| 12 | `crm_usuarios` | `settings_users` | Ainda **existe** no baseline; não dropado em nenhuma migration | Não |
| 13 | `crm_tenants` | `adm_clients` (control plane) | Ainda **existe** — tratamento separado (ver ADR) | Sim (order_index 10) |

### Achado crítico: consolidação não propagada

A migration `20251006011101_3ff414d9-...ok.sql` executou backfill completo + DROP para 11 pares. Ela está no `migrations-manifest.json` (aplicada ao banco de baseline / control plane) **mas ausente do `client-migrations.json`** — portanto **nunca foi enviada a tenants existentes via adm-sync-client**.

Consequência: tenants ativos ainda têm as tabelas `crm_*` existindo em seus bancos, com dados históricos intactos. A RLS migration `20260426010000` (P0-15) está correta em aplicar policies nesses tenants.

---

## 2. Coluna de mapeamento por par (extraído de `20251006011101`)

| Legado | Moderno | Colunas renomeadas |
|---|---|---|
| `crm_pipelines` | `leads_pipelines` | `nome→name`, `descricao→description`, `ativo→active` |
| `crm_stages` | `leads_stages` | `nome→name`, `ordem→order_index`, `cor→color`, `ativo→active` |
| `crm_leads` | `leads` | `person_id→people_id`, `empresa_id→companies_id`, `pipeline_id→leads_pipelines_id`, `stage_id→leads_stages_id`, `responsavel→users_id`, `time_responsavel→teams_id`, `titulo→title`, `valor→value`, `controle→control`, `motivo_perda→loss_reason`, `motivo_perda_id→leads_loss_reasons_id`, `data_criacao→created_at`, `data_ganho→won_at`, `data_ultima_interacao→last_interaction_at`, `tentativas_followup→followup_attempts`, `status_followup→followup_status`, `bloqueia_ia→ai_blocked`, `datetime_bloqueia_ia→ai_blocked_until`, `ultima_interacao→last_interaction` |
| `crm_agendamentos` | `meetings` | `negocio_id→leads_id`, `usuario_id→users_id`, `data→date`, `hora_inicio→start_time`, `hora_fim→end_time`, `observacoes→notes`, `origem→source`, `local→location`, `quantidade→quantity`, `convidados→attendees`, `id_calendar→calendar_id`, `criado_em→created_at` |
| `crm_negocio_arquivos` | `leads_files` | `negocio_id→leads_id`, `usuario_id→users_id`, `nome_arquivo→file_name`, `url_arquivo→file_url`, `tipo_arquivo→file_type`, `tamanho_arquivo→file_size` |
| `crm_negocio_notas` | `leads_notes` | `negocio_id→leads_id`, `usuario_id→users_id`, `titulo→title`, `conteudo→content` |
| `crm_messages` | `messages` | `lead_id→leads_id` (via `leads` FK agora), `pessoa_id→people_id`, `usuario_id→users_id`, `message→content`, `from_message→from_contact`, `canal→channel`, `tipo_mensagem→message_type`, `transcricao→transcription`, `duracao_audio→audio_duration` |
| `crm_security_audit_log` | `security_audit_logs` | `user_id→users_id` |
| `crm_pessoas` | `clients_people` | `nome→name`, `celular→whatsapp` (campo consolidado), `cpf→document` |
| `crm_empresas` | `clients_companies` | `nome→trade_name`, `site→website`, `cnpj→tax_id`, `telefone→phone` |
| `crm_pessoa_empresas` | `clients_people_companies` | `pessoa_id→people_id`, `empresa_id→company_id` |

---

## 3. Edge functions — uso por schema

### Tabelas legado usadas em edge functions

| Função | Tabelas legado usadas | Contexto |
|---|---|---|
| `lgpd_export` (order 164) | `crm_pessoas`, `crm_leads`, `crm_messages` | UPDATE de anonimização — sem IF EXISTS guard |
| `google-cal-connect` | comentário doc `crm_usuarios.id` apenas | Código real usa `settings_users` |
| `ms-teams-connect` | comentário doc `crm_usuarios.id` apenas | Código real usa `settings_users` |

**Atenção — P0 latente em `lgpd_export`:** a migration `20260423004000_lgpd_export.sql` está no `client-migrations.json` e executa `UPDATE public.crm_pessoas`, `UPDATE public.crm_messages` sem guard `IF EXISTS`. Se um tenant já teve as tabelas dropadas (ex: nova provision via baseline atualizado), a função `anonymize_person_data()` vai silenciosamente pular o `IF FOUND` — não quebra (UPDATE de tabela inexistente lança exceção, mas a função usa `IF FOUND` pós-UPDATE). **Risco:** `UPDATE` em tabela inexistente lança `42P01 undefined_table` no PL/pgSQL. Precisa de `BEGIN/EXCEPTION WHEN undefined_table` wrap ou verificação via `information_schema` antes do UPDATE.

### Tabelas modernas usadas em edge functions (resumo)

| Schema moderno | Funções que usam |
|---|---|
| `clients_people` | `whatsapp-inbound`, `meta-inbound`, `instagram-outbound`, `prospect-commit`, `crm-mapper` (shared) |
| `leads` | `whatsapp-inbound`, `meta-inbound`, `followup-status-callback`, `prospect-commit`, `crm-mapper`, `bi-insights-chat` |
| `meetings` | `tldv-webhook`, `google-cal-upsert-event`, `google-cal-sync-events` |
| `messages` | `whatsapp-inbound`, `meta-inbound`, `instagram-outbound`, `followup-status-callback` |
| `settings_users` | `prospect-commit`, `update-user-password`, `create-tenant-user` |
| `clients_companies` | `prospect-commit`, `crm-mapper` |
| `clients_people_companies` | `crm-mapper` |

**Conclusão:** edge functions operam 100% no schema moderno. As 2 referências `crm_usuarios` nos comentários doc são texto, não SQL executado.

---

## 4. Uso em frontend (RealtimeContext)

| Subscriptions crm_* | Local | Status |
|---|---|---|
| `crm_pessoas` | `RealtimeContext.tsx:126` | Morta — nenhuma escrita chega por aqui |
| `crm_leads` | `RealtimeContext.tsx:136` | Morta — nenhuma escrita chega por aqui |

Ambas subscriptions usam `filter: tenant_id=eq.${tenantId}`, mas como nenhuma função ou hook faz writes nessas tabelas, o canal nunca dispara eventos. A tabela que alimenta a UI é `clients_people` e `leads` (subscrições modernas também presentes em `RealtimeContext.tsx`).

**Handler `handleDataChange` (`RealtimeContext.tsx:88`)** já trata `crm_pessoas` e `crm_leads` no mesmo branch que as tabelas modernas — o payload seria processado se chegasse, mas nunca chega.

---

## 5. Estimativa de volume histórico (proxy via migrations)

| Tabela legado | Migrations que escrevem dados | Última escrita (migration timestamp) | Estimativa |
|---|---|---|---|
| `crm_leads` | ~20 migrations com INSERT | `20251004215415` (out 2025) | Alto volume — tabela central |
| `crm_pessoas` | ~20 migrations com INSERT | `20251004215415` | Alto volume — central |
| `crm_empresas` | ~15 migrations com INSERT | `20250920034017` | Médio |
| `crm_agendamentos` | ~8 migrations com INSERT | `20250920034017` | Baixo |
| `crm_pipelines` | ~10 migrations com INSERT | `20250920034017` | Baixo — dados de configuração |
| `crm_stages` | ~10 migrations com INSERT | `20250920034017` | Baixo — dados de configuração |
| `crm_messages` | ~5 migrations | dropado em `20260423016000` | Não aplicável |
| `crm_usuarios` | ~30 migrations com INSERT | `2025xxxx` (contínuo) | Muito alto — auth-adjacent |

A data da última escrita por migration (out 2025) é o sinal mais relevante: nenhuma migration de 2026 escreve em `crm_leads`, `crm_pessoas` ou `crm_empresas`. O fluxo de ingestão migrou para o schema moderno.

**Nota:** estes são volumes de migrations-seed / consolidação. O volume de dados reais em tenants de produção (rows inseridos pelo app em runtime) não é mensurável via grep — requer query em cada tenant (`SELECT COUNT(*) FROM crm_leads`).

---

## 6. Dependências externas (FKs de tabelas não-crm apontando para crm_*)

Tabelas externas que têm FKs para tabelas legado (risco ao DROP com CASCADE):

| Tabela referenciadora | FK para | Comportamento CASCADE |
|---|---|---|
| `messages` | `crm_leads(id)` | `ON DELETE CASCADE` — rows orphaned já foram migrados em `20251006011101` |
| `crm_negocio_arquivos` | `crm_leads(id)`, `crm_tenants(id)`, `crm_usuarios(id)` | `ON DELETE CASCADE` — própria tabela também dropada |
| `crm_negocio_notas` | `crm_leads(id)`, `crm_tenants(id)`, `crm_usuarios(id)` | `ON DELETE CASCADE` — própria tabela também dropada |
| `crm_agendamentos` | `crm_leads.id` (via `negocio_id`) | já dropada |
| `crm_stages` | `crm_pipelines(id)` | `ON DELETE CASCADE` — ambas dropadas |
| `crm_leads` | `crm_pessoas(id)`, `crm_pipelines(id)`, `crm_stages(id)`, `crm_usuarios(id)` | interna |
| `crm_pessoa_empresas` | `crm_pessoas(id)`, `crm_empresas(id)` | já dropada |
| `crm_agentes_ia_etapas` | `crm_agentes_ia(id)` | FK interna ao grupo crm_* |
| Várias tabelas | `crm_tenants(id)` | ON DELETE CASCADE — `crm_tenants` **não** está no DROP wave |

**Tabelas não-crm que referenciam `crm_usuarios`:**
- `campanhas` / `campanha_contatos` — referência histórica; `IF EXISTS` em DROP resolve via CASCADE
- `crm_horarios`, `crm_times`, `crm_usuario_times` — internas ao grupo crm_*

**Atenção — `messages` FK para `crm_leads`:** se `crm_leads` for dropado via CASCADE, qualquer row restante em `messages` que tenha `lead_id` apontando para `crm_leads.id` será deletada em cascade. Verificar se `messages.lead_id` ainda aponta para `crm_leads` ou foi migrado para FK em `leads` após `20251006011101`.

---

## 7. Migrations não-aplicadas que ainda referenciam crm_*

Migrations em `client-migrations.json` que referenciam tabelas legado e ainda precisam ser avaliadas:

| Arquivo | Referência | Risco |
|---|---|---|
| `20260423004000_lgpd_export.sql` | `crm_pessoas`, `crm_leads`, `crm_messages` | **MÉDIO** — UPDATE sem guard; falha se tabelas inexistentes |
| `20260312170000_ensure_crm_tenants_baseline.sql` | `crm_tenants` | BAIXO — `crm_tenants` não está no DROP wave |
| `20260423014000_crm_round_robin_rpc.sql` | provavelmente `crm_*` | A verificar |
| `20260426010000_crm_rls_tenant_isolation.sql` | crm_* (26 tabelas) | BAIXO — DROP IF EXISTS no rollback; se tabela inexistente, CREATE POLICY falha mas controlado |

---

## 8. Perguntas abertas para ADR (confirmação necessária pré-DROP)

1. **`messages.lead_id` FK:** aponta para `crm_leads(id)` ou `leads(id)`? Se para `crm_leads`, DROP cascadearia rows. Verificar com: `SELECT conname, confrelid::regclass FROM pg_constraint WHERE conname LIKE '%messages%lead%'`
2. **`lgpd_export` quebra em tenants sem crm_pessoas?** Sim — precisa de wrap `BEGIN/EXCEPTION WHEN undefined_table`. Ação: nova migration `20260427000000_lgpd_guard_legacy_tables.sql` adicionando guard ou reescrevendo a função.
3. **Dados órfãos em tenants de produção?** Não verificável via código. Query de audit por tenant: `SELECT COUNT(*) FROM crm_pessoas WHERE NOT EXISTS (SELECT 1 FROM clients_people WHERE id = crm_pessoas.id)`.
4. **`crm_usuarios` — plano de drop?** Tabela ainda existe, não está no DROP wave do `20251006011101`. Alta criticidade: referenciada em `campanhas`, `crm_agendamentos`, e RLS de várias tabelas. Tratar separado como indicado na ADR.

---

## 9. Resumo executivo para dev-architect

| Dimensão | Estado confirmado |
|---|---|
| Frontend | 100% moderno. 2 subscriptions RealtimeContext mortas. |
| Edge functions | 100% moderno. 1 migration legada (`lgpd_export`) com risco de erro em tenants sem crm_*. |
| Banco (baseline) | DROP de 11 tabelas executado em `20251006011101`, mas **não propagado a tenants**. |
| Tenants ativos | Provavelmente têm crm_* com dados históricos. Backfill da consolidation migration já tem mapping completo de colunas. |
| Ação prioritária | 1) Corrigir `lgpd_export` para guard legacy. 2) Decidir se `20251006011101` vira client-migration ou se cria nova migration equivalente. 3) Verificar `messages.lead_id` FK target antes de DROP. |
| Estratégia validada | Opção A (ADR-SCHEMA-MIGRATION) confirmada como correta. Backfill já documentado com mapping de colunas testado em produção (`20251006011101`). |
