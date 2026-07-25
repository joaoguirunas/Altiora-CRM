---
title: "Story CP-2: CoachTeamBoard — visual enterprise + filtros + benchmark refinado"
type: story
status: done
epic: coach-pro-refinamento
complexity: M
agent: dev-dev-alpha
created: 2026-05-02
updated: 2026-05-03
tags: [story, coach-pro, ux, redesign, enterprise]
related: ["[[../BACKLOG]]", "[[CP-1-coach-dashboard-enterprise]]", "[[CP-3-coach-consultant-profile]]"]
---

# Story CP-2: CoachTeamBoard — visual enterprise + filtros + benchmark refinado

## Objetivo
Redesenhar o CoachTeamBoard com look enterprise, adicionar filtro de time (hoje só tem período), enriquecer o BenchmarkBar com mais sinais (evolução, distribuição de risco) e melhorar a tabela de consultores com micro-charts inline (sparkline de trend) sem mudar a lógica de `useCoachTeamMetrics`.

## Acceptance Criteria

- [x] AC1: Header reformulado — título `Equipa` (sem prefixo `CoachPRO™ —`, redundante com sidebar), subtítulo descritivo, filtros de período + time numa linha consistente (`h-[30px]`).
- [x] AC2: Filtro de time adicionado — `Select Equipe` antes do filtro de período, usando `useTimesWithMethods()`. Filtro client-side cruzando com `useTeamMembers(undefined, teamId)`. Honra `canChangeFilters` de `useUserPermissions`.
- [x] AC3: BenchmarkStrip com 5 métricas em grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`: `Consultores`, `Nota Média Equipa`, `Avaliações`, `Talk Ratio Médio`, `Deal Risk Alto`. Hierarquia tipográfica BIPro via `MetricCell` (label `text-[11px]`, value `text-[22px]`).
- [x] AC4: Tabela com `border-border`, hover `bg-muted/40`, padding `px-5 py-3.5`. Coluna `Trend` com sparkline SVG inline (60×20, 5-7 pontos chronologicamente ordenados via `recent_scores`).
- [x] AC5: Coluna "Áreas a melhorar" mostra até 2 chips de critério com tooltip mostrando count, e `+N` se houver mais.
- [x] AC6: Badge `Deal Risk · N` na linha do consultor mostra count em vez de só ícone+label.
- [x] AC7: Empty state com `Users h-12 w-12 text-muted-foreground/20`, copy actionable, botão CTA "Convidar consultores" se `canChangeFilters` (link para `/dashboard/configuracoes/times`).
- [x] AC8: Loading skeleton via `SkeletonBlock` (BenchmarkStrip 120px + Table 400px).
- [x] AC9: Click numa linha navega para `/coach/team/{userId}` (mantido).
- [x] AC10: Zero regressão — sort/order da tabela preservado, ordenação por avg_score desc default mantida.

## Escopo

**IN:**
- `src/pages/CoachTeamBoard.tsx` (211 → 449 linhas).
- Extensão de `useCoachTeamMetrics` em `src/hooks/useCoachTeam.ts` para popular `recent_scores`, `weakest_criteria` (array com count) e `deal_risk_count`.
- Subcomponente `Sparkline` local (SVG inline, sem libs).

**OUT:**
- Mudanças em `useTeamMembers` ou `useTimesWithMethods`.
- Mudanças no `CoachConsultantProfile` ou `CoachDashboard` (CP-1, CP-3).

## Contexto Técnico

**Padrão visual atual (CoachTeamBoard.tsx):**
- Migrado para tokens semânticos `border-border`/`bg-muted/40` (eliminou `border-zinc-800` hardcoded).
- BenchmarkStrip via `MetricCell` shared (`@/components/dashboard/bipro-shared`) com 5 métricas hierarquizadas.
- TrendIcon + Sparkline inline lado a lado para sinal completo de evolução.
- Coluna "Áreas a melhorar" com chips + tooltip + overflow indicator.

**Filtro de time:**
- Hook `useCoachTeamMetrics(period)` mantém shape original; filtro client-side via `useMemo` cruzando `consultants` com `teamMembers.id`. Para non-managers, filtro adicional restringe a `currentUserId`.

**Sparkline:**
- Hook estendido com `recent_scores: number[]` (last 7) batch query — sem N+1.
- SVG inline 60×20px com polyline + circle no último ponto. Stroke colorido por trend (`#10B981`/`#EF4444`/`#94A3B8`).

**Constraints atendidos:**
- Sem libs de chart (SVG puro).
- Sem migrations.
- Bundle delta dentro do budget (+~5KB sources, gzip mínimo).

**Dependências:**
- Nenhuma — paralelizável com CP-1 e CP-3.

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | Novik (dev-dev-alpha) |
| Iniciado | 2026-05-02 |
| Concluído | 2026-05-03 |
| Branch | main (uncommitted, awaiting Grav push) |

## File List
- `src/pages/CoachTeamBoard.tsx` — refatorado (211 → 449 linhas; +394/-156 vs HEAD)
- `src/hooks/useCoachTeam.ts` — `ConsultantMetrics` estendido com `recent_scores`, `weakest_criteria` (array), `deal_risk_count`

## QA Results
<!-- QA preenche ao revisar (Gate Coach Pro CP-1/2/3/6/7 — task #18) -->
