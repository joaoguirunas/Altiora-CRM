---
title: "BI-VOICE-02: Hook useGeminiLive — browser audio pipeline + WebSocket direct + tool calls async"
type: story
status: done
epic: bi-voice
priority: P2
complexity: L
agent: dev-dev-alpha
created: 2026-04-26
updated: 2026-04-26
tags: [story, bi-voice, hook, audio, websocket, gemini, function-calling, types]
related: ["[[BI-VOICE-01]]", "[[BI-VOICE-03]]", "[[../../agents/research/2026-04-24-bi-voice-tools-mapping]]"]
---

# BI-VOICE-02: Hook useGeminiLive — browser audio pipeline + WebSocket direct + tool calls async

## Objetivo
Implementar o hook React que captura mic, abre WebSocket direto pra Gemini Live API com ephemeral token (de BI-VOICE-01), faz playback PCM 24kHz, gerencia ciclo de vida da sessão (estados, reconnect, errors) e despacha **tool calls em modo async (`NON_BLOCKING + WHEN_IDLE`)** sem interromper o áudio — desbloqueando BI-VOICE-03.

## Acceptance Criteria

### Hook + estados
- [ ] AC1: Hook `useGeminiLive(opts: UseGeminiLiveOptions)` em `src/hooks/useGeminiLive.ts` retorna:
  ```ts
  {
    state: 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'reconnecting' | 'error',
    transcript: { partial: string; final: string[] },
    start: () => Promise<void>,
    stop: () => void,
    mute: () => void,
    unmute: () => void,
    isMuted: boolean,
    error: { code: string; message: string; recoverable: boolean } | null,
  }
  ```
  Onde `UseGeminiLiveOptions = { systemInstruction: string; tools?: GeminiTool[]; onToolCall?: (call: BidiGenerateContentToolCall) => Promise<ToolResponse> | ToolResponse }`.

### Token + setup
- [ ] AC2: `start()` faz `supabase.functions.invoke('gemini-live-token')` (BI-VOICE-01) → recebe `{ token, expires_at, model_id }` → abre WebSocket pra `wss://generativelanguage.googleapis.com/...?access_token={token}` → envia mensagem `setup` com:
  ```jsonc
  {
    "setup": {
      "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
      "systemInstruction": { "parts": [{ "text": opts.systemInstruction }] },
      "tools": opts.tools ?? [],
      "generationConfig": { "responseModalities": ["AUDIO"] },
      "sessionResumption": { "handle": "" },
      "outputAudioTranscription": {},
      "inputAudioTranscription": {}
    }
  }
  ```

### Audio pipeline
- [ ] AC3: Captura microfone via `getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } })` → `AudioWorklet` (preferido) ou `ScriptProcessorNode` (fallback) → converte Float32 → PCM int16 little-endian → envia via `realtimeInput.audio` em chunks de ~250ms.
- [ ] AC4: Playback do áudio recebido (`serverContent.modelTurn.parts[].inlineData` com `mimeType: 'audio/pcm;rate=24000'`): decodifica base64 → Int16 → Float32 normalizado → `AudioContext({ sampleRate: 24000 })` → `AudioBufferSourceNode` enfileirado pra playback contínuo sem gaps.
- [ ] AC5: Transcript live: hook expõe `transcript: { partial: string; final: string[] }`. Atualiza com `serverContent.outputTranscription` (modelo) e `serverContent.inputTranscription` (usuário).

### Tool calls async (desbloqueia BI-VOICE-03)
- [ ] AC6: Quando o servidor envia `BidiGenerateContentToolCall` (com `functionCalls: [{ id, name, args }]`), hook:
  1. Detecta a mensagem em `onMessage` do WebSocket.
  2. Itera por `functionCalls` e invoca `opts.onToolCall(call)` se fornecido.
  3. Recebe `ToolResponse = { id: string; name: string; response: { result?: unknown; error?: string } }`.
  4. Despacha resposta via `toolResponse` no WebSocket:
     ```jsonc
     {
       "toolResponse": {
         "functionResponses": [{ "id": "...", "name": "...", "response": { ... } }]
       }
     }
     ```
- [ ] AC7: Tools declaradas pelo caller (em `opts.tools`) usam `behavior: 'NON_BLOCKING'` e `scheduling: 'WHEN_IDLE'` — hook NÃO bloqueia o stream de áudio enquanto aguarda o `onToolCall`. Despacho do `toolResponse` é assíncrono (Promise resolve em background) e o áudio continua tocando.
- [ ] AC8: Erros do `onToolCall` (throw, rejeição) viram `response: { error: '<message>' }` no `toolResponse` — não derrubam a sessão.

### Reconnect + lifecycle
- [ ] AC9: Reconnect transparente: ao detectar `goAway` ou close inesperado com sessão ainda válida, hook re-fetch token e re-conecta usando `sessionResumption.handle` recebido na sessão anterior. Estado vai pra `reconnecting` e volta pra `listening` ao restaurar.
- [ ] AC10: `mute()` para captura de áudio (não fecha WebSocket); `unmute()` retoma. `isMuted: boolean` reflete.
- [ ] AC11: Cleanup robusto: em `stop()` ou unmount, fecha WebSocket (close code 1000), libera mic (`MediaStream.getTracks().forEach(t => t.stop())`), suspende `AudioContext`, cancela `AudioBufferSourceNode` enfileirados. Sem leaks (testar com `performance.memory` ou unmount loop).
- [ ] AC12: Error handling estruturado: WebSocket close inesperado, `getUserMedia` rejected (NotAllowedError, NotFoundError), browser sem suporte (sem `AudioWorklet` E sem `ScriptProcessor`), falha de fetch token (412/429/502 de BI-VOICE-01) → `state = 'error'` + `error: { code, message, recoverable }` exposto. Códigos: `mic_denied`, `mic_unavailable`, `browser_unsupported`, `token_unavailable`, `gemini_not_configured` (412 de BI-VOICE-01), `rate_limited` (429), `provider_error` (502), `ws_closed`.

### Tipos TypeScript
- [ ] AC13: `src/types/gemini-live.ts` exporta tipos:
  - `GeminiTool` — alias de `{ functionDeclarations: GeminiFunctionDeclaration[] }`
  - `GeminiFunctionDeclaration` — `{ name: string; description: string; parameters: JSONSchema; behavior?: 'BLOCKING' | 'NON_BLOCKING'; scheduling?: 'INTERRUPT' | 'WHEN_IDLE' | 'SILENT' }`
  - `BidiGenerateContentSetup` — payload de setup (model, systemInstruction, tools, generationConfig, sessionResumption, outputAudioTranscription, inputAudioTranscription)
  - `BidiGenerateContentToolCall` — `{ functionCalls: { id: string; name: string; args: Record<string, unknown> }[] }`
  - `BidiGenerateContentToolResponse` — `{ functionResponses: { id: string; name: string; response: { result?: unknown; error?: string } }[] }`
  - `BidiGenerateContentServerContent` — `{ modelTurn?: { parts: ({ inlineData?: { mimeType: string; data: string }; text?: string })[] }; outputTranscription?: { text: string; finished?: boolean }; inputTranscription?: { text: string; finished?: boolean }; turnComplete?: boolean; interrupted?: boolean; goAway?: { timeLeft?: string } }`
  - `BidiGenerateContentClientMessage` — union: `{ setup }` | `{ realtimeInput: { audio: { mimeType: string; data: string } } }` | `{ toolResponse: BidiGenerateContentToolResponse }` | `{ clientContent: ... }`
  - `BidiGenerateContentServerMessage` — union: `{ setupComplete }` | `{ serverContent: BidiGenerateContentServerContent }` | `{ toolCall: BidiGenerateContentToolCall }` | `{ goAway }` | `{ sessionResumptionUpdate: { newHandle: string; resumable: boolean } }`
  - `ToolResponse` — re-export de `BidiGenerateContentToolResponse['functionResponses'][number]`
  - `UseGeminiLiveOptions` — opts do hook
  - `UseGeminiLiveReturn` — shape do retorno do hook
  - Documentação inline (JSDoc curto) referenciando https://ai.google.dev/gemini-api/docs/live para origem dos shapes.

## Escopo

**IN:**
- `src/hooks/useGeminiLive.ts` (NEW) — hook principal
- `src/utils/audio/pcm.ts` (NEW) — conversão Float32 ↔ PCM int16, base64 helpers
- `src/utils/audio/audioWorkletProcessor.ts` (NEW) — AudioWorkletProcessor para captura
- `src/types/gemini-live.ts` (NEW) — tipos TypeScript completos
- `src/utils/audio/playbackQueue.ts` (NEW) — fila de `AudioBufferSourceNode` pra playback gapless

**OUT:**
- Tools execution (`executeBiTool`, declaração de tools BI) — escopo de BI-VOICE-03 (já em progresso, blocked por esta).
- UI components (botão de mic, indicadores, transcript visual) — escopo de BI-VOICE-04.
- Server-side fallback / proxy — não há (vide ADR pendente).
- Migration `bi_voice_tool_invocations` — pertence a BI-VOICE-03.
- System instruction `gemini-bi-instructions.ts` — pertence a BI-VOICE-03.

## Contexto Técnico

### Por que browser-direct (não proxy via edge fn)
Edge functions Supabase têm limite de timeout 150s/400s e não suportam WebSocket bidirecional persistente — incompatível com sessão Live de 5-15min. O pattern oficial Google é ephemeral token + browser-direct. Token short-lived (60s, single-use) protege a tenant key; cost isolation já garantido em BI-VOICE-01 (rate limit 20 tokens/h/tenant).

### Por que NON_BLOCKING + WHEN_IDLE
- `BLOCKING` (default) interrompe o áudio enquanto a tool roda. Em chamadas Supabase RPC (50-500ms), isso quebra a fluência da conversa.
- `NON_BLOCKING + WHEN_IDLE` permite que o modelo continue gerando áudio normalmente, executa a tool em paralelo, e injeta o `toolResponse` quando o modelo está em pausa natural (idle entre turns).
- Trade-off: tool result pode chegar 1-2 turns depois da pergunta. Aceitável pra BI conversacional ("vou consultar e te respondo").

### Convenções existentes a seguir
- Hook segue padrão `useX` com TanStack-style ergonomics (estado + ações).
- Tipos vivem em `src/types/` (não em `src/hooks/`).
- Áudio utils em `src/utils/audio/` — novo namespace, mas alinhado com `src/utils/{logger,phone,cache}`.
- Erros estruturados (`{code, message, recoverable}`) seguem padrão de `_shared/response.ts` no backend.
- Logger via `src/utils/logger.ts` para diagnóstico (sem vazar token).

### Compatibilidade de browser
- AudioWorklet: Chrome 66+, Firefox 76+, Safari 14.1+ (target rev-os).
- Fallback `ScriptProcessorNode` (deprecated) para browsers antigos — log warning.
- `getUserMedia` + secure context obrigatório (HTTPS ou localhost).
- WebSocket binary frame não é necessário — Gemini Live usa JSON text frames com base64 pra audio chunks.

### Endpoint Gemini Live (referência)
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?access_token={EPHEMERAL_TOKEN}
```
Modelo: `gemini-2.5-flash-native-audio-preview-12-2025` (nome retornado por BI-VOICE-01 — não hardcodar no hook).

### Sessão limites
- 15min sem compressão; 30min com compressão (Gemini Live).
- `goAway` enviado ~1min antes do timeout — usar `sessionResumption.handle` recebido em `sessionResumptionUpdate` pra reconectar transparente.

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

## Validação 5-pontos (zael)

| # | Critério | Status | Notas |
|---|---|---|---|
| 1 | Título claro e objetivo | GO | Cobre 3 vetores: audio pipeline, WebSocket direct, tool calls async |
| 2 | Acceptance criteria testáveis e mensuráveis | GO | 13 ACs com shapes/códigos/comportamentos verificáveis (state machine, payloads JSON, error codes nomeados, tipos exportados) |
| 3 | Escopo definido (IN/OUT explícitos) | GO | 5 arquivos IN; 5 itens OUT delimitando fronteira com BI-VOICE-03/04 |
| 4 | Complexidade estimada | GO | L — captura+playback+WS+reconnect+tool dispatch async, 5 arquivos novos, ~600-800 LOC. Encaixa entre M (BI-VOICE-01) e XL (epic completo) |
| 5 | Alinhamento com arquitetura atual | GO | Browser-direct é decisão arquitetural justificada (limite edge fn). Tipos em `src/types/`, audio utils em `src/utils/audio/` (novo namespace coerente), hook em `src/hooks/`. Consome BI-VOICE-01 via `supabase.functions.invoke`. Fornece API que BI-VOICE-03 já espera (`onToolCall`, tipos `BidiGenerateContentToolCall`). Pendência: ADR-BI-VOICE-01-gemini-live-architecture ainda não escrito — referenciado mas não bloqueante porque a decisão central (browser-direct via ephemeral token) já está validada em research `2026-04-24-bi-voice-tools-mapping.md` e implementada em BI-VOICE-01. |

**Veredicto:** GO (5/5).

**Ação imediata:** mover pra `active/`, marcar BI-VOICE-03 como executável quando esta concluir.

## Dependências

- **Blocked by:** BI-VOICE-01 (gemini-live-token edge fn — DONE, commit `adef507d`).
- **Blocks:** BI-VOICE-03 (tools BI integration — espera `useGeminiLive` com `onToolCall`, tipos `BidiGenerateContentToolCall`, suporte NON_BLOCKING+WHEN_IDLE).

## Notas

- Primeira tentativa de implementação (em sessão de 2026-04-24) marcou story como done sem código — arquivos ausentes em disco (`src/hooks/useGeminiLive.ts`, `src/types/gemini-live.ts`, `src/utils/audio/`). Esta é a versão correta com escopo expandido pra incluir tool calls async (originalmente OUT, agora IN porque BI-VOICE-03 depende e é o único caller que vai usar o hook).
- ADR `ADR-BI-VOICE-01-gemini-live-architecture` recomendado como follow-up — formaliza decisão browser-direct vs proxy e cost isolation.
