---
title: Auditoria de Banco de Dados
type: audit
agent: dev-data-engineer
updated: 2026-04-26
tags: [audit, database, rls, migrations, indexes]
related: ["[[../agents/data-engineer/schema]]", "[[../agents/data-engineer/migrations-log]]"]
---

# Auditoria de Banco de Dados — rev-os

> Auditoria realizada em 2026-04-26.  
> Escopo: 749 arquivos de migration, baseline.sql (72.713 linhas), 60+ edge functions.  
> Arquitetura: project-per-tenant (cada tenant = Supabase project dedicado).

---

## Sumário Executivo

| Severidade | Total | Descrição |
|---|---|---|
| **P0** | 3 | Bloqueantes — risco de dados ou deploy quebrado |
| **P1** | 5 | Sérios — inconsistência estrutural ou de segurança |
| **P2** | 6 | Melhorias — técnicos não-críticos |

**Issue mais crítico:** `DB-P0-001` — Dois timestamps duplicados com conteúdo diferente na migrations-manifest causam risco de migration parcial quando Supabase CLI é usado fora do fluxo adm-sync-client.

---

## P0 — Bloqueantes

### DB-P0-001 — Timestamps duplicados com conteúdo diferente em migrations-manifest.json

**Arquivo:** `supabase/migrations-manifest.json` + `supabase/client-migrations.json`

Três pares de timestamps duplicados com conteúdo **diferente**:

| Timestamp | Arquivo A | Arquivo B |
|---|---|---|
| `20260319100001` | `20260319100001-sends_contacts_retry_count-ok.sql` | `20260319100001_fix_dead_letter_unique_message_id.sql` |
| `20260319100002` | `20260319100002-prospect_audit_log_v2_actions-ok.sql` | `20260319100002_omni_channel_health_cron.sql` |
| `20260319500000` | `20260319500000-fix_track_leads_changes_schema_mismatch-ok.sql` (conteúdo idêntico) | `20260319500000_fix_track_leads_changes_schema_mismatch.sql` |

- `20260312170000` tem dois arquivos com conteúdo diferente mas **targets diferentes** (controle-plane vs tenant), logo não conflita no fluxo adm-sync-client.
- O par `20260319500000` é conteúdo idêntico — migrations idempotentes, não quebra.
- Os pares `20260319100001` e `20260319100002` têm conteúdo **diferente** e **ambos** aparecem no manifest e em `client-migrations.json`. O adm-sync-client usa `order_index` + `name` (UUID-based), então aplica corretamente. Porém o Supabase CLI (`supabase db push`) ordena por timestamp — se algum dev rodar localmente, só um arquivo do par será aplicado.

**Risco:** Dev local com Supabase CLI perde uma das duas migrations do par. Em produção via adm-sync-client, não há risco (order_index garante sequência).

**Fix:** Renomear os arquivos para timestamps únicos (ex: `20260319100001` → `20260319100003`).

---

### DB-P0-002 — RLS `USING(true)` em tabelas crm_* no schema legado sem isolamento de tenant

**Arquivos:** `migrations/20250920035519_*.sql`, confirmado no `baseline.sql:31629-31645`

As políticas finais no baseline para o schema legado crm_* são `FOR ALL USING(true)`:

```sql
CREATE POLICY "leads_access_policy"  ON crm_leads  FOR ALL USING (true);
CREATE POLICY "pessoas_access_policy" ON crm_pessoas FOR ALL USING (true);
CREATE POLICY "empresas_access_policy" ON crm_empresas FOR ALL USING (true);
-- + 15 outras tabelas crm_*
```

**Contexto:** No modelo project-per-tenant cada tenant tem DB isolado, logo `USING(true)` é seguro se o projeto nunca misturar tenants. A migration `20260312170000_ensure_crm_tenants_baseline.sql` (enviada apenas a tenant-projects via client-migrations.json) cria RLS baseado em JWT claim correto. Porém:

1. O baseline (aplicado no control plane) mantém `USING(true)` como estado permanente.
2. Se um tenant-project receber o baseline.sql diretamente (sem client-migrations.json), ficará sem isolamento real.
3. A migration de correção `20260312170000_ensure_crm_tenants_baseline` cria apenas `crm_tenants_select_own`, não corrige `crm_leads`, `crm_pessoas`, `crm_empresas`.

**Risco:** Tenant-projects provisionados com baseline.sql + migração parcial expõem dados de todos os usuários internos do tenant entre si (sem filtro de `user_id`).

---

### DB-P0-003 — prospect_campaigns sem tenant_id até migration 20260422000700 (backfill condicional)

**Arquivo:** `supabase/migrations/20260422000700_prospect_tenant_isolation.sql`

O Prospect PRO operou **sem RLS de tenant** desde sua criação (`20260318200000_prospect_pro_v2.sql`) até a migration `20260422000700` aplicada em 2026-04-22. As políticas originais eram `FOR ALL USING (true)` sem filtro de tenant.

O backfill é condicional:
```sql
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='crm_usuarios') THEN
  UPDATE prospect_campaigns SET tenant_id = cu.tenant_id FROM crm_usuarios cu ...
END IF;
```

Se `crm_usuarios` não existir (novo schema), campanhas existentes ficam com `tenant_id = NULL`, bloqueando SELECT via a nova RLS policy `USING(user_has_tenant_access(tenant_id))` — onde `NULL` retorna `false`.

**Risco:** Campanhas Prospect criadas entre 20260318 e 20260422 em tenants que migraram para novo schema ficam inacessíveis sem correção manual.

---

## P1 — Sérios

### DB-P1-001 — 101 DROP statements sem IF EXISTS

**Arquivo:** múltiplas migrations em supabase/migrations/

```bash
grep -rn "DROP TABLE\|DROP COLUMN" migrations/ | grep -v "IF EXISTS" | wc -l
# → 101
```

Exemplos críticos:
```sql
-- migrations/20250625182017-...-ok.sql:160
DROP TABLE empresa_mapping, pessoa_mapping, pipeline_mapping, stage_mapping, lead_mapping;
DROP TABLE backup_empresas, backup_pessoas, backup_pipelines, backup_stages, backup_leads, backup_messages;
-- migrations/20250624155147-...-ok.sql:24
DROP TABLE public.usuarios;
```

Se qualquer uma dessas migrations for reexecutada (ex: restore de backup + reapply incremental) ou aplicada em tenant que não passou pelas migrations anteriores, causará `ERROR: table does not exist` e abortará o bloco.

**Fix:** Converter para `DROP TABLE IF EXISTS` ou garantir que as migrations são aplicadas apenas sequencialmente via adm-sync-client (que é o atual comportamento — mas é um risco latente).

---

### DB-P1-002 — Schema legado crm_* paralelo ao moderno sem migration de dados

**Tabelas paralelas identificadas:**

| Schema legado | Schema moderno | Dados migrados? |
|---|---|---|
| `crm_pessoas` | `clients_people` | Não |
| `crm_leads` | `leads` | Não |
| `crm_messages` | `messages` | Não |
| `crm_empresas` | `clients_companies` | Não |
| `crm_agendamentos` | `meetings` | Não |
| `crm_pipelines` + `crm_stages` | `leads_pipelines` + `leads_stages` | Não |

Edge functions usam exclusivamente o schema moderno. Frontend usa o schema legado (CRM PRO) e schema moderno (Coach, Sends, Schedule, Prospect). Dois conjuntos de dados divergentes existem em paralelo, com nenhuma sincronização detectada.

**Risco:** Inconsistência de dados — um contato em `crm_pessoas` e outro em `clients_people` para o mesmo usuário real. Sem migration de dados documentada.

---

### DB-P1-003 — RealtimeContext subscreve a tabelas legadas e modernas simultaneamente

**Arquivo:** `src/contexts/RealtimeContext.tsx:126-140`

```tsx
.on('postgres_changes', { table: 'crm_pessoas', filter: `tenant_id=eq.${tenantId}` }, ...)
.on('postgres_changes', { table: 'crm_leads',   filter: `tenant_id=eq.${tenantId}` }, ...)
```

O canal usa `tenant_id` filter — correto para tabelas crm_*. Mas no modelo project-per-tenant, o `tenant_id` pode não estar populado (ver DB-P0-002). Se a tabela tiver `USING(true)` mas os dados não tiverem `tenant_id`, a subscrição com `filter: tenant_id=eq.X` retornará 0 eventos.

**Risco:** Invalidação de cache silenciosamente falha — UI não atualiza em tempo real para os módulos CRM.

---

### DB-P1-004 — get_current_user_tenant_id() misturada com user_has_tenant_access() sem consistência

As tabelas do schema legado (crm_*) e moderno usam funções RLS diferentes:

| Função | Usada em | Tipo |
|---|---|---|
| `current_setting('app.current_tenant_id')::uuid` | Policies legadas (pré-2025-08) | set_config por sessão |
| `get_current_user_tenant_id()` | crm_* policies modernas + prospect | JWT claim |
| `user_has_tenant_access(uuid)` | crm_empresas, prospect | JWT claim |
| `get_current_settings_user_id()` | settings_users, coach | user_id lookup |

Algumas tabelas ainda têm políticas sobrepostas — ex: `crm_leads` tem policies criadas e droppadas múltiplas vezes (6 versões diferentes no baseline), com a última sendo `USING(true)`. O estado final depende da ordem de execução no banco real.

**Fix:** Auditoria no banco vivo com `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename IN ('crm_leads', 'crm_pessoas', 'crm_empresas')` para confirmar o estado real.

---

### DB-P1-005 — Migration lp_ (lp_pages, lp_ab_tests) recebeu índices em FK depois de ser droppada

**Arquivos:**
- `20260227110001_add_fk_indexes-ok.sql` — adiciona `idx_lp_pages_form_id`, `idx_lp_ab_tests_created_by`, etc.
- `20260310000000_form_pro_drop_lp_pages-ok.sql` — dropa `lp_ab_variants`, `lp_form_submissions`, `lp_pages`

O manifest ordena: `20260227` antes de `20260310`, logo os índices são criados e depois droppados com as tabelas. Isso é correto. Porém a migration `20260312120000_db_cleanup_audit.sql` menciona funções órfãs dessas tabelas — indicando que o cleanup foi necessário. Não é uma regressão ativa, mas evidencia risco residual de objetos dependentes não rastreados.

---

## P2 — Técnicos/Melhorias

### DB-P2-001 — Triggers de tracking de leads com colunas pré-rename não atualizados

**Arquivo:** `supabase/migrations/20260319500000_fix_track_leads_changes_schema_mismatch.sql`

A migration P6 (`20260227140000`) renomeou colunas:
- `leads.users_id` → `user_id`
- `leads_updates.leads_id` → `lead_id`
- `meetings.leads_id` → `lead_id`

Três trigger functions não foram atualizadas: `track_leads_changes`, `track_meeting_changes`, `track_leads_updates_changes`. A migration `20260319500000` corrige isso com `CREATE OR REPLACE FUNCTION` — porém existe como arquivo duplicado (ver DB-P0-001).

---

### DB-P2-002 — book_meeting() com overload legado (colunas date/time inexistentes)

**Arquivo:** `supabase/migrations/20260312120000_db_cleanup_audit.sql`

O overload `book_meeting(uuid, uuid, text, timestamptz, int, text)` referencia colunas `date DATE` e `start_time TIME` que foram removidas. A migration de cleanup dropa o overload. Se o bloco não for executado (ex: migration falhar a meio), a função retorna erro em runtime sem mensagem clara.

---

### DB-P2-003 — prospect_audit_log.establishment_id: FK removida mas coluna mantida sem índice

**Arquivo:** `supabase/migrations/20260422000600_prospect_drop_v1_tables.sql`

```sql
ALTER TABLE public.prospect_audit_log
  DROP CONSTRAINT IF EXISTS prospect_audit_log_establishment_id_fkey;
-- coluna establishment_id mantida, FK removida
```

A coluna `establishment_id` existe sem índice e sem FK. Queries que filtram por ela fazem seq scan. Não é crítico (audit log é append-only), mas ocupa espaço e pode confundir futuros devs.

---

### DB-P2-004 — Índices `idx_leads_notes_users_id` renomeados mas antigos não droppados explicitamente

**Arquivo:** `supabase/migrations/20260312120000_db_cleanup_audit.sql:345-356`

```sql
DROP INDEX IF EXISTS public.idx_leads_notes_users_id;  -- correto
CREATE INDEX IF NOT EXISTS idx_leads_notes_user_id ON leads_notes(user_id);
```

A migration `20260227110001_add_fk_indexes` criou `idx_leads_notes_users_id` com nome antigo (pré-rename). A cleanup corrige. Porém não há verificação de `idx_leads_files_users_id` na tabela `leads_files` — se a migration `20260312` não rodou em algum tenant antes de `20260227`, a inconsistência persiste.

---

### DB-P2-005 — `_meta_debug` sem RLS até migration 20260312 (mencionado como único sem RLS)

**Arquivo:** `supabase/migrations/20260312120000_db_cleanup_audit.sql:266`

```
-- BLOCO 7 — _meta_debug: habilitar RLS (única tabela sem RLS no schema)
```

A migration habilita RLS na `_meta_debug`. Tenants provisionados antes de 20260312 sem essa migration têm a tabela sem RLS — expondo dados de debug a qualquer usuário autenticado.

---

### DB-P2-006 — omni_delivery_dead_letter sem UNIQUE em message_id até migration 20260319100001

**Arquivo:** `supabase/migrations/20260319100001_fix_dead_letter_unique_message_id.sql`

O delivery engine usava `upsert` com `onConflict: 'message_id'` mas a coluna não tinha UNIQUE constraint — levando ao insert duplicado silencioso. Corrigido pela migration, mas evidencia ausência de constraint-driven design na tabela original.

---

## Tabelas sem RLS identificadas (não-críticas no modelo project-per-tenant)

As seguintes tabelas têm `ENABLE ROW LEVEL SECURITY` em migrations iniciais sem policy correspondente na mesma migration — políticas são adicionadas em migrations subsequentes. Não é um problema no fluxo sequencial atual, mas seria crítico se qualquer migration do par falhasse:

- `project_task_attachments` (políticas em 20260126174820)
- `user_calendar_connections` (sem policy identificada em migrations — requer verificação no banco vivo)
- `meeting_records` (sem policy identificada — requer verificação no banco vivo)

---

## Índices — Estado Atual

### Cobertos adequadamente
- `crm_leads`: 6 índices compostos (`tenant_id`, `status`, `pipeline_id`, `stage_id`, `person_id`, `empresa_id`)
- `crm_messages`: `tenant_id`, `lead_id`, `pessoa_created`
- `sends_contacts`: `send_id`, `people_id`, `status`
- `meetings`: `people_id`, `leads_id`, `users_id`, `start_time`
- `prospect_people`: 6 índices parciais (campaign_id, status, email, person_id, etc.)

### Gaps identificados
- `meeting_followup_queue.followup_id` — sem índice até 20260227 (corrigido)
- `user_calendar_connections` — sem índice em `user_id` identificado em migrations
- `omni_delivery_dead_letter.message_id` — era índice simples, agora UNIQUE constraint (correto)

---

## Recomendações por Prioridade

**P0 — Ação imediata:**
1. Renomear os 2 pares de migrations com timestamp conflitante (`20260319100001`, `20260319100002`) para timestamps únicos.
2. Confirmar no banco vivo o estado real das políticas RLS de `crm_leads`, `crm_pessoas`, `crm_empresas` com `SELECT * FROM pg_policies WHERE tablename IN (...)`.
3. Verificar campanhas Prospect com `tenant_id IS NULL` e executar backfill manual se necessário.

**P1 — Curto prazo:**
4. Definir estratégia de migration de dados entre schema legado (crm_*) e moderno (clients_people, leads).
5. Converter 101 DROPs sem IF EXISTS nas migrations de maior risco (as que droppam tabelas inteiras).
6. Corrigir RealtimeContext para verificar qual schema está ativo antes de subscrever tabelas legadas.

**P2 — Melhorias:**
7. Adicionar índice em `user_calendar_connections.user_id`.
8. Documentar `establishment_id` em `prospect_audit_log` como coluna legada ou remover.
9. Auditoria de `meeting_records` e `user_calendar_connections` para confirmar RLS policies.
