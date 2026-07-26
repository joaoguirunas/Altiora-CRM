---
title: BI PRO Enterprise Visual Spec
type: component-spec
agent: dev-ux
updated: 2026-05-02
tags: [ux, bi-pro, enterprise, refactor]
references:
  - "[[project/modules/bi-pro]]"
  - "[[agents/ux/components]]"
---

# BI PRO — Enterprise Visual Spec

Spec de refinamento visual do módulo BI PRO. Reduz density, melhora hierarquia, traz look enterprise (Looker / Linear / Metabase como referência).

**Escopo:** apenas estilo, espaçamento, hierarquia, paleta. **Não mexer em**: hooks de dados (`useBIProKPIs`, `useBIProRevOps`, `useBIProAttribution`, `useBIProSchedules`, `useBIProCRM`, `useBIProFunnel`), lógica de negócio, queries Supabase, formatters em `bipro-shared.ts`, ou comportamento de filtros.

---

## 1. Princípios gerais

### 1.1 Filosofia

> Enterprise BI = **dados protagonistas, cromatismo coadjuvante**.

Cada decisão visual deve responder: "isso ajuda o leitor a entender o número mais rápido?". Se a resposta for "deixa mais bonito" — remover.

### 1.2 Os 6 ajustes que mudam tudo

| # | Princípio | Antes (hoje) | Depois |
|---|---|---|---|
| 1 | **Cor é semântica, não decoração** | Ícone azul, número verde, gradient violeta no topo | Ícone neutro (muted-foreground), número foreground, accent só para status (good/medium/bad) |
| 2 | **Um peso visual por seção** | Vários cards com top-bar gradient + título bold + badges + chart | Card chapado, título sutil, dados em destaque |
| 3 | **Border-radius consistente** | Mix de `[2px]`, `[4px]`, `[8px]`, `rounded-full` | `rounded-md` (6px) padrão; `rounded-full` só para badges/avatares |
| 4 | **Tipografia em escala harmônica** | 10 tamanhos: 9, 10, 11, 12, 13, 14, 18, 22, 28, 30 px | 5 tamanhos: 11 (label), 13 (body), 15 (subtítulo), 22 (KPI hero), 28 (KPI principal) |
| 5 | **Espaçamento generoso** | px-3 py-2.5, gap-3, padding apertado | px-6 py-5 em cards, gap-6 em grids, py-4 em rows de tabela |
| 6 | **Remover gradients gratuitos** | `bg-gradient-to-br from-blue-500 to-violet-600` em ícones, headers, botões | Cor sólida do design system (`bg-primary`, `bg-muted`) |

### 1.3 Paleta enterprise (sóbria)

**Manter Tailwind tokens shadcn (`foreground`, `muted-foreground`, `border`, `card`, `muted`, `primary`).** Restringir cores literais ao mínimo:

| Uso | Cor | Quando |
|---|---|---|
| Texto principal | `text-foreground` | Valores, títulos |
| Texto secundário | `text-muted-foreground` | Labels, sub, descrições |
| Texto fraco | `text-muted-foreground/60` | Helper, placeholder, contagens |
| Borda | `border-border` | Tudo |
| Fundo card | `bg-card` | Cards |
| Fundo neutro | `bg-muted/40` | Hover, seções alternadas |
| **Accent positivo** | `text-emerald-600` (light) / `text-emerald-400` (dark) | Crescimento, meta atingida, won |
| **Accent atenção** | `text-amber-600` / `text-amber-400` | Pendência, perto da meta |
| **Accent crítico** | `text-red-600` / `text-red-400` | Queda, no-show, abaixo da meta |
| **Accent info** | `text-primary` | Filtros ativos, links, valor selecionado |

**Banir** (para versão enterprise):
- ❌ `from-blue-500 to-violet-600` (gradient brand)
- ❌ `from-blue-500 via-violet-500 to-emerald-500` (gradient triplo)
- ❌ `text-violet-600` em KPI quando "investimento" — usar foreground
- ❌ Cor por categoria em ícone de KPI (todos os ícones devem ser muted-foreground)
- ❌ `bg-blue-500/5` em coluna "current" de tabela — usar `font-semibold` para destacar

**Permitido (com parcimônia)**:
- Top-bar accent de 2px só na **primeira KPI da página** (hero), e na cor `bg-border` neutra ou cor única `bg-primary/40`
- Cores de plataforma na coluna platform-dot (Marketing) — são identificadores, não decoração

### 1.4 Tipografia — escala definitiva

```
text-[11px]  → labels uppercase, sub-text, helper, count badges
text-[13px]  → body, valores em tabela, descrições
text-[15px]  → subtítulos de seção, KPI compacto
text-[22px]  → KPI valor (cards secundários e summary bar)
text-[28px]  → KPI valor (hero, RevOps row 1)
```

Pesos:
- `font-semibold` (600) para subtítulos e valores em tabela
- `font-bold` (700) para KPIs grandes e count em badge
- `font-medium` (500) para labels e nav
- Banir `font-extrabold`, `font-black`

`tabular-nums` em **todo número** (mantido — está correto hoje).
Banir `tracking-widest` em label normal — usar `tracking-wide` (mais sutil).

### 1.5 Espaçamento — escala definitiva

| Token | Tailwind | Uso |
|---|---|---|
| xs | `gap-2` / `p-2` | Inline (badge interno, ícone+texto) |
| sm | `gap-3` / `p-3` | Conteúdo denso justificado (filter chips) |
| md | `gap-4` / `p-4` | Padrão dentro de card |
| **lg** | `gap-6` / `p-6` | **Padrão card → conteúdo** |
| xl | `gap-8` / `p-8` | Entre seções principais (grid de cards) |

**Mudança crítica:** `space-y-5` entre seções → `space-y-6`. Cards `px-5 py-4` → `px-6 py-5`. Tabelas `px-3 py-2.5` → `px-4 py-3.5`.

### 1.6 Border-radius — uma decisão final

```
rounded-md     (6px)   → cards, botões, inputs, células de KPI
rounded-lg     (8px)   → modais, popovers
rounded-full          → badges, contagens, avatares, dots
rounded-sm     (2px)   → barras de progress fininhas
```

**Substituir todo `rounded-[2px]` por `rounded-md`.** É o ajuste com maior impacto visual com menor risco.

### 1.7 Bordas e sombras

- Bordas: `border border-border` (já é shadcn) — manter
- **Remover toda `box-shadow` customizada** (`boxShadow: '0 8px 24px rgba(0,0,0,.4)'` em tooltips). Usar `shadow-sm` apenas no tooltip recharts
- Cards: **sem sombra**. Apenas `border border-border` — Looker/Linear style
- Divisores entre células de KPI strip: usar `divide-x divide-border` (mantém) **mas com `mx-6` no divisor `border-t border-border`** para respiro

### 1.8 Animações — manter mas calibrar

- Manter `framer-motion` containerVariants/cardVariants/rowVariants
- **Stagger atual:** 0.07s — manter
- **Reduzir hover scale:** `whileHover={{ scale: 1.05 }}` → remover (ou trocar para `bg-muted/60` opacity transition)
- **Banir** scale em ícones de KPI (`animate={isHovered ? { scale: 1.08 }`) — desnecessário
- Manter `useReducedMotion` (correto)

---

## 2. Por tela

### 2.1 BIProSummaryBar (KPI strip topo do dashboard)

**Status hoje:** 6 KPIs em barra horizontal com `divide-x`, ícones coloridos por categoria, label em `text-white/40` (problema de contraste em light mode), `font-mono` no label (estranho).

**Mudanças:**

| Local | Antes | Depois |
|---|---|---|
| Container | `rounded-[2px]` | `rounded-md` |
| Padding card cell | `px-4 py-3` | `px-5 py-4` |
| min-width cell | `min-w-[140px]` | `min-w-[160px]` |
| Ícone bg | `bg-emerald-500/10` / `bg-red-500/10` / `bg-muted` (varia) | **Sempre `bg-muted`** — accent só no número |
| Ícone color | `text-emerald-500` / `text-red-500` / `text-foreground` (varia) | **Sempre `text-muted-foreground`** |
| Label | `text-[9px] font-mono font-bold uppercase tracking-widest text-white/40` | `text-[11px] font-medium uppercase tracking-wide text-muted-foreground` |
| Valor | `text-[18px] font-bold` com accent color | `text-[22px] font-semibold text-foreground` (accent só se status crítico) |
| GrowthBadge | inline ao lado | manter, mas **sem bg** — só ícone + texto colorido |

**Hierarquia:** o número é o protagonista. Label discreto acima, valor grande embaixo, growth como sub-info compacta.

```
┌──────────────────────────────────────────────────────────┐
│  [Card unico, border, rounded-md]                        │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│ │ □  RECEITA TOTAL │ □  CPL │ □  CAC │ □  CONV │ □ ... │ │
│ │ 245K  ↑ 12%      │ R$ 84  │ R$ 1.2K│ 18.3%   │       │ │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2.2 BIProInsightsTab (chat AI)

**Status hoje:** chat funcional, mas chrome poluído — gradient azul→violeta no avatar do bot, em botão send, em welcome icon, em logo header. Borders mistas (`rounded-[2px]`, `rounded-[8px]`, `rounded-[4px]` no mesmo card).

**Princípio:** chat é a feature. UI deve sumir.

**Mudanças:**

| Componente | Antes | Depois |
|---|---|---|
| Container raiz | `rounded-[2px] border` | `rounded-lg border` |
| Avatar bot (header + bubble) | `bg-gradient-to-br from-blue-500 to-violet-600` | `bg-primary` (sólido) — ou `bg-foreground/90` para mais sobriedade |
| Avatar speaking state | `bg-gradient-to-br from-violet-500 to-fuchsia-600 ring-2 ring-violet-500/30` | `bg-primary ring-2 ring-primary/30` (manter ring) |
| Welcome icon | gradient + glow blur | ícone `bg-primary/10` com `Sparkles text-primary` simples |
| Bubble user | `bg-gradient-to-br from-blue-500 to-violet-600 text-white rounded-[8px] rounded-tr-[2px]` | `bg-primary text-primary-foreground rounded-lg rounded-tr-sm` |
| Bubble assistant | `bg-card text-foreground rounded-[8px] rounded-tl-[2px] border` | `bg-card rounded-lg rounded-tl-sm border` (manter) |
| Send button | `bg-gradient-to-br from-blue-500 to-violet-600` | `bg-primary` |
| Suggestions card | `rounded-[2px]` | `rounded-md` |
| Sidebar new conv | `rounded-[2px]` | `rounded-md` |
| Sidebar item | `rounded-[2px]` | `rounded-md` |
| Logo Insights AI no header | gradient | `bg-primary/10` + `Sparkles text-primary` |

**Manter como está:**
- Layout de 2 colunas (sidebar + chat)
- VoicePulse / SpeakingOrb (são animações funcionais, não decoração)
- LoadingDots
- Markdown renderer
- Chart inline rendering

**O que pode sumir:**
- Banner consent "Narrar respostas em voz" pode ser collapse/dismiss mais discreto (já tem AnimatePresence — só ajustar visual: remover bg gradient se houver)

### 2.3 BIProComercialTab

**Status hoje:** denso — tabela "Comparativo de Período" com 5 colunas de semanas + 12 linhas de métricas + delta badges + pivot dentro. Tabela "Comparativo por Closer" com 12 colunas + group headers + sub-headers de ícones + filter chips. Cada KPI cell com ícone colorido individual.

**Esta é a tela que mais precisa de refino. Densa demais.**

#### 2.3.1 Seção 1 — Resumo Consolidado (topo)

| Antes | Depois |
|---|---|
| Top bar `bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 h-[3px]` | **REMOVER** |
| 2 grids de 5 KPIs separados por `border-t` | **Consolidar em 1 grid de 10** (responsive: 2/5/10) com divider sutil entre as duas linhas conceituais (reuniões vs propostas) |
| Cada `MetricCell` com ícone colorido por categoria | Ícone sempre `text-muted-foreground` em `bg-muted` |
| Valor com cor por accent (text-blue-600, text-emerald-600, text-violet-600...) | **Valor sempre `text-foreground`** — accent só nos status reais (showPct < 50 → red, vendas > 0 → emerald, no-show > 0 → red) |

#### 2.3.2 Seção 2 — Comparativo de Período (tabela pivot)

A tabela tem 12 linhas × 5 semanas = 60 células densas. Mudanças críticas:

| Local | Antes | Depois |
|---|---|---|
| Padding célula | `px-3 py-2.5` (table cells) e `px-4 py-3` (header) | `px-4 py-3.5` |
| Header bg | `bg-muted` | `bg-muted/40` (mais sutil) |
| Highlight coluna current | `bg-blue-500/5` | **Sem bg** — usar `border-l-2 border-l-primary` à esquerda da coluna current |
| Fonte coluna current | `text-blue-400` | `text-foreground font-semibold` |
| Linhas filhas (`isChild`) | `text-muted-foreground/50 italic pl-8` | `text-muted-foreground pl-10` (sem itálico, padding maior) |
| DeltaBadge | inline com cor | manter, mas só na coluna current |
| Series legend (chips) | botões com border colorida + bg colorido | unificar visual: chips `bg-muted/40 border border-border` quando inativo, `bg-primary/10 text-primary border-primary/20` quando ativo. Color dot mantém cor da série |
| Chart colors (`CHART_COLORS`) | 9 cores misturadas | Reduzir para 5: blue, green, orange, red, purple — e usar **opacidade variável (40/70/100%) para variação dentro da mesma família** |
| Toolbar (Semana / Mês / nav) | `border-primary/40 bg-primary/10 text-primary` quando active | manter — esse padrão tá ok |
| KPI summary baixo do chart | 4 cells com ícone colorido | Mesmo padrão da seção 1.1 — ícone `text-muted-foreground`, valor `text-foreground` |

#### 2.3.3 Seção 3 — Comparativo por Closer

A pior tabela em density. 12 colunas é demais.

**Decisão estrutural:** **agrupar visualmente Reuniões / Temperatura / Vendas em 3 sub-blocos colapsáveis**, default mostrando só Reuniões + Vendas. Usuário expande Temperatura quando precisa.

```
┌───────────────────────────────────────────────────────────────────┐
│ COMPARATIVO POR CLOSER                            [12 closers]    │
│ [Todos] [Atualizar] [Compareceu] [No Show] [Remarcar]            │
├───────────────────────────────────────────────────────────────────┤
│                  REUNIÕES               VENDAS                    │
│ Closer    │ Agend │ Real │ Show% │ N/S │ Vendas │ Conv% │ +Temp │
│ ─────────────────────────────────────────────────────────────────│
│ João S.   │  24   │  18  │  75%  │  6  │   4    │  22%  │  ▼    │
│ Maria L.  │  32   │  21  │  66%  │ 11  │   6    │  29%  │  ▼    │
│ ...                                                                │
└───────────────────────────────────────────────────────────────────┘
```

| Local | Antes | Depois |
|---|---|---|
| Group header row (Reuniões / Temperatura / Vendas) | 3 grupos sempre visíveis | **Default**: Reuniões + Vendas. Temperatura por trás de toggle "+Temp" na linha (botão `▼` que expande inline 3 colunas extra) |
| Sub-header com ícones coloridos | `Calendar text-blue-500`, `CheckCircle2 text-emerald-500`, etc | Texto curto: "Agend.", "Real.", "Show%", "N/S" — sem ícone (ícone faz "ruído visual" em sub-header tão denso) |
| Linha hover | `bg-muted` | `bg-muted/40` |
| Linha expanded | `bg-primary/5` | `bg-muted/60` (sem cor) |
| Avatar circle | `bg-primary/10 text-primary` | manter |
| Filter chips counts | `bg-primary/15` quando active | manter, mas reduzir border-radius para `rounded-md` (não `full`) |
| Cell padding | `px-3 py-2.5` | `px-4 py-3.5` |
| Border vertical entre grupos (`border-l border-border`) | manter | manter, mas com `border-l-muted` (mais sutil) |
| ScoreBadge / TemperatureBadge cores | bg/border/text por temperatura | manter (esses SIM são semânticos — quente/morno/frio é a info principal). **Reduzir opacidade do bg** (10% → 8%) |
| Botão Btn (filter pills no chart) | `border-primary/40 bg-primary/10` | manter |

#### 2.3.4 CloserLeadTable (expandida dentro do closer)

| Local | Antes | Depois |
|---|---|---|
| Container | `bg-muted` | `bg-muted/30` |
| Filter chips | `rounded-full border` | `rounded-md` (consistência) |
| Filter chip count | `bg-primary/15` ou `bg-border` | manter, ajustar para `rounded-md` |
| Status icons (CheckCircle, AlertCircle...) | cores fortes | manter — são semânticas |
| ExternalLink hover | `hover:text-primary` | manter |

### 2.4 BIProMarketingTab

**Status hoje:** mais limpa que Comercial. Problemas: top-bar gradient triplo na KPI summary, cores em valores ("text-violet-600" em Investimento sem motivo), tabela "AttrTable" densa mas funcional.

| Local | Antes | Depois |
|---|---|---|
| KPI summary top bar gradient | `from-blue-500 via-violet-500 to-emerald-500` | **REMOVER** |
| KPI summary container | `rounded-[2px]` 2 grids de 4 | `rounded-md` 1 grid de 8 (responsive 2/4/8) com divider |
| KPI accent ("text-violet-600" no Investimento, "text-blue-600" em Leads) | cor por categoria | **Remover todos** — só `text-foreground`. Manter `text-emerald-600`/`text-red-500` no ROI conforme valor |
| MetricCell ícone | bg-muted, color varia | bg-muted, **color sempre `text-muted-foreground`** |
| Section card padding | `px-5 py-4` | `px-6 py-5` |
| ROIBadge | `bg + border + text` por status | manter — semântico |
| Tabela AttrTable | `px-3 py-3` cells | `px-4 py-3.5` |
| Tabela AttrTable highlight first row | `bg-muted` (linha 0) | **Remover** — substituir por `border-l-2 border-l-primary` na primeira linha |
| Tabela AttrTable max rows | 10 (slice) | manter, **adicionar "Ver mais" se houver overflow** (footer link) |
| TrendChart border-top | `border-t border-border px-5 py-4` | `border-t border-border px-6 py-5` |
| TrendChart legend | inline com dot colorido | manter |
| Chart tooltip boxShadow | `'0 8px 24px rgba(0,0,0,.15)'` | `shadow-sm` (Tailwind) |
| FORM PRO header pills (`bg-muted border border-border px-2.5 py-1 rounded-full`) | mantém | mantém |
| Empty state ("Em breve" Grupo de Anúncios) | `Layers w-8 h-8 opacity-30` | manter |

### 2.5 BIProRevOpsTab

**Status hoje:** a mais "showy" — HeroKPI com gradient top-bar, ProgressRing com gradient, CustomerJourneyFunnel com 6 cores brutalmente vivas (azul, violeta, ciano, esmeralda, âmbar, vermelho) e 3D glow effects, CR Benchmarks com top-bar gradient em CADA card.

#### 2.5.1 Hero KPIs (Row 1)

| Local | Antes | Depois |
|---|---|---|
| Top accent bar | `bg-gradient-to-r from-blue-500 to-violet-500` (etc) | **REMOVER** (todas as 3 hero cards) |
| Ícone container | `p-2 rounded-[2px] bg-gradient-to-br from-...` | `p-2 rounded-md bg-muted` com `Icon text-muted-foreground` |
| ProgressRing color | gradient `url(#ringGrad)` blue→violet | sólido `text-primary` (passar `stroke="currentColor"` no circle) |
| Trend badge | `text-emerald-700 bg-emerald-50 border border-emerald-200` | manter (semântico) |
| Valor (`text-[30px]`) | `text-[30px] font-bold` | `text-[28px] font-bold` (alinhar à escala) |
| Label (`text-[12px]`) | `text-[12px] font-medium text-muted-foreground` | manter |
| Sub | `text-[11px] text-muted-foreground/60` | manter |
| Border-radius | `rounded-[2px]` | `rounded-md` |
| Padding | `p-5` | `p-6` |

#### 2.5.2 CustomerJourneyFunnel (Row 2)

A peça mais "decorativa". Decisão: manter o conceito (funnel 3D horizontal), mas **drasticamente sóbrio**.

**Opção A (recomendada):** trocar 3D trapezoid por **funnel 2D simples** estilo Linear/Metabase — barras horizontais decrescentes empilhadas com largura proporcional, sem 3D, sem glow.

```
┌──────────────────────────────────────────────────────────┐
│ CUSTOMER JOURNEY                            240 leads    │
├──────────────────────────────────────────────────────────┤
│                                                            │
│ TOPO    ████████████████████████████   240         100%  │
│              ↓ -82  CR1 65.8%                             │
│ MQL     ███████████████████             158         65.8% │
│              ↓ -47  CR2 70.2%                             │
│ SQL     ███████████████                 111         46.2% │
│              ↓ -38  CR3 65.7%                             │
│ SAL     ███████████                      73         30.4% │
│              ↓ -52  CR4 28.7%                             │
│ WIN     ████                             21          8.7% │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

Implementação:
- Cada etapa = `<div>` com `width: ${pct}%` em `bg-primary/15` + label dentro
- Conector entre etapas = linha com `↓ -X CR Y%` (pequeno, muted)
- Hover: bar muda para `bg-primary/25`, value bold
- **Banir:** clipPath polígono, gradient 3D, boxShadow glow, escala em hover

**Opção B (manter conceito 3D mas refinar):**
- Reduzir paleta para 1 cor (`bg-primary` com opacidade decrescente: 100%, 80%, 60%, 40%, 25%)
- Remover glow boxShadow
- Remover scale animado em hover (só leve `opacity` change)
- Manter trapezoid

**Recomendação UX: Opção A.** É o padrão visual de Looker/Metabase para funnel. Opção B mantém efeito wow mas vai contra o objetivo "enterprise sóbrio".

#### 2.5.3 Diagnóstico (Row 3 dir.)

| Local | Antes | Depois |
|---|---|---|
| Item card | `bg-muted hover:bg-muted` | `bg-muted/40 hover:bg-muted/60` |
| Accent bar (`w-1 h-6` por cor) | manter (é o único identificador visual) | manter, **mas usar tokens** — não cores literais (`#3b82f6` → `bg-primary`, `#f43f5e` → `bg-destructive`, etc) |

#### 2.5.4 SecKPI (Row 3 esq.)

| Local | Antes | Depois |
|---|---|---|
| Top accent line `bg-gradient-to-r` | **REMOVER** | — |
| Border-radius | `rounded-[2px]` | `rounded-md` |
| Padding | `p-4` | `p-5` |
| Valor `text-[22px]` | manter | manter |

#### 2.5.5 CR Benchmarks (Row 4)

| Local | Antes | Depois |
|---|---|---|
| Top accent bar em CADA card | `bg-gradient-to-r from-emerald-500 to-teal-400` (etc) | **REMOVER** |
| Card border-radius | `rounded-[2px]` | `rounded-md` |
| Card padding | `p-4` | `p-5` |
| Bar progress gradient | `from-emerald-500 to-teal-400` | sólido — `bg-emerald-500` / `bg-amber-500` / `bg-red-500` (sem gradient) |
| StatusIcon (`CheckCircle2 / AlertTriangle / AlertCircle`) | manter | manter — semântico |
| Valor (`text-[28px]`) | manter | manter |
| Edit input | `bg-muted border` | `bg-background border` (mais clean em modo edit) |
| Diagnosis collapsible | manter | manter, **bg do bloco expandido** = `bg-muted/40` (não `bg-red-50`) |

#### 2.5.6 Top Closers / Campaign Performance (Rows 6, 7)

| Local | Antes | Depois |
|---|---|---|
| Container border-radius | `rounded-[2px]` | `rounded-md` |
| Header `px-5 py-4` | | `px-6 py-5` |
| Tabela `px-4 py-2.5/3` | | `px-4 py-3.5` |
| Avatar `bg-muted text-muted-foreground` | manter | manter |
| CR4% pill | `bg-emerald-50 border border-emerald-200` por status | manter — semântico |
| Mini volume bar (Campanhas) | `from-blue-500 to-violet-500` | sólido `bg-primary` |
| `last:border-0` | manter | manter |

#### 2.5.7 Evolução Semanal CR (Row 8)

| Local | Antes | Depois |
|---|---|---|
| AreaChart cores | `#3b82f6, #8b5cf6, #06b6d4, #10b981` | manter (séries diferentes precisam cor diferente) — **mas diminuir saturação 10%** |
| Gradient fill stop opacity | `0.18` | `0.12` (mais sutil) |
| Tooltip | bg-card border rounded-[2px] | `rounded-md shadow-sm` |
| Badge "X semanas" pill | `rounded-full` | manter |

---

## 3. Componentes a padronizar (cross-cutting)

### 3.1 SectionCard (já existe em Comercial e Marketing)

**Spec final unificada** (mover para `bipro-shared.ts` como `SectionCard` exportado):

```tsx
function SectionCard({ title, subtitle, badge, right, children }: Props) {
  return (
    <div className="border border-border bg-card rounded-md overflow-hidden">
      <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge && (
            <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              {badge}
            </span>
          )}
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}
```

**Mudanças vs hoje:**
- Title: `text-[13px]` → `text-[15px]` (era apertado)
- Subtitle: `text-[11px]` → `text-[12px]`
- Padding: `px-5 py-4` → `px-6 py-5`
- Badge: removido `border border-border` (só `bg-muted/60` é suficiente)
- Border-radius: `[2px]` → `md`

### 3.2 MetricCell (existe em Comercial e Marketing — divergente)

**Spec final unificada:**

```tsx
function MetricCell({ label, value, sub, accent, icon: Icon }: Props) {
  return (
    <div className="flex items-start gap-3 min-w-0 px-5 py-4">
      {Icon && (
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-muted shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </span>
        <span className={cn(
          "text-[22px] font-semibold leading-none tabular-nums tracking-tight",
          accent || "text-foreground"
        )}>
          {value}
        </span>
        {sub && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{sub}</span>
        )}
      </div>
    </div>
  );
}
```

**Mudanças vs hoje:**
- Ícone bg/color **fixos** (`bg-muted` / `text-muted-foreground`) — `accent` só afeta o número
- Ícone container `w-8 h-8` → `w-9 h-9` (mais respiro)
- Label `text-[10px]` → `text-[11px]`, `tracking-widest` → `tracking-wide`
- Valor `text-lg font-bold` → `text-[22px] font-semibold`
- Padding interno `py-1` → `px-5 py-4`

### 3.3 BadgePill (count, contador) — novo componente

Criar em `bipro-shared.tsx`:

```tsx
export function BadgePill({ children, variant = 'default' }: {
  children: React.ReactNode;
  variant?: 'default' | 'good' | 'warning' | 'bad' | 'info';
}) {
  const variants = {
    default: 'bg-muted/60 text-muted-foreground',
    good:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    warning: 'bg-amber-50  text-amber-700  dark:bg-amber-950/40  dark:text-amber-400',
    bad:     'bg-red-50    text-red-700    dark:bg-red-950/40    dark:text-red-400',
    info:    'bg-primary/10 text-primary',
  };
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full",
      variants[variant]
    )}>
      {children}
    </span>
  );
}
```

Substituir todos os `<span className="text-[X] font-bold ...">` espalhados por `<BadgePill variant="...">`.

### 3.4 Tabela — variant enterprise

**Padronizar todas as tabelas BI:**

```tsx
// Header row
<tr className="border-b border-border bg-muted/40">
  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
    {label}
  </th>
</tr>

// Body row
<tr className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
  <td className="px-4 py-3.5 text-[13px] text-foreground tabular-nums">{value}</td>
</tr>
```

**Mudanças vs hoje:**
- Header bg `bg-muted` → `bg-muted/40`
- Header text `font-bold tracking-widest` → `font-semibold tracking-wide`
- Cell padding `px-3 py-2.5` → `px-4 py-3.5`
- Hover `bg-muted` → `bg-muted/40`
- **Remover** `bg-blue-500/5` em coluna current — usar `border-l-2 border-l-primary` na primeira `<td>` da coluna

### 3.5 Filter chips (5 variantes hoje, unificar)

```tsx
function FilterChip({ active, count, children, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      {children}
      {count != null && (
        <span className={cn(
          "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
          active ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
```

Banir: `rounded-full` em chip de filtro com count (visual "blob"). Usar `rounded-md`.

### 3.6 Skeleton

`SkeletonBlock` e `SkeletonKPIGrid` em `bipro-shared.ts` — atualizar:
- `rounded-[2px]` → `rounded-md`
- Manter `animate-pulse bg-muted`

---

## 4. Hierarquia da informação (o que é crítico, secundário, opcional)

### 4.1 Por tela — hierarquia visual

**BIProSummaryBar:**
- 🟢 Crítico: valor numérico, growth %
- 🟡 Secundário: label
- 🔵 Opcional: ícone (pode esconder em mobile)

**BIProInsightsTab:**
- 🟢 Crítico: mensagem do bot, input
- 🟡 Secundário: histórico, sugestões welcome
- 🔵 Opcional: voice player, mic selector, banner consent

**BIProComercialTab — Resumo Consolidado:**
- 🟢 Crítico: Vendas, Comparecimento%, No Show, Quente
- 🟡 Secundário: Novas Reuniões, Compareceram, RR%
- 🔵 Opcional: Atualizar, Morno, Frio (podem virar secundary cards)

**BIProComercialTab — Comparativo por Closer:**
- 🟢 Crítico: nome, Vendas, Conv%, Show%
- 🟡 Secundário: Agendadas, Realizadas, No Show
- 🔵 Opcional: Quente/Morno/Frio (default colapsado, expandir sob demanda) ← **mudança recomendada**

**BIProMarketingTab — KPI summary:**
- 🟢 Crítico: ROI, Investimento, Leads
- 🟡 Secundário: CTR, CPL, CPM
- 🔵 Opcional: Impressões, Cliques

**BIProRevOpsTab — Hero:**
- 🟢 Crítico: Receita Total, Conversão Global
- 🟡 Secundário: CAC Estimado
- 🔵 Opcional: trend %, ring %

**BIProRevOpsTab — Funnel:**
- 🟢 Crítico: count em cada etapa, CR% entre etapas
- 🟡 Secundário: nome da etapa
- 🔵 Opcional: drop count (-X), 3D effects, glow

**BIProRevOpsTab — CR Benchmarks:**
- 🟢 Crítico: valor CR, status (good/warning/bad)
- 🟡 Secundário: meta de comparação, label
- 🔵 Opcional: diagnosis pontos (já é collapsible — manter)

### 4.2 O que pode sumir / consolidar

| Item | Ação |
|---|---|
| Top-bar gradient triplo nas KPI summary | **REMOVER** (3 ocorrências: Comercial seção 1, Marketing seção 1) |
| Top-bar gradient hero KPI cards (RevOps Row 1, SecKPI, CR Benchmarks) | **REMOVER** (8 ocorrências) |
| `bg-blue-500/5` em coluna current de tabela pivot | **SUBSTITUIR** por border-left primary |
| Sub-header com ícones coloridos em tabela Closer | **SUBSTITUIR** por texto curto |
| Ícone Layers grande em "Em breve" Grupo de Anúncios | manter (empty state legítimo) |
| Welcome screen Insights — glow blur atrás do icon | **REMOVER** |
| Avatar bot com gradient azul→violeta + speaking ring violeta→fuchsia | **SIMPLIFICAR** para `bg-primary` |
| ProgressRing com `linearGradient` brand | **SIMPLIFICAR** para sólido `text-primary` |
| 3D effect no CustomerJourneyFunnel (clipPath polygon, glow boxShadow, gradient 6 cores) | **OPÇÃO A** (recomendada): trocar por funnel 2D barras horizontais. **OPÇÃO B**: manter conceito mas reduzir paleta a 1 cor com opacidade decrescente |
| `text-violet-600` em Investimento, `text-blue-600` em Leads (KPI summary Marketing) | **REMOVER cor** — só `text-foreground` |
| Mini volume bar `from-blue-500 to-violet-500` (Campaign table) | **SÓLIDO** `bg-primary` |
| `tracking-widest` em labels normais | **TROCAR** por `tracking-wide` |

---

## 5. O que NÃO mudar

**Funcionalidade — preservar 100%:**
- Hooks de dados (`useBIProKPIs`, `useBIProRevOps`, `useBIProAttribution`, `useBIProSchedules`, `useBIProCRM`, `useBIProFunnel`, `useBIProAttribution`, `useCRBenchmarks`, `useBIProFunnel`, `useInsightsConversations`, `useElevenLabsTTS`)
- Filtros (period, dateFrom, dateTo, pipelineId, scoreFilter)
- Edge function `bi-insights-chat`
- DynamicChart inline rendering em mensagens AI
- Voice player + speech recognition (toda a feature)
- CR Benchmarks edit/save (`useCRBenchmarks` mutation)
- BottleneckAlert
- StageConversionMatrix (não auditado aqui — manter)
- Cálculos de WeekData / closers / temperaturas
- Filter chip lógica (todos / atualizar / compareceu / no_show / remarcar)
- Sort de Top Closers / Campaigns
- Skeleton loading states (só atualizar border-radius)
- Empty states (BIProFeedback) — apenas atualizar `rounded-[2px]` → `rounded-md`
- Animações framer-motion (só remover hover-scale exagerado)
- `useReducedMotion` (manter sempre)

**Lógica de cores semânticas — preservar:**
- ScoreBadge (S7, S8, S9, S10 com cor por score)
- TemperatureBadge (Quente / Morno / Frio com cor)
- ROIBadge (positivo verde / negativo vermelho)
- StatusIcon nas tabelas (CheckCircle verde, AlertCircle vermelho, Clock âmbar)
- showPct color thresholds (>=70 verde, >=50 âmbar, <50 vermelho)
- CR4 thresholds (>=25 verde, >=12 âmbar, <12 vermelho)
- DeltaBadge (up verde, down vermelho)
- crStatus (good/medium/bad em CR Benchmarks)
- StatusBadge variants (good/medium/bad em STATUS_COLORS)

**Layout estrutural — preservar:**
- Sidebar + chat split (Insights)
- Grid 5-col KPI strip (Summary)
- 3 hero KPIs em row (RevOps Row 1)
- Funnel + Diagnosis lado a lado (RevOps Row 3)
- Stage Conversion Matrix
- Ordem das seções em cada tab

---

## 6. Roadmap de implementação (sugestão para Dev Alpha + Dev Gamma)

### Fase 1 — Tokens compartilhados (PR único)
Editar `src/components/dashboard/bipro-shared.ts`:
- `CARD_BASE` → `'border border-border bg-card rounded-md overflow-hidden'`
- `TABLE_HEADER` → `'text-[11px] font-semibold text-muted-foreground uppercase tracking-wide'`
- Adicionar exports: `SectionCard`, `MetricCell` unificado, `BadgePill`, `FilterChip`
- Skeleton: `rounded-[2px]` → `rounded-md`

### Fase 2 — Por tela (PRs separados, em paralelo)

**Dev Alpha:**
- PR-A1: BIProSummaryBar — ajustar KPICard (ícone neutro, escala tipo, padding)
- PR-A2: BIProInsightsTab — remover gradients (avatar, send, welcome, logo header), `rounded-[2px]` → `rounded-md`/`rounded-lg`

**Dev Gamma:**
- PR-G1: BIProComercialTab — Resumo Consolidado (remover top-bar, consolidar grid, ícones neutros) + Comparativo de Período (sub-headers, current column highlight, padding)
- PR-G2: BIProComercialTab — Comparativo por Closer (sub-header texto, default colapsar Temperatura, padding tabela)
- PR-G3: BIProRevOpsTab — Hero KPIs + SecKPI + CR Benchmarks (remover top-bars, ProgressRing sólido, padding) + Funnel **Opção A** (2D barras horizontais)
- PR-G4: BIProMarketingTab — KPI summary (top-bar removido, cores em valores removidas, padding) + AttrTable (highlight first row → border-left, padding)

### Fase 3 — Validação visual

Antes de cada PR, **screenshots before/after** comparando com:
- Looker Studio dashboards (referência paleta sóbria)
- Linear inbox/views (referência density e tipografia)
- Metabase questions list (referência tabelas enterprise)

### Fase 4 — A11y check

Após mudanças visuais:
- Contraste de `text-muted-foreground/60` em fundo `bg-muted/40` — validar AA (4.5:1)
- Foco visível em filter chips, botões de toolbar, células clicáveis
- `aria-label` em botões icon-only (alguns já têm — confirmar todos)
- Reduced-motion: confirmar que nenhuma animação é essencial para entender dado

---

## 7. Resumo executivo (1 parágrafo)

O BI PRO hoje sofre de **excesso de adornos visuais que competem com os dados** — gradients triplos no topo de cards, ícones com cor por categoria, top-bars decorativos em cada KPI, mix de border-radius (2px/4px/8px) e tipografia em 10 tamanhos diferentes. A spec enterprise aplica 6 ajustes-chave: (1) cor é semântica (status), nunca decoração; (2) `rounded-md` em tudo; (3) escala tipográfica reduzida a 5 tamanhos; (4) padding generoso (px-6 py-5 em cards); (5) gradients banidos exceto onde são informação (CR benchmark sólido por status); (6) Customer Journey Funnel trocado de "3D wow" por funnel 2D Linear-style. Funcionalidade, hooks de dados, lógica semântica de cores (Quente/Morno/Frio, ROI±, CR thresholds) e animações reduced-motion **permanecem 100% intactos**.
