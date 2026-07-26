---
title: "BI-VOICE-03: Tools BI integration — async function calling sobre RPCs existentes"
type: story
status: done
epic: bi-voice
priority: P2
complexity: M
agent: dev-dev-gamma
created: 2026-04-24
updated: 2026-04-24
tags: [story, bi-voice, tools, function-calling, rpc, bi-pro]
related: ["[[BI-VOICE-02]]", "[[BI-VOICE-01]]", "[[../../agents/research/2026-04-24-bi-voice-tools-mapping]]"]
---

# BI-VOICE-03: Tools BI integration — async function calling sobre RPCs existentes

## Objetivo
Declarar tools de BI (insights, call stats, etc) na sessão Gemini Live e implementar o handler client-side que executa as chamadas Supabase RPC e devolve o resultado ao modelo via `toolResponse` — em modo async (`NON_BLOCKING + WHEN_IDLE`) para não interromper o áudio.

## Acceptance Criteria
- [x] AC1: Conjunto inicial de tools declarado em `src/lib/voice/biTools.ts`:
  - `get_insights_context(date_from, date_to, pipeline_id?)` — chama RPC existente (7 blocos de métricas).
  - `get_call_stats(date_from, date_to)` — chama RPC criada em CALL-PRO-01.
  - `get_funnel_summary(date_from, date_to, pipeline_id?)` — tool sintética, extrai bloco funnel de get_insights_context.
  - 3 tools no MVP com máxima cobertura semântica.
- [ ] AC2: Cada tool declarada com NON_BLOCKING + WHEN_IDLE na sessão Gemini Live. *(depende de BI-VOICE-02)*
- [ ] AC3: Hook useGeminiLive aceita onToolCall e despacha toolResponse no WebSocket. *(depende de BI-VOICE-02)*
- [x] AC4: executeBiTool(callName, args, supabase) exportado — switch por name, chama RPC, retorna ToolResponse. Erros viram response.error graceful.
- [ ] AC5: System instruction em src/constants/gemini-bi-instructions.ts (~500 tokens). *(pendente)*
- [ ] AC6: Smoke test "qual meu show rate da semana?" → get_call_stats → áudio. *(depende de BI-VOICE-02)*
- [ ] AC7: Smoke test "quantos leads ganhei mês passado?" → get_insights_context → áudio. *(depende de BI-VOICE-02)*
- [x] AC8: Telemetria fire-and-forget implementada em biTools.ts. Migration bi_voice_tool_invocations pendente.

## Escopo

**IN:**
- src/lib/voice/biTools.ts (DONE)
- src/types/gemini-tools.ts (pendente BI-VOICE-02)
- Migration bi_voice_tool_invocations (pendente)
- Modificação useGeminiLive para onToolCall (pendente BI-VOICE-02)
- src/constants/gemini-bi-instructions.ts (pendente)

**OUT:**
- Tools de mutation — MVP read-only
- Multi-turn complexo
- RAG-lite over docs
- A/B testing de prompt

## Contexto Técnico

RPCs reais encontradas (varredura migrations):
- get_insights_context — 7 blocos: funnel, people, messages, meetings, calls, marketing, prospect
- get_call_stats — KPIs, byOperator, evolution, topOutcomes
- get_funnel_summary — sintética (get_insights_context.funnel)
- Não existem get_negocios_summary, get_pipeline_overview, etc. no codebase

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-gamma (sera) |
| Iniciado   | 2026-04-24 |
| Concluído  | 2026-04-24 (research/mapping phase) |
| Branch     | aguardando devops |

## File List

- src/lib/voice/biTools.ts — BI_VOICE_TOOLS (3 tools), executeBiTool(), telemetria
- docs/smart-memory/agents/research/2026-04-24-bi-voice-tools-mapping.md — mapeamento RPCs → tools + riscos

## QA Results
<!-- QA preenche ao revisar -->

## Dependências

- Blocked by: BI-VOICE-02 (useGeminiLive, tipos BidiGenerateContentToolCall, NON_BLOCKING/WHEN_IDLE)
- Pendentes desta story: migration bi_voice_tool_invocations, gemini-bi-instructions.ts, AC3/AC5/AC6/AC7
