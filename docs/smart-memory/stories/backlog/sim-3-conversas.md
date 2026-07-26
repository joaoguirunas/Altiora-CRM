---
title: "Story sim-3: Conversas e atendimentos (mínimo 50)"
type: story
status: backlog
epic: joao-guirunas-sim-dados-apresentacao
complexity: L
agent: dev-architect
created: 2026-05-02
updated: 2026-05-10
tags: [story, simulation, joao-guirunas-demo, seed, omni, whatsapp]
related: ["[[../BACKLOG]]", "[[sim-1-dados-config-base]]", "[[sim-2-leads-contacts]]", "[[sim-4-deals-vendas]]"]
---

# Story sim-3: Conversas e atendimentos (mínimo 50)

## Objetivo
Popular a tabela `messages` com **mínimo 50 conversas** WhatsApp realistas (ida-e-volta entre lead e atendentes/IA), distribuídas no histórico dos últimos 30 dias, demonstrando o módulo OMNI PRO em uma apresentação comercial.

## Acceptance Criteria
- [ ] AC1: **Mínimo 50 leads distintos** têm pelo menos 1 mensagem associada em `messages` (ou seja, 50 "conversas" ativas).
- [ ] AC2: Cada conversa tem **mínimo 4 mensagens** (média de 8–15) alternando `from_contact` entre `cliente`, `humano` (atendente) e/ou `agente_ia`, simulando atendimento real.
- [ ] AC3: **Mínimo 30% das conversas** envolvem `agente_ia` (mostra produto AI ativo); outras 70% mistas humano+cliente.
- [ ] AC4: **Conteúdo de mensagens realista** — saudações, perguntas qualificatórias ("qual seu objetivo?", "quantos leads/mês?"), respostas, agendamento, follow-up. Não usar lorem ipsum. Tom PT-BR informal de WhatsApp.
- [ ] AC5: **Distribuição temporal**: `created_at` espalhado pelos últimos 30 dias com timestamps realistas (mensagens da mesma conversa em sequência minutos/horas/dias, não batch).
- [ ] AC6: **Canal majoritário**: 80% `whatsapp`, 15% `instagram`, 5% `email` na coluna `channel`.
- [ ] AC7: **Status mix**: ao menos 5 conversas marcadas como "em aberto" (sem resposta da última 24h), 10 com agendamento confirmado dentro do fluxo (preparando sim-5), restante atendido/resolvido.
- [ ] AC8: Script idempotente — usar marker em texto da mensagem (ex.: `[demo-sim3]` em metadata/json se houver, ou comentário SQL) e checar via `WHERE NOT EXISTS (SELECT 1 FROM messages WHERE lead_id = X AND tenant_id = Y)` antes de inserir.
- [ ] AC9: 100% dos registros com `tenant_id = 'wotuyxscsfralqpoiyfv'`.

## Escopo

**IN:**
- Arquivo SQL `supabase/seeds/sim-3-conversas.sql` (apenas INSERT).
- Conjunto de **templates de conversa** (ao menos 8–10 fluxos diferentes) que serão amostrados aleatoriamente.
- Inserção em `messages` (schema moderno com `lead_id`, `channel`, `from_contact`, `message`, `tenant_id`, `created_at`).
- Timestamps realistas: `created_at` calculado a partir de `leads.created_at` + offset de minutos/horas para sequência natural.

**OUT:**
- Inserção em `crm_messages` (schema legado paralelo) — não necessário; a UI moderna lê `messages`.
- Population de `msg_buffer` ou `message_buffer` (buffers operacionais, não fazem parte da apresentação histórica).
- `n8n_chat_histories` — fora do escopo.
- `canned_responses` (configuração, não conversa real) — opcional, fora do MVP.
- Mídias (audio/imagem) — só texto.
- Tabulação de chamadas (`call_pro_calls`) — fora do escopo (story de Call PRO seria sim-7+ futura).

## Contexto Técnico

**Tabela principal:** `messages`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid | gerar via `gen_random_uuid()` |
| lead_id | uuid | FK → `leads.id` (de sim-2) |
| channel | text | whatsapp/instagram/email |
| from_contact | text | cliente/humano/agente_ia/follow_up |
| message | text | conteúdo realista |
| tenant_id | uuid | `wotuyxscsfralqpoiyfv` |
| created_at | timestamptz | sequência natural |

**Templates de conversa (sugestão):**
1. Lead vindo de Meta Ads → IA qualifica → humano agenda demo
2. Lead frio → IA tenta engajar → no-show
3. Lead quente → atendente humano direto → agenda
4. Cliente com dúvida pós-venda → atendente resolve
5. Lead pede orçamento → atendente envia proposta
6. Lead em negociação → contra-proposta → fechamento
7. Lead que perdeu → motivo "concorrente"
8. Lead que perdeu → motivo "sem orçamento"
9. Lead reagendou 2x
10. Lead vindo de Instagram com pergunta sobre produto

**Estratégia de implementação:**
```sql
-- Pseudocódigo: para cada lead alvo, gerar N mensagens em sequência
WITH leads_alvo AS (
  SELECT id, created_at FROM leads
  WHERE tenant_id = 'wotuyxscsfralqpoiyfv'
  ORDER BY random() LIMIT 50
),
templates AS (
  SELECT * FROM (VALUES
    ('cliente',  'Oi! Vi o anúncio de vocês, queria saber mais.', 0),
    ('agente_ia','Olá! Que bom que se interessou. Posso te fazer 3 perguntas rápidas?', 2),
    ('cliente',  'Pode sim', 5),
    ...
  ) t(from_c, msg, offset_min)
)
INSERT INTO messages (lead_id, channel, from_contact, message, tenant_id, created_at)
SELECT l.id, 'whatsapp', t.from_c, t.msg, 'wotuyxscsfralqpoiyfv', l.created_at + (t.offset_min * INTERVAL '1 minute')
FROM leads_alvo l, templates t;
```

**Dependências:**
- **Bloqueada por** sim-1, sim-2.

**Bloqueia:**
- Nenhuma diretamente, mas alimenta o realismo da apresentação junto com sim-4 e sim-5.

**Volume estimado:** 50 conversas × 8 msgs = ~400 linhas mínimo, alvo confortável de 600–800 linhas em `messages`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
