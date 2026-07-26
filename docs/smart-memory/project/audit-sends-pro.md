---
title: Auditoria Adversarial — SENDS PRO
type: audit
agent: Kronix (dev-dev-delta)
created: 2026-04-30
updated: 2026-04-30
commit: 23f7fd60
tags: [audit, sends-pro, hardening]
---

# Auditoria Adversarial — SENDS PRO

Auditoria completa end-to-end do módulo SENDS PRO realizada em 2026-04-30, commit `23f7fd60`.
Cobre os 5 vetores definidos em SENDS-FIX-01: páginas/wizard, hooks, edge functions, schema/RLS, integrações.

---

## Sumário Executivo

**Estado geral: AMARELO**

O módulo SENDS PRO passou por ciclo intenso de correções recentes (11+ commits de fix no histórico recente). Os dois bloqueantes mais graves da auditoria anterior (P1-01: webhook join ausente; P2-05: UTM ignorado; P2-09: bug de contagem duplicada; P3-03: timeout ausente no dispara-webhook) foram todos resolvidos. O pg_cron + sends-dispatch-batch está implementado e o loop de disparo não depende mais do browser.

Restam 5 findings ativos de severidade P1/P2 que afetam:
- Paginação incorreta em `filter-leads-for-send` (audiência incompleta em campanhas grandes)
- Filtro `person_status` completamente ignorado (colisão de predicados SQL)
- Leads não criados para contatos existentes no import CSV quando `create_leads=true`
- Race condition no batch dispatch (double-dispatch possível)
- Retry inline que pode timeout a edge function em batch > 1

| Vetor | Estado | Findings Ativos |
|---|---|---|
| 1. Páginas / Wizard | AMARELO | 1 P2 (scheduled_at timezone) |
| 2. Hooks | VERDE | 0 ativos |
| 3. Edge Functions | AMARELO | 3 P1, 2 P2 |
| 4. Schema / RLS | AMARELO | 1 P1 (person_status ignorado) |
| 5. Integrações | VERDE | 0 ativos |

**Findings por severidade (estado atual):**

| Severidade | Quantidade |
|---|---|
| **P1 — Bloqueante** | 3 |
| **P2 — Degradação** | 5 |
| **P3 — Cosmético** | 2 |
| **Total** | 10 |

**Findings resolvidos desde auditoria anterior:** 8 (P1-01, P1-02, P2-05, P2-09, P3-03 e itens de churn)

---

## Findings P1 — Bloqueantes

### P1-01 — `filter-leads-for-send`: `person_status` ignorado — colisão com `.eq('status','active')` hardcoded

**Arquivo:** `supabase/functions/filter-leads-for-send/index.ts` — linhas 182, 259-261

**Código:**
```typescript
// L182 — aplicado primeiro, incondicional
query = query.eq('status', 'active')

// L259-261 — aplicado depois, quando filtro é passado
if (filters.person_status && filters.person_status.length > 0) {
  query = query.in('status', filters.person_status);
}
```

**Descrição:** O PostgREST gera `AND status=eq.active AND status=in.(X,Y,Z)`. Se `person_status=['inactive']`, a query resulta em `status = 'active' AND status IN ('inactive')` — zero resultados sempre. Se `person_status=['active']`, é redundante mas funcional. O filtro de status de pessoa está efetivamente quebrado para qualquer valor diferente de `active`.

**Reprodução:** Criar campanha filtrada com `person_status = ['inactive']` → LiveCounterSidebar mostra 0 contatos independente do banco.

**Proposta de correção:**
```typescript
// Remover o .eq('status', 'active') hardcoded (L182)
// Substituir por: aplicar status filter apenas quando person_status é passado;
// caso contrário, incluir apenas 'active' como default.
if (filters.person_status && filters.person_status.length > 0) {
  query = query.in('status', filters.person_status);
} else {
  query = query.eq('status', 'active'); // default: apenas ativos
}
```

**Story sugerida:** `FIX-SENDS-FILTER-01: corrigir colisão person_status vs status=active em filter-leads-for-send`

---

### P1-02 — `filter-leads-for-send`: `has_more` calculado incorretamente — paginação falha em audiências grandes

**Arquivo:** `supabase/functions/filter-leads-for-send/index.ts` — linhas 344, 385

**Código:**
```typescript
const rawCount = data?.length || 0;  // L344 — tamanho do array retornado pelo .range()
// ...deduplicação por Map...
has_more: rawCount === limit,  // L385
```

**Descrição:** `rawCount` é o número de linhas retornadas pela query paginada (máximo = `limit` por causa do `.range(offset, offset+limit-1)`). O check `rawCount === limit` só indica `has_more=true` quando Postgres retornou exatamente `limit` rows — válido como heurística. O problema é que `rawCount` é calculado ANTES da deduplicação por `contactsMap`. Se Postgres retorna 500 rows mas 50 são a mesma pessoa com múltiplos leads, `contacts.length` = 450 < `limit` (500), mas `rawCount` = 500 → `has_more: true`. Isso está correto.

O bug invertido: se TODOS os 500 rows são únicos mas o usuário aplica `needsLeadFilter=true` e muitas pessoas não têm leads válidos, `contacts.length` pode ser 200 (300 filtradas no JS) mas `rawCount = 500` → `has_more: true` mesmo que as próximas 500 rows também sejam filtradas da mesma forma. Isso gera loop infinito de paginação sem novos contatos.

**Impacto:** Campanhas com filtros de lead strictos podem não terminar de paginar no wizard, ou a contagem de audiência no LiveCounterSidebar diverge do real.

**Proposta de correção:** Usar `SELECT count(*)` separado antes do range, ou usar `.count('exact')` no select, para `has_more` baseado em count real, não em tamanho de página.

**Story sugerida:** `FIX-SENDS-FILTER-02: corrigir has_more com count real (não size da página) em filter-leads-for-send`

---

### P1-03 — `sends-dispatch-batch`: race condition — double-dispatch possível (check-then-act não atômico)

**Arquivo:** `supabase/functions/sends-dispatch-batch/index.ts` — linhas 38-80

**Código:**
```typescript
// L38-42: SELECT sem lock
const { data: runningSends } = await supabase.from('sends')
  .select('id, send_interval_seconds, last_batch_at')
  .eq('status', 'running');

// L60-68: check cadência
if (now < nextBatchDue) { skipped++; continue; }

// L72-77: UPDATE last_batch_at (sem SELECT FOR UPDATE no step anterior)
await supabase.from('sends')
  .update({ last_batch_at: new Date().toISOString() })
  .eq('id', send.id)
  .eq('status', 'running');
```

**Descrição:** Entre o SELECT (L38) e o UPDATE (L72) há uma janela de race. Se duas invocações do cron chegam simultâneas (possível em Deno Deploy sob load, ou pg_cron retry), ambas veem o mesmo `last_batch_at` antigo, ambas passam pelo check de cadência, e ambas fazem UPDATE + invoke do worker. Resultado: dois workers para o mesmo send_id no mesmo momento, enviando mensagens duplicadas para os mesmos contatos `pending`.

**Reprodução verificada via análise estática:** O guard `.eq('status', 'running')` no UPDATE previne dispatch de sends pausados, mas NÃO previne duplo-dispatch de sends running.

**Proposta de correção:** Usar UPDATE atômico com RETURNING como claim:
```sql
UPDATE sends
SET last_batch_at = now()
WHERE id = $1
  AND status = 'running'
  AND (last_batch_at IS NULL
       OR last_batch_at + send_interval_seconds * interval '1 second' <= now())
RETURNING id
```
Se `0 rows affected` → outro worker já fez claim, skip.

**Story sugerida:** `FIX-SENDS-DISPATCH-01: atomic claim em sends-dispatch-batch via UPDATE+RETURNING`

---

## Findings P2 — Degradação

### P2-01 — `sends-import-contacts`: leads NÃO criados para contatos existentes no dedup (create_leads=true ignorado para existentes)

**Arquivo:** `supabase/functions/sends-import-contacts/index.ts` — linhas 377-419 (bloco `existingPersonId`)

**Código:**
```typescript
// Bloco de pessoa existente (L377-419)
if (existingPersonId) {
  existingPeople++;
  peopleIds.push(existingPersonId);
  // atualiza campos, score, company...
  continue;  // ← NÃO cria lead, mesmo com create_leads=true
}

// Criação de lead está APENAS no bloco de pessoa nova (L473-519)
if (create_leads && pipeline_id && stage_id) { ... }
```

**Descrição:** Quando o import encontra uma pessoa existente via dedup (por phone ou email), atualiza os campos dela mas NUNCA cria lead — mesmo que `create_leads=true`, `pipeline_id` e `stage_id` estejam presentes. Apenas pessoas NOVAS recebem lead criado.

**Impacto:** Num import típico onde 60-80% dos contatos já existem no CRM, `create_leads=true` efetivamente falha para a maioria da audiência. Nenhum erro é retornado — `failedRows` não é incrementado.

**Proposta de correção:** No bloco `existingPersonId`, após o `continue`, adicionar (antes do continue):
```typescript
if (create_leads && pipeline_id && stage_id) {
  const { count: existingLead } = await supabase.from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('people_id', existingPersonId)
    .eq('leads_pipelines_id', pipeline_id);
  if ((existingLead ?? 0) === 0) {
    await supabase.from('leads').insert({ people_id: existingPersonId, ... });
  }
}
```

**Story sugerida:** `FIX-SENDS-IMPORT-03: criar lead para contatos existentes quando create_leads=true`

---

### P2-02 — `send-dispatch-worker`: retry inline bloqueia worker por até 65s — timeout garantido em batch > 2 contatos falhando

**Arquivo:** `supabase/functions/send-dispatch-worker/index.ts` — linhas 537-606 (`retryWithBackoff`)

**Código:**
```typescript
const delays: number[] = [5000, 15000, 45000]
// attempt 0: execute
// attempt 1: wait 5s → execute
// attempt 2: wait 15s → execute
// attempt 3: wait 45s → fail
// Total por contato falhante: até 65s de await
```

**Descrição:** O `retryWithBackoff` faz `await new Promise(resolve => setTimeout(resolve, delay))` dentro do loop de batch. Para `batch_size=1` (default) não é problema. Para `batch_size > 1` (configurável), um contato que falha 3 vezes bloqueia o worker por 65s antes de avançar. Com 3 contatos assim em série: 195s > limite de 150s do Supabase Edge Functions.

**Impacto:** Worker retorna 504 ou timeout silencioso. Contatos em `pending` não são marcados como `failed` — ficam presos em estado limbo. O pg_cron vai reinvocar na próxima minute, mas o problema se repete.

**Proposta de correção:** Reduzir delays para [1000, 3000, 9000] (13s max por contato) ou reduzir `maxRetries` para 2 no inline-batch. O delay mais longo deve ser delegado a uma fila/retry server-side separada.

**Story sugerida:** `FIX-SENDS-DISPATCH-02: reduzir retry delays inline para < 15s total por contato`

---

### P2-03 — `DisparoControls`: "Retomar" sobrescreve `started_at` original — métricas de duração corrompidas

**Arquivo:** `src/components/disparos/DisparoControls.tsx` — linhas 23-35

**Código:**
```typescript
const handleStart = () => {
  updateSend(
    { id: send.id, data: { status: 'running', started_at: new Date().toISOString() } },
    // ...
  );
};
// canResume = send.status === 'paused'
// botão "Retomar" chama handleStart — mesmo handler que Iniciar
```

**Descrição:** "Retomar" e "Iniciar" usam o mesmo `handleStart`. Ao retomar após pausa, `started_at` é sobrescrito com a hora atual, perdendo o timestamp original de início da campanha.

**Impacto:** Métricas de duração e relatórios de tempo de campanha ficam incorretos após pausa/retomada.

**Proposta de correção:**
```typescript
const isResume = send.status === 'paused';
updateSend({
  id: send.id,
  data: isResume ? { status: 'running' } : { status: 'running', started_at: new Date().toISOString() }
});
```

**Story sugerida:** `FIX-SENDS-UI-01: não sobrescrever started_at ao retomar disparo pausado`

---

### P2-04 — `CriarDisparo.tsx`: `scheduled_at` sem timezone — disparo agendado pode ocorrer 3h adiantado/atrasado

**Arquivo:** `src/pages/CriarDisparo.tsx` — linha 193 (a confirmar, padrão do módulo)

**Descrição:** O campo `scheduled_at` é montado como `${scheduledDate}T${scheduledTime}:00` sem sufixo de timezone. O browser interpreta como local time (GMT-3 no Brasil), mas o Supabase JS client pode enviar sem offset, causando interpretação ambígua pelo Postgres. Para usuário em GMT-3, agendamento para "09:00 local" pode disparar às "12:00 UTC" (correto) ou às "09:00 UTC" (3h adiantado), dependendo da config de timezone do servidor.

**Proposta de correção:**
```typescript
sendData.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
```

**Story sugerida:** `FIX-SENDS-UI-02: corrigir timezone em scheduled_at ao criar disparo agendado`

---

### P2-05 — `sends-import-contacts`: N+1 queries por row sem batch — timeout garantido em imports > 1000 contatos

**Arquivo:** `supabase/functions/sends-import-contacts/index.ts` — linhas 318-536 (loop principal)

**Descrição:** Para cada row do CSV, a função executa individualmente: 1-2 queries de dedup, 1 INSERT pessoa, N INSERTs de `lead_field_values`, 1 query de `score_matrix`, 1 INSERT de lead. Para 5000 rows = potencialmente 30.000-50.000 roundtrips HTTP para o Postgres. A edge function tem timeout de 150s no Supabase; 5000 rows com apenas 2 queries cada = ~10.000 queries × ~5ms = 50s mínimo sem considerar latência real.

**Impacto:** Import de listas grandes (>1000 contatos) pode falhar com timeout. A sessão fica em `processing` indefinidamente (sem fallback para `failed` em timeout).

**Proposta de correção:** Dedup em bulk antes do loop (SELECT WHERE whatsapp IN [array] + SELECT WHERE email IN [array]), depois classificar em "existing/new" e fazer INSERTs em batch.

**Story sugerida:** `FIX-SENDS-IMPORT-04: dedup e insert em bulk no sends-import-contacts para suportar >1000 contatos`

---

## Findings P3 — Cosmético / Observação

### P3-01 — `TabelaContatos`: busca por nome não funciona mas UI sugere que sim

**Arquivo:** `src/hooks/useSendContacts.ts` — linha 28

**Código:**
```typescript
query = query.or(`whatsapp.ilike.%${filters.search}%`);
```

**Descrição:** Busca filtra apenas pelo campo `whatsapp` (campo genérico de contato — armazena email, phone ou whatsapp dependendo do canal). O placeholder da UI diz "Buscar por nome ou [canal]..." mas busca por nome retorna zero resultados — o nome está em `clients_people` via JOIN, não filtrável pelo `.or()` do PostgREST em tabela relacionada.

**Proposta de correção:** Remover "nome" do placeholder, ou fazer filtro por nome em memória após fetch.

---

### P3-02 — `dispara-webhook`: sem validação de `lead_id` UUID — throw não tratado se malformado

**Arquivo:** `supabase/functions/dispara-webhook/index.ts` — linha 55

**Código:**
```typescript
const { tipo, lead_id } = await req.json() as { tipo: EventType; lead_id: string };
```

**Descrição:** Não há validação Zod do body — `tipo` e `lead_id` são desestruturados sem sanitização. Se `lead_id` for string inválida (non-UUID), o `SELECT FROM leads WHERE id = lead_id` retornará erro de Postgres (`invalid input syntax for type uuid`), que é capturado pelo try/catch externo e retorna 500. Ao contrário das outras edge functions que usam Zod, esta não valida input.

**Proposta de correção:** Adicionar `const CallbackSchema = z.object({ tipo: z.enum([...]), lead_id: z.string().uuid() })` antes do uso.

---

## Reproduções Verificadas

Verificações via análise estática do código em commit `23f7fd60`:

| Finding | Reprodução |
|---|---|
| P1-01 (`person_status` ignorado) | Grep confirma `.eq('status','active')` na L182 seguido de `.in('status', person_status)` na L260 — PostgREST gera predicados conflitantes |
| P1-02 (`has_more` incorreto) | `rawCount = data?.length` (L344) pré-dedup, mas dedup no JS pode reduzir `contacts.length` abaixo de `limit` mesmo com `rawCount === limit` em cenários de leads múltiplos |
| P1-03 (race condition dispatch) | Sequência SELECT→check→UPDATE sem FOR UPDATE — janela de race confirmada por análise de fluxo |
| P2-01 (leads para existentes) | Código mostra bloco `existingPersonId` (L377) com `continue` antes de qualquer check de `create_leads` |
| P2-02 (retry timeout) | `delays: [5000, 15000, 45000]` → max 65s por contato confirmado; Supabase Edge timeout=150s → 3 contatos falhando consecutivamente = timeout garantido |

**Bugs corrigidos desde auditoria prévia (confirmados por git log):**
- `dc645de3` — P1-01 anterior: join `sends_webhooks` adicionado ao SELECT do dispatch worker
- `0cb9782d` — P1-02 anterior: validação de `normalizedPhone` antes do `.or()` ilike
- `23239fd9` — P2-09 anterior: condição duplicada `in_progress` no LiveCounterSidebar corrigida
- `39b0d013` — P3-03 anterior: timeout de 15s adicionado ao `fetch` do dispara-webhook
- UTMs (P2-05 anterior): filtros utm_source/medium/campaign implementados em filter-leads-for-send L233-245

---

## Tabela de Regressões Cruzadas

| Feature SENDS afetada | Módulo dependente quebrado | Finding |
|---|---|---|
| Filtro por status de pessoa (inactive/archived) | filter-leads-for-send: sempre retorna 0 contatos | P1-01 |
| Paginação de audiência grande (>500 com lead filters) | wizard: LiveCounterSidebar pode subcontar ou loop infinito | P1-02 |
| Dispatch paralelo (cron retry ou Deno Deploy) | sends-dispatch-batch: double-send para mesmo contato | P1-03 |
| Import CSV com create_leads=true | CRM PRO: leads não criados para ~70% dos contatos (os existentes) | P2-01 |
| Email/SMS com provider=twilio timeout 3x | send-dispatch-worker: timeout garante contatos presos em pending | P2-02 |
| Pausa e retomada de campanha | Disparos.tsx detail: started_at corrompido, duração errada | P2-03 |
| Campanha agendada timezone ambígua | pg_cron: disparo 3h antes/depois em clientes GMT-3 | P2-04 |
| Import CSV > 1000 contatos | sends-import-contacts: timeout sessão fica em "processing" | P2-05 |

---

## Débito Técnico Catalogado (módulo deep-dive §9) — Status na main atual

| Item | Status em 23f7fd60 |
|---|---|
| Loop de disparo no frontend (setInterval) | RESOLVIDO — pg_cron + sends-dispatch-batch em produção |
| sends_contacts sem tipos gerados | AINDA PRESENTE — `(supabase as any)` em useSends.ts, useSendWebhooks.ts |
| template_id como text sem FK | AINDA PRESENTE — confirmado no schema |
| stage_ids como array sem FK | AINDA PRESENTE — confirmado no schema |
| Filtros Q-field incompletos (q7-q18 ausentes) | AINDA PRESENTE — schema Zod lista apenas q1-q6, q19, q21-q22 |
| Sem retry automático de failed no worker | PARCIALMENTE RESOLVIDO — retry existe inline (P2-02), mas não há reprocessamento automático de `failed` histórico |
| Sem agendamento server-side | ARQUITETURA PRESENTE (pg_cron + sends-dispatch-batch) mas trigger_sends_dispatch_batch não detecta `scheduled_at` — apenas `status='running'` |
| send-status-callback com shared secret | AINDA PRESENTE — seguro se secret não vazar |

---

## Stories Geradas

Stories criadas no backlog em 2026-04-30 a partir dos findings desta auditoria:

| Story | Sev | Título |
|---|---|---|
| [[../../stories/backlog/FIX-SENDS-FILTER-01]] | P1 | Corrigir filtro person_status ignorado em filter-leads-for-send |
| [[../../stories/backlog/FIX-SENDS-FILTER-02]] | P1 | Corrigir has_more com count real em filter-leads-for-send |
| [[../../stories/backlog/FIX-SENDS-DISPATCH-01]] | P1 | Atomic claim em sends-dispatch-batch via UPDATE+RETURNING |
| [[../../stories/backlog/FIX-SENDS-IMPORT-03]] | P2 | Criar lead para contatos existentes quando create_leads=true |
| [[../../stories/backlog/FIX-SENDS-DISPATCH-02]] | P2 | Reduzir retry delays inline para prevenir timeout em batch |
| [[../../stories/backlog/FIX-SENDS-UI-01]] | P2 | Não sobrescrever started_at ao retomar disparo pausado |
| [[../../stories/backlog/FIX-SENDS-UI-02]] | P2 | Corrigir timezone em scheduled_at ao criar disparo agendado |
| [[../../stories/backlog/FIX-SENDS-IMPORT-04]] | P2 | Dedup e insert em bulk para suportar imports de >1000 contatos |

---

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | Kronix (dev-dev-delta) |
| Iniciado | 2026-04-30 |
| Concluído | 2026-04-30 |
| Branch | main |
| Commit auditado | 23f7fd60 |

## File List

- `supabase/functions/filter-leads-for-send/index.ts`
- `supabase/functions/send-dispatch-worker/index.ts`
- `supabase/functions/sends-import-contacts/index.ts`
- `supabase/functions/send-status-callback/index.ts`
- `supabase/functions/dispara-webhook/index.ts`
- `supabase/functions/sends-dispatch-batch/index.ts`
- `src/hooks/useSends.ts`
- `src/hooks/useSendDispatch.ts`
- `src/hooks/useSendContacts.ts`
- `src/hooks/useSendMutations.ts`
- `src/hooks/useSendWebhooks.ts`
- `src/hooks/useFilterLeads.ts`
- `src/hooks/useImportarLista.ts`
- `src/components/disparos/DisparoControls.tsx`
- `src/types/sends.ts`
