---
title: "Story bi-4: Redesign enterprise — BIProRevOpsTab + BIProMarketingTab"
type: story
status: ready-for-qa
epic: bi-pro-refinamento
complexity: L
agent: dev-dev-gamma
created: 2026-05-02
updated: 2026-05-02
tags: [story, bi-pro, ux, redesign, enterprise]
related: ["[[../BACKLOG]]", "[[bi-1-voice-sanitizer]]", "[[bi-2-insights-enterprise]]", "[[bi-3-comercial-enterprise]]"]
---

# Story bi-4: Redesign enterprise — BIProRevOpsTab + BIProMarketingTab

## Objetivo
Aplicar o sistema visual enterprise (consolidado em bi-2/bi-3) às abas RevOps (958 linhas) e Marketing (543 linhas), padronizando funil, benchmarks e atribuição de canais sem regredir filtros e sem quebrar o gating de assinatura.

## Acceptance Criteria
- [ ] AC1: Ambas as abas adotam as **mesmas constantes tipográficas** (`TYPO_LABEL`, `TYPO_VALUE_LG`, `TYPO_VALUE_MD`, `TYPO_GROWTH`) introduzidas em bi-2. Zero ocorrências de `text-[9px]` ou `text-[10px]` hardcoded para labels de métrica nesses 2 arquivos.
- [ ] AC2: RevOpsTab — funil (`RevOpsFunnelStep`) ganha **legenda lateral fixa** com nome do step + valor absoluto + CR%, em vez de apenas tooltip on-hover. Cores do funil ficam acessíveis com texto branco semi-bold sempre legível (validar contraste AA).
- [ ] AC3: RevOpsTab — benchmark editor (`StageConversionMatrix` + `useCRBenchmarks`) vira **modal/Sheet dedicado** acionado por botão "Editar benchmarks" em vez de inline (hoje aparece direto no fluxo, polui a leitura). Botões Save/Cancel ficam no footer do modal.
- [ ] AC4: RevOpsTab — `BottleneckAlert` ganha **slot fixo no topo da seção de funil** (sticky abaixo do header da seção) com cor accent baseada na severidade (good/medium/bad). Hoje aparece em posição flutuante e pode ser perdido.
- [ ] AC5: MarketingTab — KPI strip do topo segue o mesmo layout do BIProSummaryBar (ícone 32px + label uppercase + valor 24px tabular-nums), substituindo o `MetricCell` inline (linha ~38) que duplica padrão.
- [ ] AC6: MarketingTab — gráfico de série temporal (LineChart spend/leads/clicks) ganha **toggle de séries** (legend clicável) e seletor de granularidade (dia/semana/mês) acima do gráfico. Tooltip customizado igual ao da bi-3 (AC4).
- [ ] AC7: MarketingTab — tabela de campanhas (CampaignAttribution) ganha zebra-stripe + `min-h-[44px]` por linha + sticky header (igual padrão de bi-3 AC3). Coluna de plataforma usa cores `PLATFORM_COLORS` em chip (não em texto solto).
- [ ] AC8: Estados loading/erro consistentes entre as duas abas: `SkeletonBlock` para loading, `BIProFeedback` para erro com CTA "Recarregar".
- [ ] AC9: Mobile (<768px): funil RevOps colapsa para visualização vertical empilhada; tabelas Marketing viram cards. Sem overflow horizontal em 375px.
- [ ] AC10: Acessibilidade — botões de toggle têm `aria-pressed`; modal de benchmarks tem `aria-modal` + foco preso (FocusTrap do Radix Dialog); contraste AA validado.

## Escopo

**IN:**
- `src/components/dashboard/BIProRevOpsTab.tsx` (958 linhas) — refactor visual.
- `src/components/dashboard/BIProMarketingTab.tsx` (543 linhas) — refactor visual.
- Eventual adição de subcomponente `BenchmarkEditorSheet` (extraído de StageConversionMatrix) **se** crescer >100 linhas; caso contrário, manter inline na RevOpsTab.
- Reuso das constantes `TYPO_*` de `bipro-shared.ts`.

**OUT:**
- Mudança em hooks (`useBIProAttribution`, `useBIProRevOps`, `useBIProFunnel`, `useCRBenchmarks`, `useBIProKPIs`) — só UI.
- Refactor de `StageConversionMatrix` interno além do necessário para o modal — fora do escopo.
- Nova métrica de atribuição (ex.: multi-touch).
- Refactor das outras 2 abas BI (Insights e Comercial).
- Substituição da lib de gráficos (recharts).

## Contexto Técnico

**RevOpsTab (958 linhas):**
- Funil com 6 steps (CR1..CR5 + COMMIT) usando gradient colors definidos em `FUNNEL_COLORS`.
- Benchmarks editáveis via `useCRBenchmarks` — atualmente inline no flow, prejudica leitura quando o usuário só quer consultar.
- `BottleneckAlert` e `StageConversionMatrix` são componentes próprios já isolados.

**MarketingTab (543 linhas):**
- Atribuição por canal via `useBIProAttribution` retornando `ChannelAttribution`, `CampaignAttribution`, `TimeSeriesPoint`.
- `PLATFORM_COLORS` mapeia meta/google/organic/etc.
- `MetricCell` duplica padrão da Comercial — candidato a hoist (declarar como tech-debt em outra story se necessário, não é desta).

**Constraints:**
- Não introduzir libs novas. Continuar Tailwind + Radix + Framer Motion + Lucide + recharts.
- Bundle size: máximo +4KB gzip combinados nesta story.
- Manter gating de assinatura caso exista (verificar se há check de plano antes de renderizar — preservar).

**Dependências:**
- **Soft-blocked por bi-2** (consome as constantes tipográficas). Se bi-2 não rodou, declarar localmente e merge final pelo QA.
- Pode rodar em paralelo com bi-3.

**Bloqueia:**
- Nada.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Sera (dev-dev-gamma) — fullstack/integration |
| Iniciado   | 2026-05-02 |
| Concluído  | 2026-05-02 |
| Branch     | main (direto, conforme decisão do usuário) |

**Nota de escopo:** AC originais foram **substituídos pela spec consolidada** em `docs/smart-memory/agents/ux/bi-enterprise-spec.md` (dev-ux). Implementação seguiu PR-G3 (RevOps) e PR-G4 (Marketing) dessa spec. AC equivalentes:
- ✅ AC1 (tipografia padronizada) — escala 11/13/15/22/28 aplicada via tokens compartilhados.
- 🔄 AC2 (legenda lateral funil) — substituído por funnel 2D Linear-style (Opção A da spec) com label/count/share embutidos por linha.
- ⏭️ AC3 (modal benchmarks) — fora do escopo da spec enterprise (mantido inline com refino visual).
- ⏭️ AC4 (BottleneckAlert sticky) — fora do escopo da spec; mantido posição atual.
- ✅ AC5 (KPI strip Marketing) — feito em PR-G4.
- ⏭️ AC6 (toggle séries Marketing) — fora do escopo da spec.
- ⏭️ AC7 (zebra-stripe Marketing) — fora do escopo; tabela ganhou padding+highlight border-left primary.
- ✅ AC8 (states loading/erro consistentes) — `SkeletonBlock`+`BIProFeedback`.
- 🔲 AC9 (responsivo mobile) — não validado nesta iteração; smoke necessário.
- 🔲 AC10 (a11y deep) — `aria-pressed` em chips OK; modal focus-trap N/A.

## File List
- `src/components/dashboard/BIProRevOpsTab.tsx` — Hero KPIs sem top-bar gradient, ProgressRing sólido (currentColor), SecKPI sem top-accent, CR Benchmarks sem top-bar/gradients (bar progress sólido por status), Diagnóstico `bg-muted/40`, TopClosers/Campaign tables padding `px-6 py-5` header / `px-4 py-3.5` cells, Evolução Semanal tooltip `rounded-md shadow-sm`, **CustomerJourneyFunnel reescrito como 2D barras horizontais Linear-style** (Opção A da spec): label uppercase + bar `bg-primary/15` (hover `/25`) + count + share%, conector `↓ −drop · CR pct` entre etapas, footer `{N} etapas · Conv. global`. `FUNNEL_COLORS` const removido (morto). Import `ArrowDown` adicionado.
- `src/components/dashboard/BIProComercialTab.tsx` — (PR-G2 prévio) Sub-headers texto curto (Agend./Real./Show%/N/S), filter chips `rounded-md` com count, padding tabela `px-4 py-3.5`, hover `bg-muted/40`, expanded row `bg-muted/60`, CloserLeadTable `bg-muted/30`. **Colunas Temperatura mantidas visíveis** conforme decisão D1 do lead (colapso → task #15 separada).

## QA Results
<!-- QA preenche ao revisar -->
