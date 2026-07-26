---
title: Coach Pro CP-1/2/3/6/7 — Veredicto Formal
type: qa-verdict
agent: dev-qa
team: ora-coach-pro-ux-full
created: 2026-05-02
revised: 2026-05-03
verdict: CONCERNS+DATA-FIX-NEEDED
stories: [CP-1, CP-2, CP-3, CP-6, CP-7]
related: ["[[coach-pro-baseline]]", "[[../ux/coach-pro-specs]]"]
---

# Coach Pro CP-1/2/3/6/7 — Veredicto Formal

```
VEREDICTO: ⚠️ CONCERNS+DATA-FIX-NEEDED (revisado 2026-05-03)
Stories: CP-1, CP-2, CP-3, CP-6, CP-7
Data emissão: 2026-05-02 — Revisão: 2026-05-03
Código Phase 2: aprovado com observações (correto contra contract /10).
Demo: BLOQUEADA até fix do seed (CONCERN-0 abaixo).
```

> CP-4 (CoachProConfig) e CP-5 (Reunioes lista) ainda em desenvolvimento por dev-dev-gamma — fora deste gate.

---

## ⚠️ ADENDO 2026-05-03 — CONCERN-0 CRITICAL (data integrity)

**Identificado pelo team-lead pós veredicto inicial.** Bug não capturado no gate inicial — lição QA registrada em `feedback_runtime_smoke_before_gate.md` (gates de UI exigem smoke runtime visual com dados reais, não só validação contra contract de tipos).

### Inconsistência de escala `overall_score`: dados em 0-100 vs contract em 0-10

**Onde (raiz do bug):**
- `supabase/seeds/demo-2026-05-02/08_coach_pro.sql:18` — `v_score int` declarado como inteiro
- `supabase/seeds/demo-2026-05-02/08_coach_pro.sql:94` — `v_scores int[] := ARRAY[85, 70, 92, 66, 88, 74, 81, 95, 63, 87, 73, 90]` (escala 0-100)
- `supabase/seeds/demo-2026-05-02/08_coach_pro.sql:120-132, 244` — thresholds e sentiment_arc `(v_score - 8)` / `(v_score + 6)` ajustados para 0-100

**Evidência triangulada de que contract dominante é 0-10 (8 fontes):**

| Fonte | Linha | Evidência |
|---|---|---|
| `supabase/functions/bi-insights-chat/index.ts` | 84 | `${(score ?? 0).toFixed(1)}/10` |
| `supabase/functions/coach-email/index.ts` | 384 | `${score.toFixed(1)}/10` |
| `supabase/functions/coach-email/index.ts` | 434 | `${score.toFixed(1)}/10` |
| `src/pages/CoachMeetingEvaluation.tsx` | 127 | `(score / 10) * 100` (gauge ScoreRing) |
| `src/pages/CoachMeetingEvaluation.tsx` | 751 | `(sec.score / 10) * 100` |
| `src/components/coach/coach-utils.tsx` | 7-9 | thresholds `≥8 emerald / ≥6 amber / ≥4 orange` |
| `src/pages/CoachDashboard.tsx` | 115-116 | `minVal=0, maxVal=10` (eixo Y do chart) |
| `src/pages/CoachDashboard.tsx` | 130 | `gridValues = [0, 2.5, 5, 7.5, 10]` |

**Inconsistência interna PRÉ-EXISTENTE (não introduzida pela Phase 2):**
- `src/components/reunioes/MeetingRecordCard.tsx:71` — `(score / 100) * circ` — componente legacy assume 0-100, contradiz contract dominante. Bug pré-existente que ficou latente até o seed atual expor.

**Efeito runtime com seed 2026-05-02 aplicado:**

| Componente | Esperado (score 7.5) | Atual (score 75 do seed) |
|---|---|---|
| `CoachDashboard.ScoreEvolutionChart` | linha de score 0-10 | pontos clipados acima do topo (Y vai negativo) |
| `CoachDashboard` benchmark dashed | linha em y=7.5 | sempre no topo (Math.min(10, 75) = 10) |
| `CoachDashboard` dot color | gradient via thresholds | sempre emerald (85 >= 8) |
| `CoachMeetingEvaluation.ScoreRing` | gauge 75% | sempre cheio 100% (Math.min(100, 850) clipa) |
| `coach-utils.ScoreBadge` | distribuição de cor | sempre emerald (todos os scores>=8) |
| KPI "Score médio" headers | "7.4" | "82.3" (número absurdo) |

### Decisão A/B pendente do Chief

**Opção A (recomendada):** seed errado, UI/edge fns corretos. Contract `/10` dominante (8 fontes contra 1). Fix:
1. `08_coach_pro.sql:18` — `v_score int` → `v_score numeric(4,2)`
2. `08_coach_pro.sql:94` — `ARRAY[8.5, 7.0, 9.2, 6.6, 8.8, 7.4, 8.1, 9.5, 6.3, 8.7, 7.3, 9.0]`
3. `08_coach_pro.sql:120-132` — recalibrar thresholds para escala 0-10
4. `08_coach_pro.sql:244` — sentiment_arc proporcional ao novo range
5. Corrigir `MeetingRecordCard.tsx:71` `(score/100)` → `(score/10)` (legacy)
6. Re-rodar seed

**Opção B:** inverter contract para 0-100. Mais invasivo (toca UI + 3 edge fns + thresholds em ≥4 arquivos):
1. `CoachDashboard.tsx:116, 130` — eixo 0-100
2. `CoachMeetingEvaluation.tsx:127, 751` — `/10` → `/100`
3. `coach-utils.tsx:7-9` — thresholds `≥80 / ≥60 / ≥40`
4. `ReuniaoSingle.tsx:183-185, 578-580` — thresholds idem
5. `CoachConsultantProfile.tsx:499` — thresholds idem
6. Edge fns formatos `/10` → `/100` (3 lugares)

### Por que mantenho CONCERNS (não FAIL) para o código Phase 2

O **código** entregue no epic Phase 2 está **correto contra o contract `/10`**. Os 5 devs (Alpha CP-1/2/3, Beta CP-6/7) não introduziram este bug — seguiram a contract dominante. O bug está no **seed**, responsabilidade do dev-data-engineer.

PORÉM, em runtime com seeds 2026-05-02 aplicados, as 5 telas ficam **visualmente quebradas**, então qualquer demo fica inutilizável. Daí o sufixo `+DATA-FIX-NEEDED` — gate Phase 2 não vai para FAIL (código não tem bug), mas demo bloqueia até seed ser corrigido.

### Responsável e SLA

- Fix do seed (Opção A): **dev-data-engineer** — ~5 min de edição + re-seed
- Fix `MeetingRecordCard.tsx:71` legacy: **dev-dev-alpha** — 1 linha
- Smoke test visual pós-fix: **dev-qa** — 10 min

---

## Resumo executivo

**Implementação sólida e visualmente coerente** com a direção enterprise do BIPro. Tokens semânticos (`bg-card`, `border-border`, `bg-muted`) **100% adotados** nas 5 telas — zero resíduos de `bg-zinc-*` ou `border-zinc-*`. SectionCard + MetricCell padronizados em todas as KPI strips. Filtros de equipa+consultor+período funcionais. Os dois bugs do baseline (`CoachConsultantProfile.tsx:214` flatMap morto e `CoachMeetingEvaluation.tsx:373` filter sem uso) **foram corrigidos** corretamente: CP-3 agora usa `criteria_breakdown` real do hook, CP-7 filtra por `c.criterion?.section_id === sec.section_id` após adicionar `section_id` em `EvaluationCriterionResult`.

**Aprovado com 1 CONCERN MEDIUM e 4 CONCERNS LOW** documentados abaixo. Nenhum issue bloqueante. Pronto para push do epic Coach Pro Phase 1 (CP-1/2/3/6/7) após dev-gamma fechar CP-4/CP-5.

---

## Validação por critério (8-Point Checklist)

| # | Critério | Resultado | Nota |
|---|---|---|---|
| 1 | Code review (patterns, legibilidade) | ✅ PASS | 5 telas seguem mesmo shape: Header sticky → KPI strip → SectionCards. Componente `coach-utils.tsx` consolida `ScoreBadge`, `DealRiskBadge`, `VerdictBadge`. |
| 2 | Unit tests | ⚪ N/A | Projeto sem test runner configurado para essa área (pré-existente). |
| 3 | Acceptance criteria | ⚠️ Parcial | Visual enterprise ✅, filtros ✅, charts reais ✅ exceto CP-1/CP-2 (ver CONCERN-1). |
| 4 | Sem regressões | ✅ PASS | ReuniaoSingle preserva optimistic status update, edit mode, modais. Hooks `useMeetingPlaybookAssignment`/`useMeetingEvaluation` com nova surface mais ampla, mas backward-compat. |
| 5 | Performance | ✅ PASS | Hooks `useCoachTeamMetrics`/`useCoachConsultantDetail` em `Promise.all` paralelo, staleTime 3min. ResponsiveContainer Recharts com height fixo. Animações `framer-motion` com `useReducedMotion` honrado. |
| 6 | Security | ✅ PASS | Sem stack traces no UI, RLS preservado (queries `.eq('status','done')` + joins `meetings.user_id`). Sem segredos no client. |
| 7 | Documentação | ✅ PASS | `coach-pro-specs.md` (dev-ux) + `coach-pro-baseline.md` (QA) presentes em smart-memory. Stories CP-1..7 em `stories/backlog/`. |
| 8 | Contratos API | ✅ PASS | `EvaluationCriterionResult.criterion.section_id` adicionado em `types/coach.ts:53` — backward-compat. `useCoachTeam.ts` exporta novos tipos `ConsultantDetail`, `CriteriaBreakdownItem`, `PlaybookBreakdownItem`, `ScorePoint` sem breaking change. |

**TypeScript:** `npx tsc --noEmit` → **EXIT 0** (zero erros).
**ESLint dos 9 arquivos do escopo:** **0 errors** + 6 warnings de `react-refresh/only-export-components` em `coach-utils.tsx` (helper file misto componente+const — DX HMR apenas, não afeta runtime).
**Migrations:** ✅ nenhuma criada/alterada. Confirmado contrato "apenas dados, nunca estrutura".

---

## CONCERNS (não-bloqueantes)

### CONCERN-1 (MEDIUM): CoachDashboard e CoachTeamBoard não usam Recharts

**Onde:**
- `src/pages/CoachDashboard.tsx:94-242` — `ScoreEvolutionChart` é SVG inline manual (148 linhas).
- `src/pages/CoachTeamBoard.tsx:46-93` — `Sparkline` é SVG inline manual.

**Briefing recebido pelo time:** "charts com recharts".
**Spec dev-ux §4:** explicitamente recomenda `ComposedChart` (Area+Line) para evolução de score com benchmark dashed e `LineChart` minúsculo para sparkline.

**Análise:**
- CP-3 (`CoachConsultantProfile.tsx`) e CP-7 (`CoachMeetingEvaluation.tsx`) **migraram corretamente** para Recharts (ComposedChart, RadarChart, RadialBarChart, BarChart). CP-1 e CP-2 **ficaram em SVG manual**.
- Os SVGs renderizam corretamente, têm `<title>` para tooltip nativo, gradient `coachScoreGrad`, grid lines pontilhadas, eixos legíveis. Funcionalidade não está quebrada.
- Inconsistência visual com BIPro (que usa Recharts) e com as outras 2 telas Coach do mesmo gate.
- Sparkline 60×20px é argumentável — Recharts tem overhead para algo tão pequeno. Mas o `ScoreEvolutionChart` 800×220 é candidato natural para Recharts.

**Por que não FAIL:** os charts existem, são legíveis, têm benchmark e dados reais. Não bloqueia o push. É dívida de consistência declarada para iteração próxima.

**Ação:** criar story follow-up `CP-1-FIXUP-RECHARTS` (ou consolidar em CP-9) para migrar `ScoreEvolutionChart` (CP-1) para Recharts ComposedChart. `Sparkline` pode permanecer como SVG (justificável).

---

### CONCERN-2 (LOW): Bug shape em `useCoachTeam.ts:164` (defensivo improvável)

**Onde:** `src/hooks/useCoachTeam.ts:131-137` declara o tipo do `byUser` Map com `recentScores: number[]` obrigatório. Linha **143** inicializa o objeto **com** `recentScores: []`. Linha **164** inicializa **sem** `recentScores`:

```ts
// L143 (correto):
byUser.set(uid, { scores: [], recentScores: [], dealRiskCount: 0, notMetCriteria: ..., metCriteria: ... });

// L164 (BUG):
byUser.set(uid, { scores: [], dealRiskCount: 0, notMetCriteria: ..., metCriteria: ... });
```

**Por que tsc não pegou:** projeto tem `strict: false` e `strictNullChecks: false` no `tsconfig.json` raiz. Em modo `--strict` o compilador acusaria `Property 'recentScores' is missing`.

**Risco runtime:** se um consultor aparecer **apenas** nos `criteriaRows` (linha 119) e **não** em `rows` (linha 105) — improvável dado que ambas as queries filtram pelo mesmo período, e `criteriaRows` faz join `meeting_evaluations!inner` — o objeto inicializado em L164 ficaria sem `recentScores`. Acessar `.length` em `undefined` em outro lugar resultaria em throw. Caminho defensivo improbável mas não impossível.

**Ação:** adicionar `recentScores: []` na linha 164 (correção de 1 linha). Não bloqueante porque na prática o caminho é dominado por L143.

---

### CONCERN-3 (LOW): `talk_ratio_consultant` extraído via cast `unknown` em CoachConsultantProfile

**Onde:** `src/pages/CoachConsultantProfile.tsx:605-607`:

```ts
const talkRatios = detail.evaluations
  .map(e => (e as unknown as { talk_ratio_consultant?: number | null }).talk_ratio_consultant)
  .filter((r): r is number => typeof r === 'number');
```

**Análise:** `ConsultantEvaluation` (em `useCoachTeam.ts:19-29`) **não declara** `talk_ratio_consultant` no tipo. O hook `useCoachConsultantDetail` também **não seleciona** essa coluna no `.select(...)` da query (linha 237). Resultado: `talkRatios` será sempre `[]` em runtime; `avgTalk` será sempre `null`; o KPI "Talk Ratio" no `HeroStrip` mostra `—` mesmo quando a tabela tem dados.

**Por que não MEDIUM:** o KPI degrada graciosamente (`'—'`/`'sem dados'`). Não quebra. Mas é métrica anunciada no spec §3.3 que não vai funcionar sem expandir a query.

**Ação:** estender `select` do `useCoachConsultantDetail` (`useCoachTeam.ts:237`) para incluir `talk_ratio_consultant` e adicionar à interface `ConsultantEvaluation`. Remover o cast `as unknown as`. Issue ~10 linhas.

---

### CONCERN-4 (LOW): `playbook_breakdown.best_criterion`/`worst_criterion` hardcoded `null`

**Onde:** `src/hooks/useCoachTeam.ts:374-382`:

```ts
const playbook_breakdown: PlaybookBreakdownItem[] = [...playbookMap.values()].map(p => ({
  playbook_name: p.name,
  calls: p.scores.length,
  avg_score: ...,
  best_criterion: null,   // ← TODO
  worst_criterion: null,  // ← TODO
}))
```

**Análise:** o tipo `PlaybookBreakdownItem` (linha 38-44) declara `best_criterion`/`worst_criterion` mas o hook nunca os calcula. A UI atual em `CoachConsultantProfile.tsx:417-435` (Performance por Playbook) só renderiza Playbook | Calls | Nota Média — não usa os campos dead. Funcionalidade não quebra.

**Ação:** ou (a) calcular `best_criterion`/`worst_criterion` por playbook e expor na UI, ou (b) remover do tipo se decidir que não fazem parte do escopo. Não bloqueante.

---

### CONCERN-5 (LOW): `EvaluationStatus` declarada mas `evaluation.status` ainda `string` em alguns paths

**Onde:**
- `src/types/coach.ts:4` declara `EvaluationStatus = 'pending' | 'processing' | 'done' | 'failed'`
- `src/hooks/useCoachMeetingAssignment.ts:23` declara `status: string` (não usa o tipo strong).
- `src/pages/ReuniaoSingle.tsx:108` declara `status: string` em `CoachEval`.

**Análise:** `ReuniaoSingle` (CP-6) compara `status === 'processing' || 'pending' || 'failed' || 'done'` em strings literais (linhas 127-129). Funciona, mas não tem garantia do tipo. Cosmético.

**Ação:** `MeetingEvaluation` em `useCoachMeetingAssignment.ts:21-31` deveria importar `EvaluationStatus` de `@/types/coach`. Issue de 2 linhas.

---

## Pontos de destaque positivos (worth keeping)

1. **Tokens 100% migrados.** Zero `bg-zinc-*`/`border-zinc-*` em todas as 5 telas. Único projeto Coach Pro alinhado ao design system base.
2. **Bugs do baseline corrigidos:**
   - CP-7: `criteria.filter(c => true)` → `criteria.filter(c => c.criterion?.section_id === sec.section_id)` ([CoachMeetingEvaluation.tsx:716-718](file:///Users/joaoramos/Desktop/Projetos/Projetos/ora/src/pages/CoachMeetingEvaluation.tsx)). `EvaluationCriterionResult.criterion.section_id` adicionado em `types/coach.ts:53` e queryado em `useCoachEvaluations.ts:18` (`criterion:playbook_criteria(title, is_required, section_id)`).
   - CP-3: `flatMap(e => [])` removido. Substituído por `criteria_breakdown` real do hook com top 3 strengths + top 3 gaps com avg_score e appearances ([CoachConsultantProfile.tsx:306-307](file:///Users/joaoramos/Desktop/Projetos/Projetos/ora/src/pages/CoachConsultantProfile.tsx)).
3. **Score thresholds unificados.** Todas as 5 telas usam o mesmo padrão (≥8 emerald, ≥6 amber, ≥4 orange, <4 red) — o gap entre CP-1 (4 níveis) e CP-2 (3 níveis) do baseline foi resolvido.
4. **CoachProSummary em CP-6.** Bloco com 4 estados (no-eval / processing / failed / done), score destacado no hero direito do header card, mini-resumo com score+verdict+risk+talk-ratio+top-gap. Resolve "singles melhorados" do briefing com folga.
5. **CP-7 ScoreRing (RadialBar 270°)** + `SectionMiniRadar` por seção + Timeline de critérios em Flow Map + Section bar chart horizontal. Tab Email com status separado de preview. Resolve todas as recomendações §3.4 do spec.
6. **`useCoachTeamMetrics` agora retorna `recent_scores: number[]`** para sparkline (CP-2) — 7 últimos scores em ordem cronológica, alinhado ao spec §4.5.
7. **Performance per Playbook table** (CP-3) calculada server-side via group-by no hook — solução elegante para o gap "consultor é melhor em discovery vs closing?".
8. **Botão "Ver Reunião"** no header de CP-7 (`CoachMeetingEvaluation.tsx:546-555`) cria navegação bidirecional Coach ↔ Schedule. Boa pegada.

---

## Próximo passo

```
@dev-devops aguardar conclusão de CP-4/CP-5 (dev-dev-gamma) antes de push.
@dev-chief observações documentadas — não bloqueante, push aprovado quando epic completar.

Follow-ups recomendados (opcional, não bloqueante):
1. CP-1-FIXUP-RECHARTS: migrar ScoreEvolutionChart de CP-1 para Recharts ComposedChart
2. CP-3-FIXUP-TALKRATIO: expandir useCoachConsultantDetail para selecionar talk_ratio_consultant
3. CP-2-FIXUP-SHAPE: adicionar recentScores: [] em useCoachTeam.ts:164
4. CP-3-FIXUP-PLAYBOOK-CRITERIA: calcular best_criterion/worst_criterion no playbook_breakdown
```

---

## Arquivos verificados

| Arquivo | LOC | Status |
|---|---|---|
| `src/pages/CoachDashboard.tsx` | 765 | ⚠️ CONCERN-1 (sem Recharts) |
| `src/pages/CoachTeamBoard.tsx` | 449 | ⚠️ CONCERN-1 (sparkline SVG) |
| `src/pages/CoachConsultantProfile.tsx` | 675 | ⚠️ CONCERN-3 |
| `src/pages/ReuniaoSingle.tsx` | 932 | ⚠️ CONCERN-5 |
| `src/pages/CoachMeetingEvaluation.tsx` | 1116 | ⚠️ CONCERN-5 |
| `src/hooks/useCoachTeam.ts` | 468 | ⚠️ CONCERN-2 + CONCERN-4 |
| `src/hooks/useCoachEvaluations.ts` | 166 | ✅ |
| `src/hooks/useCoachMeetingAssignment.ts` | 161 | ⚠️ CONCERN-5 |
| `src/types/coach.ts` | 77 | ✅ |
| `src/components/coach/coach-utils.tsx` | 147 | ✅ (warnings DX HMR apenas) |

**Total:** 4956 LOC analisadas.
