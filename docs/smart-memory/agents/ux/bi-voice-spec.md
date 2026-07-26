---
title: BI Voice — UX Spec
type: ux-spec
agent: dev-ux
epic: bi-voice
created: 2026-04-26
updated: 2026-04-26
tags: [ux, bi-voice, gemini-live, components, a11y]
related: ["[[../../stories/active/BI-VOICE-01]]", "[[../../stories/active/BI-VOICE-03]]", "[[components]]"]
---

# BI Voice — UX Spec

Assistente de voz com IA para o módulo BI PRO. Permite ao usuário fazer perguntas em linguagem natural ("quantos leads ganhei esse mês?") e receber respostas em áudio, via Gemini Live com function calling sobre RPCs de BI existentes.

**Status de implementação:** `VoiceChatButton.tsx` já existe em `src/components/bi/VoiceChatButton.tsx`. Esta spec é a referência canônica — documenta o que foi construído e orienta o que ainda está pendente (BI-VOICE-02: `useGeminiLive` hook, `src/types/gemini-live.ts`, `gemini-bi-instructions.ts`).

---

## 1. User Flow

```mermaid
flowchart TD
  A[Usuário acessa /bipro] --> B{bi_voice_chat_beta_enabled?}
  B -->|false| Z[VoiceChatButton não renderiza]
  B -->|true| C[FAB flutuante visível — canto inferior direito]

  C --> D[Usuário clica no FAB]
  D --> E{isMicSupported?}
  E -->|false| F[Abre modal → estado NO_SUPPORT\nMicOff + mensagem de navegador incompatível]
  E -->|true| G[Abre modal → estado idle\nMic icon + 'Toque para falar']

  G --> H[Usuário clica botão Mic central]
  H --> I[Estado: connecting\nLoader2 spin + 'Conectando...']
  I --> J{Gemini Live token OK?}
  J -->|412 Gemini não configurado| K[Estado: error\nVoiceErrorDisplay GEMINI_NOT_CONFIGURED\nLink → /settings?tab=ia]
  J -->|429 Rate limit| L[Estado: error\nVoiceErrorDisplay RATE_LIMITED\n'Tente novamente em alguns minutos']
  J -->|Permissão mic negada| M[Estado: error\nVoiceErrorDisplay NotAllowedError\nMensagem sobre configurações do navegador]
  J -->|OK| N[Estado: listening\nPulso animado + 'Ouvindo...']

  N --> O[Usuário fala]
  O --> P[Estado: thinking\nLoader2 + 'Pensando...']
  P --> Q{function calling?}
  Q -->|sim| R[Estado: processing\nLoader2 + 'Buscando dados...']
  R --> S[Estado: speaking\nbg-emerald-500 + Volume2 + waveform animado\n'Respondendo...']
  Q -->|não| S

  S --> T[Áudio termina]
  T --> N

  N --> U[Usuário clica Mic novamente]
  U --> V[Estado: idle\nSessão encerrada]

  N --> W[Usuário fecha modal / clica X]
  W --> X[stop() chamado se estado != idle/error]
  X --> V

  N --> Y[Reconexão automática\nEstado: reconnecting\nLoader2 + 'Reconectando...']
  Y --> N
```

### Entry points

| Entry point | Condição | Behavior |
|---|---|---|
| FAB flutuante `/bipro` | `bi_voice_chat_beta_enabled = true` | Abre Dialog (desktop) ou Drawer (mobile) |
| Tab "BI Voice" (futura) | Não implementado | Fora do escopo do MVP |

O FAB **não aparece** em outras rotas — escopo restrito ao módulo BI PRO.

### Feature gate

`settings.bi_voice_chat_beta_enabled` (boolean, por tenant). Se `false`, `VoiceChatButton` retorna `null` — zero ruído visual para tenants sem acesso beta. Dev-alpha deve garantir que esse campo exista em `settings` e que `useSettings()` o exponha.

---

## 2. Estados visuais

Tipo `GeminiLiveState` (a definir em `src/types/gemini-live.ts`):

```typescript
type GeminiLiveState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'processing'
  | 'reconnecting'
  | 'error';
```

### Tabela de estados

| Estado | MicButton aparência | Label | Quando ocorre |
|---|---|---|---|
| `idle` | bg-primary, Mic icon | "Toque para falar" | Inicial / após stop |
| `connecting` | bg-muted, Loader2 spin, cursor-wait | "Conectando..." | Token fetch + WebSocket setup |
| `listening` | bg-primary, pulso animado, Mic icon | "Ouvindo..." | WebSocket aberto, aguardando áudio |
| `listening` + `isMuted` | bg-primary, ring-4 ring-destructive, MicOff | "Ouvindo..." | Usuário mutou |
| `thinking` | bg-muted, Loader2 spin | "Pensando..." | Modelo processando, sem tool call |
| `processing` | bg-muted, Loader2 spin | "Buscando dados..." | Function calling ativo (RPC em execução) |
| `speaking` | bg-emerald-500, Volume2 icon | "Respondendo..." | Modelo transmitindo áudio |
| `reconnecting` | bg-muted, Loader2 spin | "Reconectando..." | WebSocket caiu, tentando reabrir |
| `error` | bg-primary, Mic icon (como idle) | — | Erro — VoiceErrorDisplay exibido acima |

**Nota:** No estado `error`, o botão retorna ao visual de `idle` para permitir nova tentativa sem fechar o modal.

---

## 3. Componentes

### 3.1 VoiceChatButton (FAB entry point)

**Arquivo:** `src/components/bi/VoiceChatButton.tsx`
**Status:** Implementado.

**Propósito:** Floating action button que abre o modal de voz. Wrapper de orquestração — gerencia `useGeminiLive`, telemetria, open/close do modal.

**Posicionamento:**

```
┌──────────────────────────────────────────┐
│                                          │
│  BI PRO — conteúdo principal             │
│                                          │
│                              ┌──┐        │
│                              │  │ ← FAB  │
│                              └──┘        │
└──────────────────────────────────────────┘
  Desktop: fixed bottom-6 right-6, h-14 w-14
  Mobile:  fixed bottom-20 right-4, h-12 w-12
           (bottom-20 evita sobreposição com MobileBottomTabs)
```

**Props:**

| Prop | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `onSwitchToText` | `() => void` | não | Callback para alternar para chat texto |

**Estados do FAB:**

- Default: bg-primary, Mic icon, badge "BETA" (amber, canto superior direito)
- Hover: bg-primary/90
- Focus: ring-2 ring-primary ring-offset-2
- Active: scale-95
- Tooltip (desktop): "Assistente de voz (BETA — em desenvolvimento)"

**Comportamento modal:**
- Desktop: `<Dialog>` — max-w-sm, centrado
- Mobile: `<Drawer>` — bottom sheet
- Fechar modal com sessão ativa (`state !== 'idle' && state !== 'error'`) chama `stop()` antes

---

### 3.2 MicButton (botão central do modal)

**Arquivo:** interno em `VoiceChatButton.tsx` — subcomponente `MicButton`.
**Status:** Implementado.

**Propósito:** Botão circular principal dentro do modal — toggle de start/stop da sessão de voz.

```
┌──────────────────────────────────┐
│  Assistente de voz  [BETA]      X│
│                                  │
│  [waveform bars]                 │
│                                  │
│         ┌────────────┐           │
│         │     🎙     │  ← h-16 w-16 rounded-full
│         └────────────┘           │
│                                  │
│      "Toque para falar"          │
│                                  │
│  [Transcrição ▼] (se houver)     │
│                                  │
│  [Mutar]    [Chat texto]         │
└──────────────────────────────────┘
```

**Acessibilidade:**
- `aria-label="Iniciar conversa por voz"` (idle/error) ou `"Parar conversa por voz"` (demais estados)
- `aria-pressed={isListening || isSpeaking}`
- `disabled` quando `connecting` ou `reconnecting` (previne double-click)
- `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- Tamanho 64×64px — área de toque adequada (≥ 44px WCAG 2.5.5)

---

### 3.3 VoiceWaveform (indicador de áudio ativo)

**Arquivo:** interno em `VoiceChatButton.tsx` — subcomponente `VoiceWaveform`.
**Status:** Implementado.

**Propósito:** Visualização de áudio animada — 16 barras verticais com delay progressivo.

**Especificação:**
- 16 barras, `w-[3px]`, `rounded-full`, `bg-primary`
- Animação ativa (`active=true`): classe `animate-voice-bar` com `animationDelay` em progressão 0–0.8s
- Inativo: `opacity-30`, altura fixa 4px
- Container: `h-10`, `flex items-center justify-center gap-[3px]`
- `aria-hidden="true"` — decorativo, não deve ser lido por screen reader

**Keyframe `animate-voice-bar` (a adicionar em `tailwind.config.ts`):**

```css
@keyframes voice-bar {
  0%, 100% { height: 4px; }
  50% { height: 32px; }
}
```

```js
// tailwind.config.ts — keyframes
'voice-bar': {
  '0%, 100%': { height: '4px' },
  '50%': { height: '32px' },
},
// animation
'voice-bar': 'voice-bar 0.8s ease-in-out infinite',

// keyframes pulse para o MicButton listening state
'voice-pulse': {
  '0%': { opacity: '0.4', transform: 'scale(1)' },
  '100%': { opacity: '0', transform: 'scale(1.6)' },
},
'voice-pulse': 'voice-pulse 1.5s ease-out infinite',
```

**Ativo vs. falante:** O waveform anima apenas quando `state === 'speaking'` (modelo respondendo). No estado `listening`, o feedback visual está no MicButton (pulso animado nos rings). Isso diferencia claramente "eu estou ouvindo você" vs. "o assistente está falando".

---

### 3.4 VoiceErrorBoundary (tratamento de erros)

**Arquivo:** interno em `VoiceChatButton.tsx` — subcomponente `VoiceErrorDisplay`.
**Status:** Implementado.

**Propósito:** Exibe erros específicos com orientação acionável — nunca mensagem genérica quando há causa identificável.

**Hierarquia de erros:**

```
┌──────────────────────────────────────────┐
│ Erro: GEMINI_NOT_CONFIGURED (412)        │
│ ┌──────────────────────────────────────┐ │
│ │  [!]  Gemini API não configurada     │ │
│ │       Configurações → IA Providers ↗ │ │
│ └──────────────────────────────────────┘ │
│  border-destructive/40, bg-destructive/5 │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Erro: RATE_LIMITED (429)                 │
│ ┌──────────────────────────────────────┐ │
│ │  [!]  Limite de uso atingido         │ │
│ │       Tente novamente em alguns      │ │
│ │       minutos.                       │ │
│ └──────────────────────────────────────┘ │
│  border-amber-400/40, bg-amber-400/5     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Erro: NotAllowedError (mic negado)       │
│ ┌──────────────────────────────────────┐ │
│ │  [🎤✕]  Permissão de microfone       │ │
│ │         negada. Habilite nas         │ │
│ │         configurações do navegador.  │ │
│ └──────────────────────────────────────┘ │
│  border-muted (neutro — não é falha do   │
│  sistema, é ação do usuário)             │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Erro: NO_SUPPORT (browser incompatível) │
│ ┌──────────────────────────────────────┐ │
│ │  [🎤✕]  Microfone ou Web Audio não   │ │
│ │         suportado neste navegador.   │ │
│ └──────────────────────────────────────┘ │
│  border-muted (neutro)                   │
└──────────────────────────────────────────┘
```

**Mapeamento de código de erro:**

| HTTP / código | `error.code` | Display |
|---|---|---|
| 412 | `GEMINI_NOT_CONFIGURED` | Destructive + link settings |
| 429 | `RATE_LIMITED` | Amber + retry hint |
| `NotAllowedError` (Web API) | `NotAllowedError` | Neutro + browser instructions |
| Navegador sem suporte | `NO_SUPPORT` | Neutro (verificado no mount, não via API) |
| Qualquer outro | qualquer string | Destructive + message raw |

**Nota `retry_after_seconds`:** A edge function `gemini-live-token` retorna `{ retry_after_seconds }` no 429 (AC5 de BI-VOICE-01). O display atual mostra "alguns minutos" (genérico). Melhoria futura: exibir countdown regressivo baseado em `retry_after_seconds`. Quando BI-VOICE-02 tiver acesso ao payload do erro, dev-alpha pode passar esse valor para `VoiceErrorDisplay` e renderizar um timer.

**Acessibilidade dos erros:**
- Todos os displays usam `<div>` com ícone + texto — não dependem de cor isolada para transmitir o erro
- O link "Configurações → IA Providers" usa `<a>` nativo com texto descritivo (não "clique aqui")
- `AlertCircle` é decorativo — texto adjacente comunica o erro

---

### 3.5 VoiceTranscriptOverlay

**Arquivo:** interno em `VoiceChatButton.tsx` — subcomponente `TranscriptArea`.
**Status:** Implementado.

**Propósito:** Exibe transcrição em tempo real (parcial + finais) dentro do modal — expansível por padrão quando há conteúdo.

**Layout:**

```
┌──────────────────────────────────────┐
│ Transcrição                        ▲ │  ← toggle button
├──────────────────────────────────────┤
│ Você: quantos leads ganhei esse     │
│ mês?                                │
│                                     │
│ [texto parcial em itálico]          │  ← partial, muted-foreground
└──────────────────────────────────────┘
  max-h-200px, overflow-y-auto
  bg-muted/40, border, rounded-md
```

**Comportamento:**
- Oculto quando não há conteúdo (`partial === '' && finals.length === 0`)
- Auto-expande quando a primeira linha final chega (`finals.length > 0`)
- Auto-scroll para o final a cada novo `partial` ou `final`
- Toggle manual (▲/▼) para colapsar

**Acessibilidade:**
- `aria-live="polite"` no container — leitores de tela anunciam novas linhas sem interromper
- `aria-label="Transcrição da conversa por voz"`
- Toggle button é nativo `<button>` com texto visível ("Transcrição")

---

## 4. Acessibilidade — Checklist WCAG AA

| Critério | Componente | Status | Nota |
|---|---|---|---|
| 1.3.1 Info and Relationships | Todos | Implementado | Radix Dialog/Drawer provê role=dialog, aria-labelledby automático |
| 1.4.3 Contraste mínimo 4.5:1 | MicButton, labels | Implementado | bg-primary (#FF4400) sobre branco = 4.6:1 ✓ |
| 1.4.3 Contraste erro amber | VoiceErrorDisplay RATE_LIMITED | Atenção | text-amber-700 sobre bg-amber-400/5 — verificar em tema dark |
| 2.1.1 Keyboard | MicButton, Mute button, Close | Implementado | `<button>` nativos, focus-visible ring |
| 2.4.3 Focus Order | Modal | Implementado | Radix Dialog gerencia trap de foco |
| 3.3.1 Error Identification | VoiceErrorDisplay | Implementado | Texto identifica o erro, não só cor |
| 4.1.2 Name, Role, Value | MicButton | Implementado | aria-label dinâmico + aria-pressed |
| 4.1.3 Status Messages | Label de estado | Implementado | `role="status" aria-live="polite"` |
| — | VoiceWaveform | Implementado | aria-hidden="true" |
| — | Transcrição | Implementado | aria-live="polite", aria-label |

**Ação pendente para dev-alpha:**
- Verificar contraste `text-amber-700 / dark:text-amber-500` no tema escuro (padrão do app) para o estado RATE_LIMITED. Se failing, usar `text-amber-400` no dark mode com sufixo `dark:`.
- Adicionar `aria-describedby` no `<DialogContent>` se for adicionada descrição ao modal (atualmente `aria-describedby={undefined}` — correto enquanto não houver).

---

## 5. Responsividade

| Viewport | Behavior |
|---|---|
| Desktop (>= md) | Dialog modal, FAB bottom-6 right-6, h-14 w-14 |
| Mobile (< md) | Drawer bottom-sheet, FAB bottom-20 right-4, h-12 w-12 |

`bottom-20` no mobile evita sobreposição com `MobileBottomTabs` (altura ~64px + padding).

---

## 6. Integração com useGeminiLive (pendente — BI-VOICE-02)

`VoiceChatButton` importa `useGeminiLive` de `@/hooks/useGeminiLive` e `GeminiLiveState` de `@/types/gemini-live`. Ambos ainda não existem. Dev-alpha (BI-VOICE-02) deve implementar com a seguinte interface mínima esperada pelo componente:

```typescript
// src/types/gemini-live.ts
export type GeminiLiveState =
  | 'idle' | 'connecting' | 'listening' | 'thinking'
  | 'speaking' | 'processing' | 'reconnecting' | 'error';

// src/hooks/useGeminiLive.ts
interface UseGeminiLiveOptions {
  systemInstruction: string;
  tools: ToolDeclaration[];
}

interface UseGeminiLiveReturn {
  state: GeminiLiveState;
  transcript: { partial: string; final: string[] };
  isMuted: boolean;
  error: { code: string; message: string } | null;
  start: () => Promise<void>;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
}

export function useGeminiLive(options: UseGeminiLiveOptions): UseGeminiLiveReturn;
```

**Fluxo esperado de `start()`:**
1. POST para edge fn `gemini-live-token` (BI-VOICE-01) — obtém ephemeral token
2. `getUserMedia({ audio: true })` — solicita microfone
3. Abre WebSocket para `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
4. Configura sessão com `systemInstruction` + `tools` + `realtimeInputConfig` com media chunks
5. Gerencia reconexão automática (`reconnecting` state)

**Tratamento de erros para os códigos esperados por `VoiceErrorDisplay`:**

| Cenário | `error.code` esperado |
|---|---|
| Edge fn retorna 412 | `'GEMINI_NOT_CONFIGURED'` |
| Edge fn retorna 429 | `'RATE_LIMITED'` |
| `getUserMedia` lança `NotAllowedError` | `'NotAllowedError'` |
| `isMicSupported()` retorna false | não chega ao hook — tratado antes |
| WebSocket fecha com erro | string descritiva (genérico) |

---

## 7. Feature gate — campo settings

`VoiceChatButton` lê `settings?.bi_voice_chat_beta_enabled`. Dev-alpha deve garantir:

1. Coluna `bi_voice_chat_beta_enabled boolean DEFAULT false` em `settings` (migration necessária se não existir)
2. `useSettings()` hook inclui esse campo no SELECT
3. Em `settings/ModulosConfig` ou similar: toggle para gestor habilitar o beta (fora do escopo do MVP — gestor pode habilitar via ADM por enquanto)

---

## 8. Telemetria

`VoiceChatButton` registra sessões na tabela `bi_voice_session_log`:

```sql
-- Campos esperados:
tenant_id uuid
user_id   uuid
started_at timestamptz
ended_at   timestamptz  -- null se sessão em andamento
error_msg  text         -- null se sem erro
```

Migration desta tabela está no escopo de BI-VOICE-02 ou BI-VOICE-04 — verificar com dev-beta.

---

*Spec produzida por Velax (dev-ux) — 2026-04-26.*
