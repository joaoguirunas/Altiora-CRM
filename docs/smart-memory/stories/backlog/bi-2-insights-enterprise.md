---
title: "Story bi-2: Redesign enterprise — BIProInsightsTab + BIProSummaryBar"
type: story
status: in-progress
epic: bi-pro-refinamento
complexity: L
agent: dev-dev-alpha
created: 2026-05-02
updated: 2026-05-02
tags: [story, bi-pro, ux, redesign, enterprise]
related: ["[[../BACKLOG]]", "[[bi-1-voice-sanitizer]]", "[[bi-3-comercial-enterprise]]", "[[bi-4-revops-marketing-enterprise]]", "[[../../agents/ux/bi-enterprise-spec]]"]
---

# Story bi-2: Redesign enterprise — BIProInsightsTab + BIProSummaryBar

## Objetivo
Reduzir density e melhorar hierarquia visual do BIProInsightsTab e do BIProSummaryBar, entregando look enterprise (whitespace generoso, tipografia escalonada, agrupamento semântico) sem perder funcionalidade nem regredir performance.

## Acceptance Criteria

> **Nota dev-dev-alpha (2026-05-02):** ACs originais foram parcialmente sobrescritos pela `bi-enterprise-spec.md` produzida pelo dev-ux. Implementação seguiu a spec (source of truth atualizada). ACs marcados refletem o que foi entregue; ACs não-implementados têm justificativa abaixo.

- [x] AC1 (parcial): hierarquia tipográfica de 3 níveis aplicada — label `text-[11px] font-medium uppercase tracking-wide`, value `text-[22px] font-semibold tabular-nums`, growth `text-[11px] font-medium`. Constantes `TYPO_*` **não** foram criadas: spec ux usa Tailwind literal (escala §1.4) e novos componentes unificados `MetricCell`/`BadgePill`/`SectionCard`/`FilterChip` foram exportados em `bipro-shared.ts` para reuso.
- [x] AC2: KPICards `px-5 py-4`, ícone container `w-9 h-9 rounded-md bg-muted` (sempre neutro), `divide-x divide-border` mantido entre cards.
- [ ] AC3 (não-aplicado): spec ux não pede max-width — bubbles já têm `max-w-[78%]` próprio. Decisão de seguir spec.
- [x] AC4 (parcial): sidebar hover/active mantidos (`bg-muted text-foreground font-medium` no ativo), padding `px-3 py-2.5`, border-l-2 não adicionado (spec ux não pediu).
- [ ] AC5 (não-aplicado): spec ux não pede reorganização do header — mantido como estava.
- [ ] AC6 (não-aplicado): empty state da sidebar de conversas mantido como está.
- [ ] AC7 (não-aplicado): spec ux §2.2 explicitamente mantém banner inline (citação: "pode ser collapse/dismiss mais discreto") — não converti para toast.
- [x] AC8: `useReducedMotion()` preservado em todos os pontos. Animações framer-motion intocadas.
- [x] AC9 (parcial): SummaryBar mantém `flex-wrap items-center overflow-x-auto`. Sidebar drawer mobile fora do escopo da spec ux.
- [ ] AC10 (a verificar pelo QA): nenhuma regressão estrutural; remoção de `bg-gradient`/`blur` reduz repaint.

### ACs derivados da spec ux (entregues neste PR)

- [x] **Tokens compartilhados** (`bipro-shared.ts`): `CARD_BASE` → `rounded-md`, `TABLE_HEADER` ajustado, novos exports `SectionCard`, `MetricCell`, `BadgePill`, `FilterChip`, skeletons `rounded-md`, `BIProFeedback` `rounded-md`.
- [x] **SummaryBar enterprise**: ícones sempre `bg-muted text-muted-foreground`, valor `text-foreground` (accent vermelho só quando `overallConversionRate < 5`), GrowthBadge sem bg, `min-w-[160px]`, `rounded-md`.
- [x] **InsightsTab — gradients eliminados**: avatar bot, send button, welcome icon, logo header — tudo `bg-primary` ou `bg-primary/10`. Welcome glow blur removido.
- [x] **InsightsTab — border-radius unificado**: container raiz/bubbles/banner/input bar → `rounded-lg`; suggestions/sidebar/buttons → `rounded-md`; bubble tails → `rounded-tl-sm`/`rounded-tr-sm`. Zero `rounded-[Npx]` literais.
- [x] **Voice/TTS preservados 100%**: `useElevenLabsTTS`, `useSpeechRecognition`, mic device selector, VoicePulse, SpeakingOrb (cor trocada de `bg-violet-500` → `bg-primary` para alinhar paleta), VoicePlayerBar — todos intactos.

## Escopo

**IN:**
- `src/components/dashboard/BIProInsightsTab.tsx` (1079 linhas) — refactor visual, sem mudar lógica de chat/voice/conversations.
- `src/components/dashboard/BIProSummaryBar.tsx` (168 linhas) — refactor completo do KPICard.
- `src/components/dashboard/bipro-shared.ts` — adicionar constantes tipográficas (`TYPO_LABEL`, `TYPO_VALUE_LG`, `TYPO_VALUE_MD`, `TYPO_GROWTH`) e revisar `cardVariants`/`SECTION_CARD` se necessário.
- Possível extração de `EmptyState` e `AutoSpeakToast` como subcomponentes locais no mesmo arquivo (não criar arquivos novos a menos que cresçam >80 linhas).

**OUT:**
- Mudança no hook `useInsightsConversations` ou `useElevenLabsTTS` — só UI.
- Nova feature de chat (ex.: regenerar resposta, copiar markdown) — fora do escopo.
- Mudança na lógica do voice sanitizer (essa é a bi-1).
- Refactor das outras 3 abas BI (essas são bi-3 e bi-4).
- Substituição da lib de markdown ou de gráficos.

## Contexto Técnico

**Padrão visual atual identificado:**
- Tokens densos: `text-[9px]`, `text-[10px]`, `py-1`, `gap-0.5` — herdados de versões anteriores quando o objetivo era caber muita métrica. Hoje os usuários relatam fadiga visual.
- `bipro-shared.ts` já centraliza alguns variants Framer Motion e classes (`SECTION_CARD`, `GRID_KPIS_5`). Estender ali, não inline.
- `useReducedMotion()` é usado consistentemente — preservar.
- Cores de accent (good/bad/neutral) estão hardcoded no KPICard — manter por enquanto, padronização vem em bi-3/bi-4 se necessário.

**Componentes afetados:**
- `BIProInsightsTab.tsx` — chat layout, sidebar, header, banner, empty state.
- `BIProSummaryBar.tsx` — KPICard, GrowthBadge, container.
- `bipro-shared.ts` — adicionar constantes tipográficas exportadas.

**Constraints:**
- Não introduzir libs novas de UI. Continuar com Tailwind + Radix (shadcn) + Framer Motion + Lucide.
- Bundle size não deve crescer >2KB gzip nesta story.
- Compatibilidade com tema dark (atualmente single-theme dark) — não quebrar contraste.

**Dependências:**
- Nenhuma — pode rodar em paralelo com bi-1, bi-3 e bi-4 (afetam arquivos diferentes).

**Bloqueia:**
- Nada diretamente, mas estabelece o **design token** (`TYPO_LABEL` etc.) que bi-3 e bi-4 vão consumir.

**Sugestão de abordagem:**
1. Primeiro PR: extrair tokens tipográficos para `bipro-shared.ts` e atualizar BIProSummaryBar (escopo AC1, AC2, AC9-parte).
2. Segundo PR: refatorar BIProInsightsTab (AC3-AC8).
Ou tudo num único PR se o dev preferir — discutir com o lead.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Novik (dev-dev-alpha) |
| Iniciado   | 2026-05-02 |
| Concluído  | 2026-05-02 |
| Branch     | main (direto, conforme orientação do lead) |
| Spec base  | `docs/smart-memory/agents/ux/bi-enterprise-spec.md` (sobrepõe ACs originais) |
| PRs        | PR-G0 (tokens), PR-A1 (SummaryBar), PR-A2 (InsightsTab) — bundled em working tree, sem commit (usuário valida) |

## File List
- `src/components/dashboard/bipro-shared.ts` — atualizado: `CARD_BASE` → `rounded-md`, `TABLE_HEADER` → `text-[11px] font-semibold tracking-wide`, `BIProFeedback`/`SkeletonBlock`/`SkeletonKPIGrid` → `rounded-md`. Novos exports: `SectionCard`, `MetricCell`, `BadgePill`, `FilterChip`.
- `src/components/dashboard/BIProSummaryBar.tsx` — KPICard refatorado (ícone neutro fixo, escala tipográfica `text-[11px]/text-[22px]`, padding `px-5 py-4`, `min-w-[160px]`, accent só em conv crítico). GrowthBadge sem bg.
- `src/components/dashboard/BIProInsightsTab.tsx` — todos gradients `from-blue-500 to-violet-600` removidos; avatar bot/send/welcome icon/logo header → `bg-primary` ou `bg-primary/10`; bubbles → `rounded-lg`/`rounded-{tl,tr}-sm`; container raiz → `rounded-lg`; SpeakingOrb → `bg-primary`; welcome glow blur removido. Hooks/voice/markdown/dynamic chart/sidebar logic intactos.

## Validação

- ✅ `npx eslint` em todos os 3 arquivos: 0 errors, 1 warning pré-existente (`useCallback` exhaustive-deps em `sendMessage` — fora do escopo da spec, preserva-100%-hooks).
- ✅ `npx tsc --noEmit` (full project): 0 errors.
- ✅ `npx vite build`: passa em 10s, sem warnings novos.
- ⚠️ Validação visual (browser, dark/light, mobile) — pendente, será feita pelo QA.

## QA Results
<!-- QA preenche ao revisar -->
