---
title: "Story CP-3: CoachConsultantProfile — refinamento visual enterprise + radar + breakdown"
type: story
status: done
epic: coach-pro-refinamento
complexity: L
agent: dev-dev-alpha
created: 2026-05-02
updated: 2026-05-03
tags: [story, coach-pro, ux, redesign, enterprise]
related: ["[[../BACKLOG]]", "[[CP-1-coach-dashboard-enterprise]]", "[[CP-2-coach-team-board-enterprise]]", "[[../../agents/ux/coach-pro-specs]]"]
---

# Story CP-3: CoachConsultantProfile — refinamento visual enterprise + radar + breakdown

## Objetivo
Refinar a tela do perfil do consultor para entregar a pergunta-chave do gestor em <5s: "onde devo focar coaching com este consultor?". Substituir o SVG inline por charts Recharts (Composed + Radar), enriquecer Top Forças/Gaps com scores numéricos, adicionar breakdown por playbook, e alinhar ao look enterprise definido em `coach-pro-specs.md §3.3`.

## Acceptance Criteria

- [x] AC1: Header refeito — botão `← Equipa`, avatar + nome do consultor, `Period Select` (7d/30d/90d), botão "Agendar coaching" promovido para o header.
- [x] AC2: Hero substituído por KPI strip 5 cells via `MetricCell` (`Calls`, `Nota Média`, `Show Rate`, `Talk Ratio`, `Trend Δ`). Border-l progressivo via `lg:border-l border-border`.
- [x] AC3: Chart "Evolução de Scorecard" — Recharts `ComposedChart` (Area + Line). Linha de benchmark dashed em `CHART_COLORS.muted`. Pontos coloridos por nota. Height 220px. Wrapper em `SectionCard` com title + badge `{N} calls`.
- [x] AC4: Chart "Comparativo vs Equipa" — Recharts `RadarChart` ao lado da evolução em grid `md:grid-cols-2 gap-4`. 6-8 critérios. Series: `Consultor` (azul, fillOpacity 0.3) vs `Equipa avg` (muted dashed). Height 260px.
- [x] AC5: Top 3 Forças e Top 3 Gaps — listas de até 3 itens cada com score numérico médio (`✓ Critério X — 8.7`). Ícones `CheckCircle` verde para forças, `AlertTriangle` amber para gaps. Wrapper em 2 SectionCards lado a lado.
- [x] AC6: Seção "Performance por Playbook" — Table shadcn com colunas: Playbook, Calls, Avg Score, Show%, Best Critério, Worst Critério. Wrapper em SectionCard. Linhas read-only.
- [x] AC7: "Últimas Avaliações" reformatada — Table shadcn com colunas alinhadas com §5.2 da spec (Data, Reunião, Playbook, Score, Risk, Talk%, Verdict). Hover navegável para `/coach/meetings/{meetingId}`.
- [x] AC8: `ScoreBadge`, `DealRiskBadge`, `VerdictBadge`, `scoreBadgeClass` extraídos para `src/components/coach/coach-utils.tsx` (compartilhado com CP-1, CP-2, CP-7).
- [x] AC9: Loading state coerente — Skeleton para hero (h-24), charts (h-56), tabelas (h-40) via `SkeletonBlock`.
- [x] AC10: Zero regressão — clicks em avaliações continuam navegando, botão "Agendar coaching" continua linkado para `/schedule?consultant={userId}`.

## Escopo

**IN:**
- `src/pages/CoachConsultantProfile.tsx` (367 → 675 linhas; +597/-289 vs HEAD).
- `src/components/coach/coach-utils.tsx` (criado; compartilhado).
- Extensão de `useCoachConsultantDetail` em `src/hooks/useCoachTeam.ts` para retornar `criteria_breakdown` (top 3 forças/gaps com avg score) e `playbook_breakdown` (lista por playbook).

**OUT:**
- Modal de "ver detalhes" do critério — fica para iteração futura.
- Mudanças no `CoachDashboard` ou `CoachTeamBoard` (CP-1, CP-2).
- Mudanças nos hooks de evaluation single (CP-7).
- Mudança de schema no Supabase.

## Contexto Técnico

**Padrão visual aplicado:**
- Hero `flex bg-zinc-900 border-zinc-800` substituído por `MetricCell` strip (5 cells, border-l progressivo).
- `ScoreChart` SVG manual removido — `ComposedChart` Recharts cobre Y axis + tooltip + reference line nativamente.
- Forças/Gaps com `criteria_breakdown` (3+3 itens com avg score) substituiram `strongest_criterion`/`weakest_criterion` (string única).
- Comparativo vs equipa via RadarChart Recharts (sem libs novas).
- Performance por Playbook é seção nova alimentada por `playbook_breakdown`.

**Hook estendido:**
- `CriteriaBreakdownItem`: `{ criterion: string; avg_score: number; appearances: number; type: 'strength' | 'gap' }`
- `PlaybookBreakdownItem`: `{ playbook_id: string; playbook_name: string; calls: number; avg_score: number; show_rate: number; best_criterion: string | null; worst_criterion: string | null }`
- Computado client-side a partir dos dados já retornados pelo RPC (sem mudança de schema).

**Recharts:**
- `ComposedChart` (Area + Line + ReferenceLine), `RadarChart` (PolarGrid + PolarAngleAxis + PolarRadiusAxis + Radar + Legend) — todos exports padrão.
- Reuso da config `CHART_COLORS` alinhada com §2.1 da spec.

**Constraints atendidos:**
- Sem libs novas (Recharts já carregado).
- Bundle delta dentro do budget (<5KB gzip — Recharts já tree-shaked nas outras telas).
- Mobile: `md:grid-cols-2` colapsa para 1 coluna abaixo de `md`.

**Dependências:**
- Coordenado com CP-1 e CP-2 — `coach-utils.tsx` criado e consumido pelos 3.
- Hook estendido sem invasão de schema/RPC.

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | Novik (dev-dev-alpha) |
| Iniciado | 2026-05-02 |
| Concluído | 2026-05-03 |
| Branch | main (uncommitted, awaiting Grav push) |

## File List
- `src/pages/CoachConsultantProfile.tsx` — refatorado (367 → 675 linhas; +597/-289 vs HEAD)
- `src/components/coach/coach-utils.tsx` — novo (utilitários `ScoreBadge`/`DealRiskBadge`/`VerdictBadge`/`scoreBadgeClass`)
- `src/hooks/useCoachTeam.ts` — `CriteriaBreakdownItem` + `PlaybookBreakdownItem` + extensão de `useCoachConsultantDetail`

## QA Results
<!-- QA preenche ao revisar (Gate Coach Pro CP-1/2/3/6/7 — task #18) -->
