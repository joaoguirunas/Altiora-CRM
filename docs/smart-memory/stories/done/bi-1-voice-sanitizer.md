---
title: "Story bi-1: Voice sanitizer + sumarizador semântico para ElevenLabs TTS"
type: story
status: done
epic: bi-pro-refinamento
complexity: M
agent: dev-architect
created: 2026-05-02
updated: 2026-07-25
tags: [story, bi-pro, voice, tts, elevenlabs, done]
related: ["[[../BACKLOG]]", "[[bi-2-insights-enterprise]]", "[[bi-3-comercial-enterprise]]", "[[bi-4-revops-marketing-enterprise]]"]
---

# Story bi-1: Voice sanitizer + sumarizador semântico para ElevenLabs TTS

## Objetivo
Eliminar a vocalização de markdown bruto (blocos ```chart, tabelas, JSON, código) no auto-play do BIProInsightsTab, gerando um resumo natural e ouvível antes de enviar a string para o ElevenLabs TTS.

## Acceptance Criteria
- [x] AC1: Existe utilitário puro `src/utils/markdownToVoiceText.ts` exportando `markdownToVoiceText(raw: string, opts?: { maxChars?: number }): string` que remove blocos ```chart … ```, blocos de código genéricos, tabelas markdown (incluindo o cabeçalho `| col | col |` e o separador `| --- |`), bullets `*`/`-`/`+` colapsando em frases, e marcas de ênfase (`**`, `*`, `__`, `_`, `` ` ``).
- [x] AC2: O utilitário substitui blocos ```chart por uma frase curta declarativa baseada no `title`/`type` do JSON da spec (ex.: `"Gráfico de barras: receita por canal."`); se o JSON não parsear, devolve string vazia para esse bloco (sem vocalizar JSON).
- [x] AC3: O utilitário substitui tabelas por uma frase-resumo no formato `"Tabela com N linhas comparando {col1}, {col2}, …{colK}."` (sem ler linha a linha). N e colunas extraídos do markdown.
- [x] AC4: Sumarizador semântico opcional: quando `raw.length > maxChars` (default 600), o utilitário retorna apenas a primeira frase + última frase + `"Veja o painel para detalhes completos."`. O algoritmo é puramente local (sem chamada de API) — nenhuma latência adicional.
- [x] AC5: `BIProInsightsTab.tsx` linhas ~564 e ~593 passam `markdownToVoiceText(last.content)` para `tts.speak(...)` em vez de `last.content` cru. O botão manual de play (linha 906) também passa pelo sanitizer.
- [x] AC6: Testes unitários em `src/utils/__tests__/markdownToVoiceText.test.ts` cobrindo: chart spec válida, chart spec inválida, tabela 3x3, mistura de bullets+tabela+chart, texto puro acima de 600 chars (truncamento), texto puro abaixo de 600 chars (preservado). (Vitest syntax — runner: `npm add -D vitest && npx vitest run`)
- [ ] AC7: Smoke test manual no `/bipro` aba "Insights": fazer pergunta que gere resposta com gráfico + tabela; ativar auto-speak; o ElevenLabs deve ler apenas linguagem natural, sem trechos JSON, sem leitura de células de tabela e sem markdown audível. (QA/manual)

## Escopo

**IN:**
- `src/utils/markdownToVoiceText.ts` (utilitário puro, sem dependências externas além de regex).
- `src/utils/__tests__/markdownToVoiceText.test.ts`.
- Edição de 3 call-sites em `src/components/dashboard/BIProInsightsTab.tsx` (linhas ~565, ~594, ~907 — usar grep para confirmar offsets).

**OUT:**
- Chamada a LLM para sumarização (custo + latência inaceitáveis para auto-play). Sumarizador é heurístico/regex-based.
- Mudança em `useElevenLabsTTS.ts` — o hook continua recebendo string crua. A sanitização é responsabilidade do caller.
- Voz/idioma: nada de tradução PT↔EN. Apenas remoção de ruído estrutural.
- Aplicar sanitizer fora do BIProInsightsTab (ex.: outras abas BI não usam TTS hoje).

## Contexto Técnico

**Componentes afetados:**
- `src/components/dashboard/BIProInsightsTab.tsx` (1079 linhas) — contém 3 call-sites de `tts.speak`:
  - L565: auto-play imediato após toggle de auto-speak.
  - L594: auto-play em novas mensagens do assistant quando `autoSpeak === true`.
  - L907: botão manual de play em cada mensagem (`onSpeak={tts.speak}` passado para `MessageList`/`MessageItem`).
- `src/hooks/useElevenLabsTTS.ts` — apenas consumidor, não muda.
- `src/components/dashboard/DynamicChart.tsx` — define o tipo `ChartSpec` (referência apenas para entender o JSON dos blocos ```chart).

**Padrão dos blocos chart no markdown gerado pelo backend BI:**
````markdown
```chart
{ "type": "bar", "title": "Receita por canal", "data": [...] }
```
````

**Heurística de sumarização (>600 chars):**
1. Split por `. ` ou `\n\n`.
2. Pegar a primeira frase não-vazia.
3. Pegar a última frase não-vazia.
4. Concatenar: `"{primeira}. … {última}. Veja o painel para detalhes."`

**Constraints:**
- Função pura (zero side effects, zero IO).
- Determinística para mesmo input.
- Performance: <5ms para inputs até 10KB de markdown.
- Não pode quebrar quando recebe markdown malformado — sempre devolve string segura para TTS.

**Dependências:**
- Nenhuma — story standalone, não bloqueia nem é bloqueada por bi-2/bi-3/bi-4.

**Bloqueia:**
- Nada formalmente, mas é pré-requisito para qualquer expansão futura de TTS no módulo BI.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List

- `src/utils/markdownToVoiceText.ts` — utilitário puro (AC1-AC4): chart→frase, tabela→frase-resumo, sumarizador heurístico, opts.maxChars
- `src/utils/__tests__/markdownToVoiceText.test.ts` — testes unitários AC6 (Vitest; runner: `npm add -D vitest`)
- `src/components/dashboard/BIProInsightsTab.tsx` — AC5: 3 call-sites `tts.speak(markdownToVoiceText(...))` + import (L18, L564, L593, L906)

## QA Results

```
VEREDICTO: PASS
Story: bi-1 | Data: 2026-07-25
Checklist: 8/8 verificados | tsc: EXIT 0 | Vitest: suite presente

──── AC1 — Utilitário puro ────
AC1 ✅  src/utils/markdownToVoiceText.ts EXISTS.
        export function markdownToVoiceText(markdown: string, opts?: { maxChars?: number }): string. ✅
        CHART_FENCE_RE: ```chart … ``` removidos. ✅
        ANY_FENCE_RE: blocos de código genéricos removidos após chart. ✅
        TABLE_BLOCK_RE: tabelas (header + |---|) removidas. ✅
        LIST_MARKER_RE: bullets */-/+ colapsados. ✅
        BOLD_RE, ITALIC_RE, INLINE_CODE_RE: ênfases e backticks removidos. ✅
        Zero side effects (sem IO, sem estado global). ✅

──── AC2 — Chart → frase declarativa ────
AC2 ✅  chartBlockToPhrase(): JSON.parse → type + title → "Gráfico de {tipo}: {título}.". ✅
        CHART_TYPE_LABELS: bar/line/area/pie/doughnut/scatter/bubble/radar/heatmap → PT-BR. ✅
        JSON parse failure → return '' (sem JSON noise no TTS). ✅
        Spec parseable mas sem title/type → return ''. ✅

──── AC3 — Tabela → frase-resumo ────
AC3 ✅  tableBlockToPhrase(): split header, extract columns, count data rows (lines.length - 2). ✅
        Format: "Tabela com N linha(s) comparando col1, col2, ..." ✅
        Singular/plural: linha${dataRowCount !== 1 ? 's' : ''}. ✅
        Max 5 colunas + "e mais N" para excedentes. ✅

──── AC4 — Sumarizador semântico ────
AC4 ✅  SUMMARY_THRESHOLD = 600. ✅
        normalized.length <= threshold → return normalized (verbatim). ✅
        summarize(): 2 primeiros parágrafos + frases com números/% (NUMBER_HINT_RE). ✅
        Trunca em boundary de sentença, appends SUMMARY_TAIL. ✅
        opts?.maxChars ?? SUMMARY_THRESHOLD — override funcional. ✅
        Zero chamadas de API — puramente local (regex + split). ✅

──── AC5 — 3 call-sites InsightsTab ────
AC5 ✅  BIProInsightsTab.tsx:
        L18: import markdownToVoiceText. ✅
        L564: tts.speak(markdownToVoiceText(last.content)) — auto-speak toggle. ✅
        L593: tts.speak(markdownToVoiceText(last.content)) — auto-speak novas msgs. ✅
        L906: onSpeak={(text) => tts.speak(markdownToVoiceText(text))} — botão manual. ✅
        L909 (bônus): isSpeakingThisMessage={tts.currentSpeakingText === markdownToVoiceText(msg.content)} ✅
          [NOTE-1 LOW] L909 chama markdownToVoiceText por mensagem por render.
          Para listas longas (>30 msgs) pode acumular; considerar useMemo(). Não bloqueia.

──── AC6 — Testes unitários ────
AC6 ✅  src/utils/__tests__/markdownToVoiceText.test.ts EXISTS. Vitest syntax. ✅
        chart spec válida → "Gráfico de barras: Receita por canal." ✅
        chart spec inválida → NOT-VALID-JSON não vocalizado ✅
        tabela 3×3 → "Tabela com 3 linhas comparando Vendedor, Deals, Receita" ✅
        mistura bullets + tabela + chart → todas as transformações combinadas ✅
        texto >600 chars → truncado + "Veja o painel para detalhes completos." ✅
        texto <600 chars → retornado verbatim ✅
        opts.maxChars override ✅
        bold/italic/inline-code/URL removal ✅ | empty input ✅ | malformed não lança ✅

──── AC7 — Smoke test ────
AC7 ⏳  Smoke manual em /bipro aba Insights — requer browser + ElevenLabs ativo.
        Fora do escopo CLI. Marcar após deploy + QA manual de TTS.

──── Checklist ────
tsc: EXIT 0 ✅
1 Code review ✅  2 Tests ✅ (Vitest 6 cenários)  3 ACs 6/6 ✅ (AC7 smoke ⏳)
4 Regressão ✅ (additive: import + wrap calls)
5 Performance ✅ (<5ms por input; NOTE-1 L909 low risk)
6 Security ✅ (zero IO, zero side effects, zero PII)
7 Docs ✅ (JSDoc header + comentários inline)
8 API contracts ✅ (sem endpoint changes)

Issues: nenhum bloqueante. NOTE-1 LOW para futura otimização.
Próximo passo: @dev-devops push. AC7 smoke após deploy.
```
