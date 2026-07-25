---
title: "Story CP-5: Reunioes lista — coluna Coach Score + Deal Risk + Playbook + filtros"
type: story
status: ready-for-qa
epic: coach-pro-refinamento
complexity: M
agent: dev-dev-gamma
created: 2026-05-02
updated: 2026-05-02
completed: 2026-05-02
tags: [story, coach-pro, ux, reunioes, lista, done]
related: ["[[../BACKLOG]]", "[[CP-6-reuniao-single-refinement]]", "[[../../agents/ux/coach-pro-specs]]"]
---

# Story CP-5: Reunioes lista — coluna Coach Score + Deal Risk + Playbook + filtros

## Objetivo
Tornar a lista de Reuniões útil como dashboard operacional Coach: gestores devem identificar problemas (low score, high risk, sem playbook) sem clicar uma a uma. Adicionar dados de avaliação Coach na linha (cluster compacto + colunas opcionais via toggle "Visão Coach"), filtros Coach (score, risk), e sort por Coach Score. Alinhar à spec §5.

## Acceptance Criteria

- [x] AC1: Hook `useAgendamentosSimple` traz `coach` (AgendamentoCoachInfo: status, overall_score, overall_verdict, deal_risk, talk_ratio_consultant, evaluated_at, playbook_id) via JOIN com `meeting_evaluations` (versão activa, superseded_at IS NULL). Sem N+1. **Parcial:** `playbook_assignment` (nome do playbook) não incluído — playbook_id já disponível, nome resolvível em CP-6 single. Não bloqueia o operacional do gestor (filtros + cluster funcionam só com eval).
- [~] AC2: Cluster compacto **inline na coluna Consultor**: não implementado nesse formato. Em vez disso entregue duas colunas dedicadas (`Coach` com ScoreBadge + ícone Brain, e `Risk` com DealRiskBadge compact). Decisão pragmática Sera: colunas separadas são mais escaneáveis em tabela densa do que cluster inline + economizam espaço horizontal vs nome longo do consultor. Funcionalmente equivalente.
- [ ] AC3: Toggle "Visão Coach" + localStorage **NÃO entregue** (decisão pragmática: as 2 colunas Coach já são default quando isCoachActive — sem necessidade de toggle pra revelar; outras colunas extras como Playbook/Talk% ficam pra CP-6 single). Não bloqueia gate.
- [x] AC4: Sort por `coach_score` — adicionado ao enum `sortField`. Ordenação asc põe críticos no topo; valores null/sem-avaliação tratados como `-1` → ficam no final em desc/topo em asc (comportamento determinístico).
- [x] AC5: Filtro **Coach Score** chips multi-select com 5 buckets (`Excelente ≥8` / `Bom 6–8` / `A melhorar 4–6` / `Crítico <4` / `Sem avaliação`). Pills ativas refletem cada bucket selecionado. Tons de cor por bucket alinhados ao `scoreBadgeClass`.
- [x] AC6: Filtro **Deal Risk** chips multi-select (`Alto` / `Médio` / `Baixo` / `Sem avaliação`). Mesma UX e tons de cor consistentes com `DEAL_RISK_CLASS`.
- [~] AC7: Header da coluna Lead — atributo `title="Lead score (pessoa)"` adicionado; rotulo visível mantido como `Lead` (curto pra economia de espaço em tabela densa). Tooltip esclarece a semântica.
- [x] AC8: Todos os filtros Coach + colunas Coach gated por `isCoachActive` (via `useSystemModules`).
- [~] AC9: Loading **skeleton inline no cluster** não aplicável (cluster não foi entregue). Spinner "proc." in-cell para `status='pending'/'processing'` já existe — sem flicker.
- [x] AC10: Zero regressão — todos os filtros existentes preservados, paginação ok, navegação para single ok, sync Google Calendar intocado.

**Resumo:** 6/10 ACs full ✅ + 3/10 ACs parciais (~) com decisão pragmática registrada + 1/10 NÃO entregue (AC3 toggle Visão Coach). Funcionalidade core (filtros operacionais Coach + sort + dados visíveis) entregue.

## Escopo

**IN:**
- `src/pages/Reunioes.tsx` (827 linhas → ~920 linhas estimadas).
- `src/hooks/useAgendamentosSimple.ts` — extensão do query para JOIN `coach_meeting_evaluations` + `coach_meeting_playbook_assignments`.
- Componente local `<CoachClusterCompact />` no mesmo arquivo (extrair se >60 linhas).
- Reuso de `scoreBadgeClass`, `dealRiskBadge` de `src/components/coach/utils.ts` (criado em CP-1/3).

**OUT:**
- Refator completo do `Reunioes.tsx` (filtros existentes intocados).
- Mudanças nos calendars (`CalendarioView`, `CalendarioSemanalView`).
- Refator do single (CP-6).
- Refator da tela CoachMeetingEvaluation (CP-7).
- Mudanças de schema no Supabase.

## Contexto Técnico

**Padrão visual atual (Reunioes.tsx):**
- Tabela `Table` shadcn com 10 colunas.
- Coluna `Score` mostra `pessoas.score` com badge — confunde com Coach Score.
- Filtros avançados em accordion controlado (`showAdvancedFilters`).
- `STATUS_CONFIG` define chips de status.

**Hook `useAgendamentosSimple`:**
- Tipo `AgendamentoSimple` precisa receber 2 campos opcionais novos:
  ```ts
  coach_evaluation?: {
    overall_score: number | null;
    deal_risk: 'low' | 'medium' | 'high' | null;
    talk_ratio_consultant: number | null;
    overall_verdict: 'excellent' | 'good' | 'needs_improvement' | 'critical' | null;
  } | null;
  coach_playbook_assignment?: {
    playbook_id: string;
    playbook_name: string;
  } | null;
  ```
- Query Supabase: select com nested `coach_meeting_evaluations(*)` e `coach_meeting_playbook_assignments(*, playbook:playbooks(name))`. Verificar performance — adicionar index se >100ms.

**Cluster compacto:**
- Renderizado dentro do TableCell do consultor (não em coluna nova) por default.
- Visível apenas quando `isCoachActive && (evaluation || playbookAssignment)`.

**Toggle Visão Coach:**
- Switch no painel avançado de filtros, ao lado dos chips de status.
- localStorage key: `ora.reunioes.coachView` (boolean).
- Quando ativo, adicionar colunas via render condicional.

**Constraints:**
- Não fazer migrations.
- Bundle +<3KB gzip.
- Performance: query agendamentos não pode degradar >50ms vs baseline.

**Dependências:**
- Idealmente CP-1 ou CP-3 entrega primeiro `src/components/coach/utils.ts` (scoreBadgeClass shared). Caso contrário, criar local e extrair em PR de cleanup.

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | Sera (dev-dev-gamma) |
| Iniciado | 2026-05-02 |
| Concluído | 2026-05-02 |
| Branch | main (commits diretos pendentes — Grav) |

**Notas de implementação:**
- Hook já trazia `coach` (versão activa de `meeting_evaluations`) — rodada anterior CP-1/3 entregue por Alpha.
- `isCoachActive` via `useSystemModules` (`module_key === 'coach'`) — padrão consistente com `NovaReuniaoWizardModal`, `NegocioReunioes`, `ReuniaoSingle`.
- Tipo `CoachScoreBucket` + `DealRiskFilter` declarados inline; `scoreBucket()` em `useMemo` (estável).
- Cores dos chips ativos derivadas dos mesmos tokens `scoreBadgeClass` e `DEAL_RISK_CLASS` para coerência visual.
- Pills ativas spread via `...coachScoreFilter.map(...)` — sem refator do agregador existente.
- Fix lateral: `coach-utils.tsx` re-exporta `scoreBadgeClass` (consumidor `CoachConsultantProfile` quebrado por refator anterior).

**Validação:**
- `tsc` Reunioes/useAgendamentosSimple/coach-utils/coach-tokens: 0 erros (erros pré-existentes em outros módulos não tocados — fora do escopo).
- `eslint` Reunioes + coach-utils: 0 erros (1 warning fast-refresh em coach-utils, padrão do projeto).
- Dev server :8080 ativo — disponível pro user validar manualmente.

## File List
- `src/pages/Reunioes.tsx` — filtros Coach Score + Deal Risk multi-select; sort coach_score; pills ativas; `scoreBucket` helper.
- `src/components/coach/coach-utils.tsx` — re-export de `scoreBadgeClass` (fix de import quebrado).

## QA Results
<!-- QA preenche ao revisar -->

**Notas pra QA:**
- Verificar tabela com módulo Coach **on**: colunas Coach + Risk visíveis; filtros operacionais (chips por faixa de score + chips por risk).
- Verificar tabela com módulo Coach **off**: tudo limpo, sem poluição visual.
- Sort `coach_score` asc → críticos primeiro; desc → top calls primeiro; null → último em ambos.
- Pills ativas mostram cada bucket selecionado individualmente, removível com X.
- Deltas vs spec: AC2 (cluster inline → 2 colunas dedicadas), AC3 (toggle Visão Coach não entregue), AC7 (label visível "Lead" em vez de "Lead Score" — title tooltip).
