---
title: "BI-VOICE-03: Mapeamento RPCs → Gemini Live Tools"
type: research
author: sera (dev-dev-gamma)
date: 2026-04-24
story: BI-VOICE-03
tags: [bi-voice, gemini-live, tools, function-calling, rpc]
---

# BI-VOICE-03: Mapeamento RPCs → Gemini Live Tools

## Escopo da pesquisa

Varredura de todas as migrations `supabase/migrations/2026*.sql` para encontrar funções PostgreSQL candidatas a tools de Gemini Live. Critérios de seleção:
1. Retorna `jsonb` com métricas agregadas (não triggers, não funções de RLS, não setters)
2. Cobertura semântica alta — responde perguntas naturais de negócio
3. Já existe e está em produção (sem necessidade de criar nova RPC)

---

## RPCs encontradas e avaliação

| RPC | Retorno | Cobertura semântica | Candidata? | Notas |
|---|---|---|---|---|
| `get_insights_context(date_from, date_to, pipeline_id?)` | `jsonb` (7 blocos) | Muito alta — funil, pessoas, mensagens, reuniões, ligações, marketing, prospect | **SIM — Tool 1** | Migration mais recente: `20260323900000_fix7_insights_context_function.sql` |
| `get_call_stats(date_from, date_to)` | `jsonb` (KPIs + byOperator + evolution + topOutcomes) | Alta — específica para Call PRO | **SIM — Tool 2** | Criada em CALL-PRO-01: `20260423017000_call_pro_get_call_stats_rpc.sql` |
| `get_available_slots(...)` | Tabela de slots | Baixa (operacional, não BI) | Não | Calendário/booking |
| `get_booking_session(...)` | Tabela | Baixa (operacional) | Não | Booking session |
| `book_meeting(...)` | uuid | Não (mutation) | Não | OUT — MVP read-only |
| `import_pessoa_with_flexible_lead(...)` | void | Não (mutation) | Não | OUT — mutation |
| `assign_lead_round_robin(...)` | uuid | Não (mutation) | Não | OUT — mutation |
| `validate_stage_ids(...)` | bool | Não (validação interna) | Não | CHECK constraint helper |
| `find_duplicate_person(...)` | Tabela | Baixa (operacional) | Não | Identity dedup |
| `get_ab_variant(...)` | text | Baixa | Não | A/B testing interno |
| `claim_pending_messages(...)` | Tabela | Não (queue internal) | Não | Delivery engine |

**Resultado:** Apenas 2 RPCs existentes viáveis como tools diretas. A terceira tool (`get_funnel_summary`) é uma tool sintética que chama `get_insights_context` internamente e extrai apenas o bloco `funnel` — dando ao modelo uma opção mais focada para perguntas sobre pipeline/vendas sem retornar 7 blocos.

---

## Tools declaradas em `src/lib/voice/biTools.ts`

### Tool 1: `get_insights_context`

```typescript
{
  name: "get_insights_context",
  description: "Retorna métricas agregadas do BI PRO: funil de vendas, pessoas/empresas, mensagens, reuniões, ligações, marketing e Prospect PRO...",
  parameters: {
    type: "object",
    properties: {
      date_from: { type: "string", description: "ISO 8601 start date" },
      date_to:   { type: "string", description: "ISO 8601 end date" },
      pipeline_id: { type: "string", description: "UUID do pipeline (opcional)" }
    },
    required: []
  }
}
```

**Use cases mapeados:**
- "Quantos leads ganhei esse mês?" → funil.won
- "Qual minha taxa de conversão?" → funil.conversion_pct
- "Quanto de receita esse trimestre?" → funil.revenue
- "Quais os principais motivos de perda?" → funil.loss_reasons
- "Qual o score médio dos meus contatos?" → people.score_distribution
- "Quantas mensagens enviamos essa semana?" → messages.total + messages.by_channel
- "Qual foi o desempenho de marketing?" → marketing.sends + marketing.utm_attribution

**Risco:** Tool muito genérica — o modelo pode chamá-la para qualquer coisa e retornar payload grande (~2-4KB JSON). Mitigado com Tool 3 (funil específico) e instrução no system prompt: "Use get_funnel_summary para perguntas de vendas, get_insights_context apenas quando precisar de visão geral ampla."

---

### Tool 2: `get_call_stats`

```typescript
{
  name: "get_call_stats",
  description: "Retorna estatísticas de ligações do Call PRO: answer rate, duração média, breakdown por operador, evolução diária...",
  parameters: {
    type: "object",
    properties: {
      date_from: { type: "string", description: "ISO 8601 — obrigatório" },
      date_to:   { type: "string", description: "ISO 8601 — obrigatório" }
    },
    required: ["date_from", "date_to"]
  }
}
```

**Use cases mapeados:**
- "Qual meu show rate de ligações essa semana?" → kpis.answerRate
- "Quantas ligações perdidas ontem?" → kpis.missed (com date_from/to = ontem)
- "Quem atendeu mais chamadas esse mês?" → byOperator[0]
- "Qual a duração média das ligações?" → kpis.avgDuration
- "Como evoluiu o volume de chamadas?" → evolution[]

**Nota:** `date_from` e `date_to` são obrigatórios nesta RPC (sem default). O modelo precisa inferir datas do contexto conversacional ("essa semana" → inferir range) ou pedir ao usuário.

---

### Tool 3: `get_funnel_summary` (sintética)

```typescript
{
  name: "get_funnel_summary",
  description: "Resumo focado do funil de vendas: leads por etapa, taxa de conversão, receita, ticket médio, ciclo médio, motivos de perda...",
  parameters: {
    type: "object",
    properties: {
      date_from:   { type: "string" },
      date_to:     { type: "string" },
      pipeline_id: { type: "string" }
    },
    required: []
  }
}
```

**Implementação:** Chama `get_insights_context` internamente, retorna apenas `data.funnel`. Evita que o modelo receba 7 blocos quando só precisa de funil.

**Use cases mapeados:**
- "Quantos leads estão em cada etapa?" → funnel.stages[]
- "Qual o ticket médio de vendas?" → funnel.avg_deal
- "Quanto tempo leva para fechar um negócio?" → funnel.avg_cycle_days
- "Por que estamos perdendo leads?" → funnel.loss_reasons[]

---

## Riscos identificados

| Risco | Severidade | Mitigação |
|---|---|---|
| `get_insights_context` retorna payload grande (~3-4KB) | Média | Tool 3 (get_funnel_summary) para perguntas focadas; instrução no system prompt |
| `get_call_stats` exige datas obrigatórias — modelo pode não inferir corretamente | Média | System instruction: "Ao chamar get_call_stats sem datas explícitas do usuário, use 'últimos 7 dias'" |
| Tool 3 faz 2 roundtrips (chama get_insights_context e extrai bloco) | Baixa | Latência adicional ~50-100ms, aceitável em WHEN_IDLE |
| Ausência de RPCs para métricas de Omni/mensagens isoladas | Baixa | get_insights_context.messages cobre; RPC dedicada pode ser adicionada em iteração |
| Não há RPC para "hot leads" (score > 75 + ativo) | Baixa | get_insights_context.people.score_distribution é próximo; RPC específica é backlog |

---

## Arquivos criados

- `src/lib/voice/biTools.ts` — declarações de tools, executor `executeBiTool()`, telemetria fire-and-forget
- `docs/smart-memory/stories/active/BI-VOICE-03.md` — story movida de backlog para active

## Pendente (depende de BI-VOICE-02)

- `src/types/gemini-tools.ts` — tipos BidiGenerateContentToolCall (vêm do SDK Gemini Live)
- Modificação de `useGeminiLive` para aceitar `onToolCall` e despachar via WebSocket
- Migration `bi_voice_tool_invocations` table (já referenciada no código, precisa criar)
- `src/constants/gemini-bi-instructions.ts` — system instruction template
- Integration test smoke: "qual meu show rate?" → get_call_stats → resposta áudio
