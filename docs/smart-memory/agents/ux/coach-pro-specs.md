---
title: Coach Pro — Specs Visuais e UX (Refinamento Enterprise)
type: component-spec
agent: dev-ux
updated: 2026-05-02
tags: [ux, coach-pro, enterprise, charts, specs]
---

# Coach Pro — Specs Visuais e UX

> Spec de refinamento enterprise para todas as telas do Coach Pro, alinhando visual e padrões de chart com [[bi-enterprise-spec]] e o padrão do BIProComercialTab.tsx (referência interna validada).

## Sumário

1. [Análise do estado atual](#1-análise-do-estado-atual)
2. [Direção visual enterprise](#2-direção-visual-enterprise)
3. [Specs por tela](#3-specs-por-tela)
4. [Padrões de charts recomendados](#4-padrões-de-charts-recomendados)
5. [Lista de meetings — dados na linha](#5-lista-de-meetings--dados-na-linha)
6. [Roadmap por story](#6-roadmap-por-story)

---

## 1. Análise do estado atual

### 1.1 CoachDashboard.tsx (`src/pages/CoachDashboard.tsx`)

**Bom:**
- Header limpo com seletor de período (`7d/30d/90d`)
- Grid 4 KPIs no topo (Avaliações, Nota Média, Talk Ratio, Deal Risk)
- Score badges com cores semânticas (emerald/yellow/orange/red)
- Empty state com ícone Brain + copy explicativa

**A melhorar:**
- KPI cards usam padrão antigo (`bg-zinc-900 border-zinc-800`) em vez do `MetricCell` do bipro-shared (com ícone, accent, sub)
- Sem nenhum chart — só lista de últimas avaliações, perde-se a história temporal
- "Critério mais fraco/forte" são cards isolados embaixo, deveriam compor uma seção "Insights"
- Falta breakdown por playbook (qual playbook tem maior/menor adesão)
- Falta filtro por equipa/consultor (existe só na CoachTeamBoard)
- Lista de avaliações sem nome do consultor/playbook visíveis

**Problemas de UX:**
- Não há call-to-action claro: usuário não sabe se deve clicar nas avaliações
- "Deal Risk" exibido como dominante (ex: "high") + breakdown numérico embaixo ("3H · 5M · 12L") é confuso — deveria ser distribuição visual (ring/donut)
- Falta de sinal de "tendência": comparativo com período anterior

### 1.2 CoachTeamBoard.tsx (`src/pages/CoachTeamBoard.tsx`)

**Bom:**
- BenchmarkBar no topo
- Tabela de consultores com avatar + nome + trend
- Score badges consistentes com Dashboard

**A melhorar:**
- BenchmarkBar é 3 colunas flex-wrap simples, deveria ser KPI strip enterprise (5 colunas, ícones, divisores)
- Tabela tem 5 colunas (Consultor, Nota, Calls, Trend, Gap) — falta: Show Rate, Talk Ratio, Avaliações no período, último critério crítico
- Sem visualização agregada do time (ex: distribuição de scores, ranking visual)
- Trend é só ícone + número, sem mini sparkline
- Sem filtro por equipa (igual ao BI Comercial faz com `consultorFilter`/`equipeFilter`)

**Problemas de UX:**
- Difícil identificar rapidamente outliers (best/worst performers)
- "Gap" trunca silenciosamente (`max-w-[160px] truncate`) sem tooltip

### 1.3 CoachConsultantProfile.tsx (`src/pages/CoachConsultantProfile.tsx`)

**Bom:**
- Hero com avatar grande + métricas principais
- ScoreChart SVG inline com benchmark da equipa
- Forças/Áreas a melhorar lado a lado
- Lista de avaliações com playbook + tempo relativo

**A melhorar:**
- ScoreChart é SVG manual com height fixo 120px — deveria usar Recharts (ComposedChart com Area + Line + benchmark) como BIProComercialTab
- Hero não mostra distribuição de deal risk do consultor
- "Forças" e "Áreas a melhorar" mostram só 1 critério cada (`strongest_criterion`/`weakest_criterion`) — deveria ser top 3 com scores médios
- Sem breakdown por playbook (este consultor é melhor em discovery vs closing?)
- Sem distribuição de scores (histograma de quantas calls em cada faixa)
- Botão "Agendar sessão" é genérico no fundo, sem contexto

**Problemas de UX:**
- Ao olhar o profile, gestor não consegue responder em 5s "onde devo focar coaching com este consultor?"
- Falta comparativo direto vs equipa (radar chart de critérios)

### 1.4 CoachMeetingEvaluation.tsx (`src/pages/CoachMeetingEvaluation.tsx`)

**Bom:**
- Tabs bem organizadas (Scorecard, Coaching, Flow Map, Email)
- ScoreGauge SVG semicircular bonito
- CriterionRow expansível com quote + coaching tip
- SentimentArc visual
- Botão Re-avaliar

**A melhorar:**
- ScoreGauge pode virar Radial (ring chart) mais moderno
- Talk Ratio na tab Scorecard usa `Progress` simples — deveria ser barra horizontal stacked (consultor vs cliente, igual ao Flow Map)
- Sections breakdown com Progress bar é OK, mas deveria ter mini-radar de critérios por seção
- Falta visualização do flow temporal de critérios cumpridos (timeline)
- Tab Flow Map é leve — deveria ter: pace conversational, momentos críticos, tópicos abordados

**Problemas de UX:**
- Tab "Email" mistura status + preview, deveria separar (ou ser parte da tab Coaching)
- Difícil saber o que mudou na Re-avaliação (sem histórico de versões)
- "Sections breakdown" filtra critérios por section mas hardcoded `return true` (linha 373) — bug visível

### 1.5 CoachProConfig.tsx (`src/components/config/CoachProConfig.tsx`)

**Bom:**
- Estrutura tabs (Playbooks, Configurações)
- Editor de critério em accordion com peso, descrição, exemplos, hints
- AlertDialog de confirmação para delete
- Switch para "padrão por tipo"

**A melhorar:**
- Layout 2-colunas (lista + editor) é OK, mas no mobile vira inutilizável (grid-cols-2 fixo)
- Sem preview do scorecard renderizado (admin não vê como vai aparecer ao consultor)
- Editor de critério tem MUITO input apertado (h-[26px], text-xs) — sensação de "Excel"
- Botão "Guardar" aparece toda vez que o campo muda dirty → poluição visual; deveria haver debounce + auto-save com indicador "Guardado há 2s"
- "Atribuição automática" usa table simples sem feedback visual de quais playbooks já estão atribuídos

**Problemas de UX:**
- Curva de aprendizagem alta para criar playbook do zero — falta wizard ou template progressivo
- Pesos não somam 100% visualmente (sem indicador de soma total das seções)

### 1.6 ReuniaoSingle.tsx — bloco CoachPRO (`src/pages/ReuniaoSingle.tsx:551-581`)

**Bom:**
- Bloco isolado dentro de "Detalhes" mostrando playbook + score
- Botão "Ver Avaliação" leva ao single

**A melhorar:**
- Apenas um chip + score numérico — pode mostrar mini-resumo: deal risk, talk ratio, top gap
- Quando avaliação está pendente, sem indicação de "quando ficará pronta"

### 1.7 Reunioes.tsx — lista (`src/pages/Reunioes.tsx`)

**Bom:**
- Tabela bem organizada com sort, filtros, paginação
- KPI strip no topo (Total, Agendadas, Compareceu, etc)
- Filtros avançados colapsáveis

**A melhorar:**
- Coluna "Score" mostra `pessoas.score` (lead score), NÃO o score Coach Pro da reunião
- Sem indicador visual de "tem avaliação Coach" / "tem playbook atribuído"
- Sem coluna mostrando deal risk ou nota da última call

**Problemas de UX:**
- Gestor não consegue, da lista, identificar "esta reunião está com problema (low score, high risk)" sem clicar uma a uma

---

## 2. Direção visual enterprise

### 2.1 Tokens de design (alinhados ao bipro-shared)

| Token | Valor | Uso |
|---|---|---|
| `CARD_BASE` | `border border-border bg-card rounded-md overflow-hidden` | Containers de seção |
| `SECTION_CARD` | mesmo que `CARD_BASE` | Wrapper de KPI strip e tables |
| `TABLE_HEADER` | `text-[11px] font-semibold text-muted-foreground uppercase tracking-wide` | TH cells |
| `GRID_KPIS_4` | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` | KPI grids |
| `GRID_KPIS_5` | `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4` | KPI strip enterprise |

**Cores de chart (CHART_COLORS — usar em Recharts):**
```ts
const CHART_COLORS = {
  blue:    '#3B82F6',  // métricas primárias
  green:   '#22C55E',  // sucesso (compareceu, won)
  purple:  '#8B5CF6',  // qualificação
  orange:  '#F97316',  // alertas suaves
  mint:    '#86efac',  // séries secundárias
  red:     '#EF4444',  // crítico (no-show, lost, score baixo)
  amber:   '#F59E0B',  // warning
  muted:   '#6B7785',  // labels de eixo
  grid:    '#1E2936',  // grid lines
};
```

### 2.2 Hierarquia visual (4 níveis)

| Nível | Tamanho | Peso | Uso |
|---|---|---|---|
| H1 (page title) | `text-[15px]` | `font-semibold` | Header da tela ("CoachPRO™ — Equipa") |
| H2 (section title) | `text-[15px]` | `font-semibold` (via SectionCard) | Título de cada SectionCard |
| H3 (section sub) | `text-[12px]` | `text-muted-foreground` | Subtitle do SectionCard |
| Label (KPI / TH) | `text-[11px]` | `font-medium uppercase tracking-wide` | Labels de KPI cells e TableHead |

**Score values em métricas grandes:** `text-[22px] font-semibold tabular-nums tracking-tight` (igual ao MetricCell).

### 2.3 Padrão de KPI strip enterprise

Use o `MetricCell` do `bipro-shared.ts` em grids responsivos com divisores entre células:

```tsx
<div className={SECTION_CARD}>
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
    <MetricCell icon={Brain} label="Avaliações" value={fmtNum(122)} />
    <MetricCell icon={Star} label="Nota Média" value="8.4" sub="/10"
                accent="text-emerald-600" className="lg:border-l border-border" />
    <MetricCell icon={Mic} label="Talk Ratio" value="42%" sub="consultor"
                className="lg:border-l border-border" />
    <MetricCell icon={AlertTriangle} label="Deal Risk Alto" value={fmtNum(8)}
                accent="text-red-600" className="lg:border-l border-border" />
    <MetricCell icon={TrendingUp} label="Tendência 30d" value="+0.6"
                accent="text-emerald-600" className="lg:border-l border-border" />
  </div>
</div>
```

**Regra:** primeira célula sem `border-l`; demais com `lg:border-l border-border`.

### 2.4 Padrão de SectionCard

Sempre embrulhar conteúdo principal em `SectionCard`:

```tsx
<SectionCard
  title="Evolução de Scorecard"
  subtitle="Últimas 12 calls vs benchmark da equipa"
  badge="12 calls"
  right={<PeriodSelector value={period} onChange={setPeriod} />}
>
  {/* chart aqui */}
</SectionCard>
```

### 2.5 Padrão de filtros (team selector + corretor selector)

Reutilizar pattern do `BIProComercialTab` + `Reunioes.tsx`:

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <Select value={equipeFilter} onValueChange={setEquipeFilter}>
    <SelectTrigger className="h-[30px] w-36 text-xs rounded-[4px] bg-muted border-border">
      <SelectValue placeholder="Equipa" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all" className="text-xs">Todas as equipas</SelectItem>
      {times.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.nome}</SelectItem>)}
    </SelectContent>
  </Select>

  <Select value={consultorFilter} onValueChange={setConsultorFilter}>
    <SelectTrigger className="h-[30px] w-36 text-xs rounded-[4px] bg-muted border-border">
      <SelectValue placeholder="Consultor" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all" className="text-xs">Todos</SelectItem>
      {filteredUsuarios.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.nome}</SelectItem>)}
    </SelectContent>
  </Select>

  <PeriodSelector value={period} onChange={setPeriod} />  {/* 7d / 30d / 90d */}
</div>
```

**Regras:**
- Permissões respeitam `useUserPermissions` (`canChangeFilters`)
- Quando `equipeFilter` muda, resetar `consultorFilter` para "all"
- Filtros sticky no header da tela (igual `Reunioes.tsx`)

### 2.6 Score badges (consolidar)

Padronizar em util único compartilhado:

```ts
// src/components/coach/score-utils.tsx
export function scoreBadgeClass(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground border-border';
  if (score >= 8)     return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
  if (score >= 6)     return 'bg-amber-500/10 text-amber-500 border-amber-500/25';
  if (score >= 4)     return 'bg-orange-500/10 text-orange-500 border-orange-500/25';
  return                     'bg-red-500/10 text-red-500 border-red-500/25';
}
```

Atualmente cada arquivo redefine — extrair para `src/components/coach/utils.ts` (Dev Alpha cuida).

### 2.7 Deal Risk distribution badge (consolidar)

```tsx
// Quando há distribuição: mostrar mini-strip ao invés de "3H · 5M · 12L"
<div className="flex items-center h-2 rounded overflow-hidden gap-px w-full">
  <div className="bg-red-500" style={{ width: `${pctHigh}%` }} title={`${high} alto`} />
  <div className="bg-amber-500" style={{ width: `${pctMed}%` }} title={`${med} médio`} />
  <div className="bg-emerald-500" style={{ width: `${pctLow}%` }} title={`${low} baixo`} />
</div>
<div className="flex justify-between text-[10px] text-muted-foreground mt-1">
  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />{high} alto</span>
  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />{med} médio</span>
  <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />{low} baixo</span>
</div>
```

---

## 3. Specs por tela

### 3.1 CoachDashboard (CP-1)

**Layout proposto (top→bottom):**

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: [Brain] CoachPRO™              [Equipa▾] [Consultor▾] [30d▾] │
├──────────────────────────────────────────────────────────────────┤
│ KPI Strip (5 cells, MetricCell)                                  │
│ Avaliações | Nota Média | Talk Ratio | Deal Risk Alto | Trend Δ │
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┬──────────────────────────┐   │
│ │ Evolução de Scores (line+area)  │ Distribuição Deal Risk   │   │
│ │ benchmark equipa pontilhado     │ (Donut)                  │   │
│ │ Recharts ComposedChart 220px    │ alto/medio/baixo         │   │
│ └─────────────────────────────────┴──────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ Insights — 2 colunas                                             │
│ ┌─────────────────────┬─────────────────────┐                   │
│ │ Top 3 Forças        │ Top 3 Gaps          │                   │
│ │ (com avg score)     │ (com avg score)     │                   │
│ └─────────────────────┴─────────────────────┘                   │
├──────────────────────────────────────────────────────────────────┤
│ SectionCard: Últimas Avaliações (table, ver §5)                  │
│ Headers: Data | Reunião | Consultor | Playbook | Score | Risk |  │
│          Talk% | Verdict | →                                     │
└──────────────────────────────────────────────────────────────────┘
```

**Componentes a usar:**
- `MetricCell` × 5 (KPI strip)
- `SectionCard` (wrapping de cada bloco)
- Recharts `ComposedChart` (Area + Line) para evolução
- Recharts `PieChart` (donut com `innerRadius`) para deal risk
- `Table` shadcn para últimas avaliações (ver coluna spec em §5)

**Interações:**
- Clicar em row da tabela → navega para `/coach/meetings/{meetingId}`
- Filtros (equipa/consultor/período) sticky no header
- Hover em ponto do chart → tooltip com nome da reunião + nota

**Empty states:**
- Sem dados: ilustração `Brain` com CTA "Atribuir playbook à próxima reunião"

---

### 3.2 CoachTeamBoard (CP-2)

**Layout proposto:**

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: [Users] CoachPRO™ — Equipa    [Equipa▾] [Período▾]       │
├──────────────────────────────────────────────────────────────────┤
│ KPI Strip (5 cells)                                              │
│ Consultores | Nota Média Equipa | Show Rate | Talk Ratio | Tend. │
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┬──────────────────────────┐   │
│ │ Distribuição de Scores (Bar)    │ Top performers (rank)    │   │
│ │ histograma 0-2, 2-4, 4-6, 6-8,  │ Top 3 com avatar + nota  │   │
│ │ 8-10                            │ + arrow trend            │   │
│ └─────────────────────────────────┴──────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ SectionCard: Consultores (table expansível)                      │
│ Consultor | Calls | Score | Show% | Talk% | Trend(spark) | Gap   │
│ ▶ row expansível mostra mini-radar de critérios                  │
└──────────────────────────────────────────────────────────────────┘
```

**Componentes a usar:**
- `MetricCell` × 5
- Recharts `BarChart` para distribuição de scores (vertical, 5 buckets)
- Card de Top performers (lista de 3 com avatar grande)
- Tabela com `Fragment` + row expansível (padrão `CloserTable` em BIProComercialTab)
- Mini sparkline na coluna Trend (Recharts `LineChart` de 60×24px sem axes)

**Filtros:**
- `equipeFilter` (multi-team se super admin)
- `period` (7d/30d/90d)

**Interações:**
- Click no nome do consultor → `/coach/team/{userId}`
- Click no chevron → expande row mostrando mini-radar (5-7 critérios principais)
- Hover na sparkline → tooltip com pontos

---

### 3.3 CoachConsultantProfile (CP-3)

**Layout proposto:**

```
┌──────────────────────────────────────────────────────────────────┐
│ [← Equipa] [Avatar] {Nome}                          [Período▾]   │
├──────────────────────────────────────────────────────────────────┤
│ Hero — KPI strip (5 cells, alinhado com Dashboard)              │
│ Calls | Nota Média | Show Rate | Talk Ratio | Trend Δ            │
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┬──────────────────────────┐   │
│ │ Evolução de Scorecard           │ Comparativo vs Equipa    │   │
│ │ (ComposedChart Area+Line+bench) │ (Radar: 6-8 critérios)   │   │
│ │ ↳ pontos coloridos por nota     │ consultor vs avg equipa  │   │
│ └─────────────────────────────────┴──────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────┬──────────────────────────┐   │
│ │ Top 3 Forças (com avg score)    │ Top 3 Gaps (com avg)     │   │
│ │ ✓ Critério A — 8.7              │ ! Critério X — 4.2       │   │
│ │ ✓ Critério B — 8.3              │ ! Critério Y — 5.1       │   │
│ │ ✓ Critério C — 7.9              │ ! Critério Z — 5.8       │   │
│ └─────────────────────────────────┴──────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ Performance por Playbook (table)                                 │
│ Playbook | Calls | Avg | Show% | Best Crit | Worst Crit          │
├──────────────────────────────────────────────────────────────────┤
│ SectionCard: Últimas Avaliações (table, ver §5)                  │
└──────────────────────────────────────────────────────────────────┘
```

**Componentes a usar:**
- `MetricCell` × 5 (hero)
- Recharts `ComposedChart` (substituir o SVG inline atual)
- Recharts `RadarChart` para comparativo vs equipa
- Lista de forças/gaps com score numérico (não só badge)
- Tabela "Performance por Playbook" simples

**Interações:**
- Click em row de avaliação → navega para meeting evaluation
- Click em "Ver detalhes" da força/gap → mostra modal com últimas calls onde apareceu
- Botão "Agendar coaching" promove para o header (não no rodapé)

---

### 3.4 CoachMeetingEvaluation (refinement futuro, não prioridade do CP-1..4)

**Refinamentos pontuais:**
- Trocar `ScoreGauge` semicircular por Recharts `RadialBarChart` (ring chart)
- Talk Ratio na tab Scorecard: mesma barra horizontal stacked do Flow Map (consultor vs cliente lado a lado)
- Adicionar mini-radar de critérios por seção no breakdown
- Tab Email: separar status (topo) do preview (modal "Ver email completo")
- Fix bug linha 373: filtrar critérios por `section_id` corretamente

---

### 3.5 CoachProConfig (CP-4) — single-screen redesign

**Layout proposto (single screen, sem tabs Playbooks/Settings — promover ambos para colunas paralelas):**

```
┌────────────────────────────────────────────────────────────────────┐
│ Header: [BrainCircuit] CoachPRO™ — Configuração     [Salvar tudo]  │
├────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┬────────────────────────────────────┐   │
│ │ COLUNA 1 (35%)          │ COLUNA 2 (65%)                     │   │
│ │ Lista de Playbooks      │ Editor / Preview                   │   │
│ │                         │                                     │   │
│ │ + Novo Playbook         │ Tabs internas:                     │   │
│ │                         │ [Editor] [Preview Scorecard]       │   │
│ │ ▸ Templates Sistema     │                                     │   │
│ │   - Discovery B2B       │ Editor: secções + critérios        │   │
│ │   - Demo SaaS           │  com peso visual (sum 100%)        │   │
│ │   - Closing             │                                     │   │
│ │                         │ Preview: render do scorecard como  │   │
│ │ ▸ Meus Playbooks (4)    │  vai aparecer ao consultor         │   │
│ │   ● Discovery Custom    │                                     │   │
│ │   ○ Demo Custom         │ Indicador de auto-save:            │   │
│ │   ● QBR (default)       │ "Guardado há 2s ✓"                 │   │
│ │   ○ Mentoring           │                                     │   │
│ │                         │                                     │   │
│ └─────────────────────────┴────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────┤
│ COLLAPSE: Configurações Globais (ao colapsar mostra resumo)       │
│ ▸ Contexto do negócio | ▸ Notificações | ▸ Atribuição automática   │
└────────────────────────────────────────────────────────────────────┘
```

**Mudanças críticas:**

1. **Sem tabs principais** — Playbooks e Configurações ficam visíveis simultaneamente; Configurações em accordion no fundo (colapsado por default)
2. **Auto-save com debounce 800ms** — remove botão "Guardar critério/secção" repetitivo. Indicador visual sutil "Guardado há Xs ✓" no canto superior do editor
3. **Preview lado a lado** — tab "Preview" no editor renderiza scorecard como o consultor verá (sem dados, só estrutura)
4. **Soma de pesos visual** — mostrar progress bar no topo do editor: "Pesos: 95% / 100%" em amber se ≠ 100%
5. **Mobile**: stack vertical com tabs (lista | editor)

**Componentes a usar:**
- `Tabs` interno apenas no editor (Editor / Preview)
- `Accordion` (shadcn) para Configurações Globais
- `Progress` para soma de pesos
- Auto-save: hook custom `useDebouncedSave` (Dev Alpha implementa)

---

### 3.6 ReuniaoSingle — bloco CoachPRO

**Refinamento (mantém posição atual no card direito):**

```tsx
<div className="pt-2 border-t border-white/[0.06] space-y-3">
  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">CoachPRO</p>

  {/* Playbook chip */}
  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] text-[11px]
                   font-medium border border-primary/30 bg-primary/5 text-primary">
    <Target className="w-3 h-3" />
    {playbookAssignment.playbook.name}
  </span>

  {evaluation ? (
    <>
      {/* Mini-resumo da avaliação */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Score</p>
          <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-bold",
                              scoreBadgeClass(evaluation.overall_score))}>
            {evaluation.overall_score?.toFixed(1) ?? '—'}
          </span>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Risk</p>
          {dealRiskBadge(evaluation.deal_risk)}
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">Talk %</p>
          <span className="text-xs font-semibold">
            {evaluation.talk_ratio_consultant?.toFixed(0) ?? '—'}%
          </span>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => navigate(`/coach/meetings/${id}`)}>
        <ExternalLink className="w-3 h-3 mr-1" />
        Ver Avaliação Completa
      </Button>
    </>
  ) : (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Clock className="w-3 h-3" />
      Avaliação processando — concluirá em ~2min após upload de gravação
    </div>
  )}
</div>
```

---

## 4. Padrões de charts recomendados

Baseado em [brand.aioxsquad.ai/brandbook/charts](https://brand.aioxsquad.ai/brandbook/charts) (AIOX Squad Chart Library v2.0) e no padrão validado em `BIProComercialTab.tsx`.

### 4.1 Mapeamento métricas → chart type

| Métrica Coach Pro | Chart recomendado | Justificativa |
|---|---|---|
| Evolução temporal de score (consultor / equipa) | **Line + Area Chart** (ComposedChart) | Tendência simples + benchmark dashed line |
| Distribuição de Deal Risk | **Donut Chart** (innerRadius 60%) | Distribuição de 3 categorias com proporção |
| Distribuição de scores (histograma) | **Bar Chart vertical** | 5 buckets (0-2, 2-4, 4-6, 6-8, 8-10) |
| Performance por critério (consultor vs equipa) | **Radar Chart** (multi-series) | Comparação multidimensional ideal para 5-8 critérios |
| Score atual vs meta | **Radial Bar / Ring Chart** | Métrica de atingimento (ex: 8.4/10 = 84%) |
| Talk ratio (consultor vs cliente) | **Stacked Horizontal Bar** | 100% horizontal com 2 segmentos coloridos |
| Sentiment arc | **Manter implementação atual** (faixa segmentada) | Já é visualmente eficaz |
| Mini-trend em row de tabela | **Sparkline** (LineChart sem axes) | Ultra-compacto, contextual |
| Heatmap de critérios × consultores | **Composed grid colorido** | Identificar gaps sistêmicos do time |

### 4.2 Configuração padrão Recharts (alinhada bipro-shared)

```tsx
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartTooltip,
} from 'recharts';

const CHART_COLORS = {
  blue: '#3B82F6', green: '#22C55E', purple: '#8B5CF6',
  red: '#EF4444', amber: '#F59E0B', muted: '#6B7785', grid: '#1E2936',
};

<ResponsiveContainer width="100%" height={220}>
  <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
    <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
           tickLine={false} axisLine={false} />
    <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
           tickLine={false} axisLine={false} />
    <RechartTooltip
      contentStyle={{
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 6,
      }}
      labelStyle={{ color: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
      itemStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
    />
    <Area type="monotone" dataKey="score" fill={CHART_COLORS.blue} fillOpacity={0.15}
          stroke={CHART_COLORS.blue} strokeWidth={2} />
    <Line type="monotone" dataKey="benchmark" stroke={CHART_COLORS.muted}
          strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
  </ComposedChart>
</ResponsiveContainer>
```

**Regras universais:**
- Sempre `ResponsiveContainer` com height fixo (180-260px)
- `CartesianGrid` apenas horizontal (`vertical={false}`), strokeDasharray "3 3"
- Eixos: `tickLine={false}`, `axisLine={false}`, fontSize 11
- Tooltip estilizado com tokens CSS (`hsl(var(--card))`)
- Dot radius 3, activeDot 5
- Stroke width 2 para linhas principais, 1.5 para benchmark

### 4.3 Donut Chart pattern (Deal Risk)

```tsx
<ResponsiveContainer width="100%" height={200}>
  <PieChart>
    <Pie
      data={[
        { name: 'Alto', value: high, fill: CHART_COLORS.red },
        { name: 'Médio', value: med, fill: CHART_COLORS.amber },
        { name: 'Baixo', value: low, fill: CHART_COLORS.green },
      ]}
      cx="50%" cy="50%"
      innerRadius={50} outerRadius={75}
      paddingAngle={2}
      dataKey="value"
    />
    <RechartTooltip {...standardTooltip} />
  </PieChart>
</ResponsiveContainer>
{/* Center label sobreposto via div absolute */}
<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
  <span className="text-2xl font-bold text-foreground">{total}</span>
  <span className="text-[10px] text-muted-foreground uppercase">avaliações</span>
</div>
```

### 4.4 Radar Chart pattern (consultor vs equipa)

```tsx
<ResponsiveContainer width="100%" height={260}>
  <RadarChart data={criteriaData}>
    <PolarGrid stroke={CHART_COLORS.grid} />
    <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: CHART_COLORS.muted }} />
    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} />
    <Radar name="Consultor" dataKey="consultor" stroke={CHART_COLORS.blue}
           fill={CHART_COLORS.blue} fillOpacity={0.3} strokeWidth={2} />
    <Radar name="Equipa (avg)" dataKey="equipa" stroke={CHART_COLORS.muted}
           fill="transparent" strokeWidth={1.5} strokeDasharray="4 3" />
    <RechartTooltip {...standardTooltip} />
  </RadarChart>
</ResponsiveContainer>
```

### 4.5 Sparkline (mini-trend em rows)

```tsx
<ResponsiveContainer width={60} height={24}>
  <LineChart data={trendPoints} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
    <Line type="monotone" dataKey="score"
          stroke={trend > 0 ? CHART_COLORS.green : CHART_COLORS.red}
          strokeWidth={1.5} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

---

## 5. Lista de meetings — dados na linha

A pergunta era: **quais campos de avaliação mostrar diretamente na lista de Reunioes.tsx sem precisar abrir o single?**

### 5.1 Colunas atuais (Reunioes.tsx)

`Criado em | Cliente | Data | Horário | Consultor | Status | Negócio | Score | Qtd | Local`

> A coluna `Score` atual mostra `pessoas.score` (lead score, não Coach). Manter, mas renomear para "Lead Score".

### 5.2 Colunas Coach Pro recomendadas (adicionar quando módulo Coach está ativo)

Por ordem de prioridade:

| # | Coluna | Tipo | Largura | Conteúdo |
|---|---|---|---|---|
| 1 | **Coach Score** | Badge numérico | 70px | `evaluation.overall_score` com `scoreBadgeClass`. Se sem avaliação: "—" muted. Se processing: spinner pequeno + "..." |
| 2 | **Deal Risk** | Badge colorido | 70px | `evaluation.deal_risk` (Alto/Médio/Baixo) com cor semântica. "—" se sem avaliação |
| 3 | **Playbook** | Texto truncado + tooltip | 110px | `playbookAssignment.playbook.name`. Se sem playbook: ícone `AlertCircle` amber + tooltip "Sem playbook atribuído" |
| 4 | **Verdict** | Texto + ícone | 110px | "Excelente / Bom / A melhorar / Crítico" — só visível em telas ≥lg |
| 5 | **Talk %** | Número compacto | 50px | `${Math.round(consultorTalkRatio)}%` com cor: <30% verde, 30-60% normal, >60% amber |

### 5.3 Indicador inline (compact mode)

Para evitar sobrecarregar a tabela, adicionar **um único cluster compacto Coach** ao lado do consultor:

```tsx
<TableCell>
  <div className="flex items-center gap-1.5">
    {/* Coach mini-cluster — visível só se módulo Coach ativo */}
    {isCoachActive && evaluation && (
      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                            scoreBadgeClass(evaluation.overall_score))}>
          {evaluation.overall_score?.toFixed(1) ?? '—'}
        </span>
        {evaluation.deal_risk === 'high' && (
          <AlertTriangle className="w-3 h-3 text-red-500" title="Deal risk alto" />
        )}
        {!playbookAssignment && (
          <AlertCircle className="w-3 h-3 text-amber-500" title="Sem playbook" />
        )}
      </div>
    )}
  </div>
</TableCell>
```

**Decisão recomendada:** começar com **opção compacta** (cluster) para CP-1..4, e oferecer toggle "Visão Coach" no filtro avançado que ativa as colunas extras (5.2) para gestores que querem visão profunda.

### 5.4 Filtros adicionais Coach na lista

Adicionar dois novos filtros no painel avançado (`Reunioes.tsx`):

- **Coach Score**: range slider 0-10 (ou chips: "Excelente ≥8", "Bom 6-8", "A melhorar 4-6", "Crítico <4")
- **Deal Risk**: chips multi-select (Alto / Médio / Baixo / Sem avaliação)

### 5.5 Sort por Coach Score

Permitir sort pela coluna Coach Score (descendente para identificar top calls; ascendente para identificar problemas).

---

## 6. Roadmap por story

| Story | Tela | Owner | Esforço | Dependências |
|---|---|---|---|---|
| **CP-1** | CoachDashboard refinement | Dev Alpha | M | Nada |
| **CP-2** | CoachTeamBoard refinement | Dev Alpha | M | Hook `useCoachTeamMetrics` precisa retornar sparkline data |
| **CP-3** | CoachConsultantProfile refinement | Dev Alpha | L | Hook `useCoachConsultantDetail` precisa retornar `criteria_breakdown` (top 3 forças/gaps com scores) e `playbook_breakdown` |
| **CP-4** | CoachProConfig single-screen | Dev Alpha | L | Implementar `useDebouncedSave`; criar `<ScorecardPreview>` component |
| **CP-5** *(opcional)* | ReuniaoSingle bloco Coach refinement | Dev Alpha | S | Nada |
| **CP-6** *(opcional)* | Reunioes coluna Coach + filtros | Dev Alpha | M | Hook `useAgendamentosSimple` retornar `coach_evaluation` join |

**Pré-requisitos compartilhados:**
- Extrair `scoreBadgeClass`, `dealRiskBadge`, `verdictLabel`, `dealRiskClass` para `src/components/coach/utils.ts`
- Confirmar que tokens `bipro-shared.ts` (MetricCell, SectionCard) podem ser usados fora do módulo BI (provavelmente sim — são genéricos)

---

## Glossário rápido

| Termo | Definição |
|---|---|
| **Score** | Nota geral 0-10 da avaliação Coach (não confundir com lead score) |
| **Verdict** | Veredicto qualitativo: Excelente / Bom / A melhorar / Crítico |
| **Deal Risk** | Risco do negócio fechar: low / medium / high |
| **Talk Ratio** | % do tempo falado pelo consultor vs cliente |
| **Playbook** | Template de avaliação com seções e critérios ponderados |
| **Section** | Bloco temático dentro de um playbook (ex: "Discovery") |
| **Critério** | Item avaliável dentro de uma seção (ex: "Identificou budget") |
| **Verdict por critério** | met / partial / not_met |

---

## Referências internas

- [[bi-enterprise-spec]] — padrão visual enterprise validado
- [[components]] — design system components
- `src/components/dashboard/bipro-shared.ts` — tokens, MetricCell, SectionCard
- `src/components/dashboard/BIProComercialTab.tsx` — referência de implementação enterprise
- [brandbook/charts](https://brand.aioxsquad.ai/brandbook/charts) — AIOX Squad Chart Library v2.0
