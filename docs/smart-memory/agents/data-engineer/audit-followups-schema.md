---
title: Auditoria Schema — Followup / Stage / Pipeline
type: audit
agent: dev-data-engineer
updated: 2026-04-27
tags: [database, schema, followup, pipeline, stage, audit]
related: [[schema]], [[migrations-log]]
---

# Auditoria: Followup / Stage / Pipeline

## 1. Tabelas Mapeadas

### 1.1 Pipeline e Stages (tabelas ativas)

| Tabela | PK | Schema | Status |
|---|---|---|---|
| `leads_pipelines` | uuid | moderno (snake_case) | **Ativa** |
| `leads_stages` | uuid | moderno | **Ativa** |
| `leads_stages_followups` | uuid | moderno | **Ativa** |

**`leads_stages_followups`** — colunas acumuladas via ALTER TABLE ao longo do tempo:

| Coluna | Tipo | Origem | Uso atual |
|---|---|---|---|
| `id` | uuid PK | 20251005 | sim |
| `leads_stages_id` | uuid FK | 20251005 | sim |
| `stage_id` | uuid FK | 20251110/20251202 | **duplicata de `leads_stages_id`** (schema diferente) |
| `type` | text | 20251005 | sim |
| `message` | text | 20251005 | sim |
| `subject` | text | 20251005 | sim |
| `template_id` | text | 20251005 | sim (legado, texto livre) |
| `audio_file` | text | 20251005 | sim |
| `days` | integer | 20251005 | sim |
| `hours` | integer | 20251005 | sim |
| `minutes` | integer | 20251005 | sim |
| `active` | boolean | 20251005 | sim |
| `score_matrix_id` | uuid FK | 20251103 | sim — filtra followup por score |
| `target_stage_id` | uuid FK | 20251103 | sim — move lead após envio |
| `control` | integer | 20251107 | **suspeito** — comentário "routing N8N"; nunca lido pelo frontend |
| `delay_minutes` | integer | 20251202 | **conflito**: apenas em schema alternativo; não usado na path ativa |
| `whatsapp_template_id` | text | 20251202 | sim (legado, texto) |
| `name` | text | 20251202 | presente em schema alternativo |

> **Achado crítico:** `leads_stages_followups` tem dois schemas conflitantes — a migration 20251005 cria com `leads_stages_id` e campos `type/days/hours/minutes`; a migration 20251202 cria com `stage_id` e `delay_minutes`. Ambas usam `CREATE TABLE IF NOT EXISTS`, então apenas uma se aplica dependendo da ordem de execução. O código frontend usa `leads_stages_id` (via `StageFollowupsCard`).

---

### 1.2 Meeting Followups (tabelas ativas)

| Tabela | PK | Status |
|---|---|---|
| `meetings_followups` | uuid | **Ativa** — regras de followup por status de reunião |
| `meeting_followup_queue` | uuid | **Ativa** — fila processada pelo pg_cron a cada 5 min |

**`meetings_followups`** — colunas finais após todas as migrations:

| Coluna | Tipo | Adicionada em | Uso atual |
|---|---|---|---|
| `id` | uuid PK | 20251005 | sim |
| `meeting_status` | text CHECK | 20251005 | sim |
| `type` | text | 20251005 | sim |
| `message` | text | 20251005 | sim |
| `subject` | text | 20251005 | sim |
| `template_id` | text | 20251005 | **legado** — substituído por `whatsapp_template_id` |
| `audio_file` | text | 20251005 | sim |
| `days/hours/minutes` | integer | 20251005 | sim |
| `active` | boolean | 20251005 | sim |
| `control` | integer | 20260226 | **suspeito** — `routing N8N (step execution)` per COMMENT; nunca lido pelo frontend |
| `name` | text | 20260226 | sim |
| `channel` | text CHECK | 20260226 | sim |
| `webhook_url` | text | 20260226 | **suspeito** — "URL do webhook que receberá o disparo (ex: N8N)"; substituído por `whatsapp_template_id` na maioria dos casos |
| `whatsapp_template_id` | uuid FK | 20260317 | sim — FK para `whatsapp_templates` |

> **Achado crítico:** `meetings_followups.webhook_url` é o mecanismo legado de disparo via N8N. A migration 20260301 (`meeting_followup_system`) criou a integração N8N; a migration 20260317 adicionou suporte a templates WA. O trigger `handle_meeting_followup_queue` agora aceita regras com `webhook_url` OU `whatsapp_template_id`, mas o campo `webhook_url` está exposto no frontend (CallProFollowupsConfig) e continua funcional.

**Constraint instável em `meetings_followups.meeting_status`:**
- 20251005: `CHECK IN ('agendado', 'compareceu', 'nao_compareceu', 'cancelado')`
- 20260309: migrou para `'não compareceu'` (com espaço/acento)
- 20260315: reverteu para `'nao_compareceu'` e adicionou `'realizado'`

> **Achado crítico:** Há inconsistência entre o valor no banco (`nao_compareceu`) e o label do frontend (`'não compareceu'` em `STATUS_LABELS` em `AgendamentoFollowupModal.tsx`). A constraint final aceita `nao_compareceu` mas o frontend envia `'não compareceu'`.

---

### 1.3 Fila de Stage Followups

| Tabela | PK | Status |
|---|---|---|
| `followup_queue` | uuid | **Ativa** — fila de disparos por stage |

**`followup_queue`** — colunas:

| Coluna | Tipo | Observação |
|---|---|---|
| `followup_id` | uuid FK → `leads_stages_followups` | pode ser null (meeting source) |
| `meeting_followup_id` | uuid FK → `meetings_followups` | pode ser null (stage source) |
| `lead_id` | uuid FK → `leads` | renomeado de `leads_id` em 20260227 |
| `person_id` | uuid FK → `clients_people` | renomeado de `pessoa_id` em 20260227 |
| `canal` | text | **ainda em português** — inconsistente com esquema moderno |
| `mensagem` | text | renomeado para `message` em 20260227 |
| `scheduled_at` | timestamptz | atenção: `meeting_followup_queue` usa `scheduled_for` |
| `source_type` | text CHECK('stage','meeting') | ok |
| `status` | text CHECK('pending','queued','sent','failed','cancelled') | ok |
| `response_data` | jsonb | apenas N8N response dump |
| `retry_count` | integer | sem lógica de retry implementada no edge function |

> **Achado:** `followup_queue` usa `scheduled_at`, enquanto `meeting_followup_queue` usa `scheduled_for`. Nomes diferentes para o mesmo conceito — risco de bug ao unificar queries.

---

### 1.4 Tabelas Legadas (sem uso ativo)

| Tabela | Criada em | Status | Motivo suspeito |
|---|---|---|---|
| `crm_pipelines` | 20250624 | **Legada** | Substituída por `leads_pipelines`; apenas citada em `useStubsAll.ts` como stub |
| `crm_stages` | 20250624 | **Legada** | Substituída por `leads_stages`; apenas em stub |
| `crm_stage_followups` | 20250627 | **Legada/Morta** | Nenhum uso no frontend ou edge functions |
| `crm_agendamentos_followups` | 20250701 | **Legada/Morta** | Nenhum uso no frontend ou edge functions |
| `crm_campos_personalizados` | 20250624 | **Legada/Morta** | Nenhum uso identificado |
| `clients_meetings_followups` | 20251006 | **Morta** | Criada mas nunca referenciada em frontend ou functions |
| `n8n_chat_histories` | 20250920 | **Dropada** | Explicitamente removida em 20251005 |

---

### 1.5 Colunas suspeitas em `leads`

| Coluna | Tipo | Uso |
|---|---|---|
| `followup_attempts` | integer DEFAULT 0 | Presente no tipo TypeScript, mas **nunca escrito** pelo frontend — apenas declarado na interface |
| `followup_status` | text | Idem — nunca atualizado por nenhum hook ou edge function |
| `external_crm_lead_id` | text | Legado de integração CRM externa; sem uso atual |
| `fb_lead_id` | text | Aparece em tipo mas não em migration consolidada |

---

## 2. Colunas N8N-Related (suspeitas/obsoletas)

| Tabela | Coluna | COMMENT | Status |
|---|---|---|---|
| `leads_stages_followups` | `control` | "Número de controle para routing N8N (step execution)" | **Obsoleto** — nunca lido pelo frontend; N8N foi substituído por edge functions |
| `meetings_followups` | `control` | mesma semântica | **Obsoleto** |
| `meetings_followups` | `webhook_url` | "URL do webhook que receberá o disparo (ex: N8N)" | **Parcialmente ativo** — ainda usado por `CallProFollowupsConfig.tsx`; mas novo path usa templates WA |
| `ai_agents` | `score_value` | "Valor de score para matching via n8n (não é FK)" | **Legado** — matching feito direto no schema agora |
| `followup_queue` | `response_data` | dump de response N8N | **Legado** — não lido pelo frontend |

---

## 3. Edge Functions Mapeadas

### Ativas e chamadas pelo frontend

| Função | Chamada por | O que faz |
|---|---|---|
| `followup-enqueue` | `useFollowupEnqueue`, `useUpdateNegocioStage`, `useAgendamentos` | Cria jobs em `followup_queue` quando lead muda de stage ou reunião muda de status |
| `followup-trigger-worker` | pg_cron + `useFollowupEnqueue` | Lê `followup_queue` (pending + scheduled_at <= now()), faz POST para webhook N8N, atualiza status → `queued` |
| `followup-status-callback` | N8N (callback) | Recebe resultado do disparo N8N, atualiza `followup_queue.status` e insere em `messages` |
| `process-meeting-followups` | pg_cron a cada 5 min | Lê `meeting_followup_queue`, despacha via webhook N8N ou diretamente para AS (ligações) ou WA template |
| `meeting-followup-auto-setup` | `useMeetingFollowupAutoSetup` | Cria templates WA + regras `meetings_followups` automaticamente |
| `dispara-webhook` | hooks de lead | Dispara webhooks genéricos da tabela `webhooks` por tipo de evento |

### Potencialmente ociosas ou com dependência N8N

| Função | Observação |
|---|---|
| `followup-trigger-worker` | **Depende de N8N**: busca `webhooks` com `event_type='followup'` e faz POST. Se N8N não estiver configurado, retorna 200 com `processed: 0` silenciosamente |
| `followup-status-callback` | **Acoplada ao N8N**: N8N deve chamar este callback após disparo. Sem N8N, o status da `followup_queue` fica em `queued` forever |
| `process-meeting-followups` | Dual path: ligações → AS direto; outros canais → webhook N8N. Funciona sem N8N apenas para ligações AS |

---

## 4. Migrations Problemáticas

| Migration | Problema |
|---|---|
| `20250624162931` | Cria `crm_pipelines` e `crm_stages` (esquema legado com `cliente_id` e `tenant_id`) que nunca foram usados em produção |
| `20250627180838` | Cria `crm_stage_followups` — tabela morta, nunca referenciada além desta migration |
| `20250701071851` | Cria `crm_agendamentos_followups` — tabela morta |
| `20251005205003` | Recria `leads_stages_followups` com schema A (leads_stages_id) |
| `20251110183840` | Recria mesma tabela com schema B (stage_id + delay_minutes) via `IF NOT EXISTS`; resultado depende de qual foi aplicada primeiro |
| `20251202180828` | Terceira definição de `leads_stages_followups`, novo schema — potencial conflito silencioso |
| `20260226100000` | `control` adicionado com COMMENT explícito "routing N8N" — indício de que o campo era temporário para integração N8N |
| `20260226301000` | Embeds service_role JWT hardcoded no `pg_cron.schedule()` |
| `20260309000000` | Altera constraint para `'não compareceu'` (com acento) |
| `20260315210000` | Reverte para `'nao_compareceu'` e adiciona `'realizado'` — estado atual inconsistente com label frontend |

---

## 5. Achados Críticos

### CRITICO-1: JWT hardcoded em migration de pg_cron
**Arquivo:** `20260226301000_meeting_followup_system-ok.sql:207`  
O service_role JWT está embutido em claro no SQL do `cron.schedule`. Qualquer pessoa com acesso ao histórico de migrations tem a chave.

### CRITICO-2: `leads_stages_followups` tem schema ambíguo
Três migrations criam a mesma tabela com schemas diferentes. Se aplicadas em ambientes distintos (dev, staging, prod), as colunas podem diferir silenciosamente.

### CRITICO-3: `followup_queue` fica em estado `queued` se N8N offline
`followup-trigger-worker` muda status para `queued` antes de receber confirmação de N8N. Se N8N não responder e `followup-status-callback` não for chamado, a fila fica em `queued` para sempre sem retry automático (campo `retry_count` existe mas a lógica de retry não foi implementada).

### CRITICO-4: Inconsistência de status `nao_compareceu`
O CHECK constraint final aceita `nao_compareceu` (sem acento), mas o frontend (`AgendamentoFollowupModal.tsx:STATUS_LABELS`) define `'não compareceu'` como chave do tipo `MeetingStatus`. Isso pode causar falha silenciosa ao criar regras com esse status.

### ATENCAO-1: Tabelas mortas acumulando no schema
`crm_stage_followups`, `crm_agendamentos_followups`, `clients_meetings_followups` — três tabelas de followup nunca referenciadas pelo código atual. Aumentam complexidade e enganam inspeção de schema.

### ATENCAO-2: `followup_queue` tem nomenclatura inconsistente
- `canal` (português) vs padrão moderno `channel`
- `scheduled_at` vs `scheduled_for` em `meeting_followup_queue`
- FK legada `pessoa_id` renomeada mas mantida em tipos TypeScript como `person_id` e como coluna FK `meeting_followup_queue.people_id` (plural)

### ATENCAO-3: `leads.followup_attempts` e `leads.followup_status` são phantom fields
Presentes no tipo TypeScript e na migration de refatoração (20251005), mas **nunca escritos** por nenhum hook, edge function ou trigger. Dado morto que pode confundir futuros devs.

---

## 6. Resumo por Ação Recomendada

| Ação | Tabelas/Colunas | Prioridade |
|---|---|---|
| DROP tabelas mortas | `crm_stage_followups`, `crm_agendamentos_followups`, `clients_meetings_followups`, `crm_pipelines`, `crm_stages`, `crm_campos_personalizados` | Alta |
| Remover colunas N8N obsoletas | `leads_stages_followups.control`, `meetings_followups.control` | Média |
| Avaliar `webhook_url` em `meetings_followups` | Manter se N8N ainda em uso por algum cliente; senão deprecar | Média |
| Corrigir inconsistência `nao_compareceu` | Frontend ou constraint | Alta |
| Rotacionar JWT hardcoded no pg_cron | `20260226301000` — revogar key atual | **Urgente** |
| Remover phantom fields | `leads.followup_attempts`, `leads.followup_status` | Baixa |
| Resolver schema ambíguo | `leads_stages_followups` — definir versão canônica | Alta |
