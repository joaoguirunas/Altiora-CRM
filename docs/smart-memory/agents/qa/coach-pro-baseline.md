---
title: Coach Pro — Baseline (Pré-Refinamento)
type: qa-baseline
agent: dev-qa
team: joao-guirunas-coach-pro-ux-full
created: 2026-05-02
updated: 2026-05-10
status: phase-1-baseline
---

# Coach Pro — Baseline Pré-Refinamento

Estado atual dos 7 arquivos do Coach Pro antes da iteração de refinamento enterprise. Este documento serve como ponto de comparação para o veredicto final do gate de qualidade (Fase 2).

**Tenant João Guirunas:** `wotuyxscsfralqpoiyfv`
**Data baseline:** 2026-05-02

---

## Convenções observadas no código (consistência inter-tela)

Antes de listar issues por arquivo, identificamos inconsistências de design que aparecem entre arquivos do próprio Coach Pro. Estas são as principais áreas de risco para o refinamento:

| Padrão | CoachDashboard | CoachTeamBoard | CoachConsultantProfile | CoachMeetingEvaluation | CoachProConfig |
|---|---|---|---|---|---|
| Header height | `py-4` (~56px) | `h-[52px]` | `h-[52px]` | `py-4` (~56px) | sem header próprio |
| Border header | `border-zinc-800` | `border-border` | `border-border` | `border-zinc-800` | n/a |
| Section headers | `text-xs ... uppercase tracking-wide` | `text-[11px] ... uppercase tracking-widest` | `text-[11px] ... uppercase tracking-widest` | `text-xs ... uppercase tracking-wide` | `text-[12px] font-semibold` |
| Background | `bg-zinc-950` | `bg-zinc-950` (header) | `bg-zinc-950` (header) | `bg-zinc-950` | n/a |
| Border radius | `rounded-lg` | `rounded-lg` | `rounded-lg` | `rounded-lg`, `rounded-md` | `rounded-[4px]` |

**Conclusão:** Há **duas linguagens visuais coexistindo**:
1. Telas de listagem/avaliação (Dashboard, MeetingEvaluation): `rounded-lg`, `text-xs uppercase tracking-wide`, `border-zinc-800`
2. Telas de equipa/config (TeamBoard, ConsultantProfile, CoachProConfig): `rounded-[4px]`, `text-[11px] uppercase tracking-widest`, `border-border`

Telas como ReuniaoSingle e Reunioes seguem ainda **uma terceira linguagem** (`rounded-[2px]`, `bg-card`, `border-border`).

> **Risco para o refinamento:** se cada dev refinar sua tela isolado sem alinhar nesses tokens, a inconsistência piora. Recomendo definir 1 design system mínimo (radius, spacing, headers) antes de implementar.

---

## 1. `src/pages/CoachDashboard.tsx` (210 linhas)

### Estrutura atual
- Header com `Brain` icon + título "CoachPRO™" e Select de período (7d/30d/90d).
- 4 metric cards (Avaliações, Nota Média, Talk Ratio, Deal Risk).
- Lista de últimas avaliações (até 30 itens) com botão clicável → `/coach/meetings/:id`.
- Bloco de critério mais fraco/forte (condicional, só se metrics.weakest/strongest existir).

### Issues visuais/UX
- **[VISUAL-LOW]** `MetricCard` (linha 48) e o Deal Risk card (linha 114) têm estruturas diferentes mas tentam parecer iguais — gera diferença sutil de padding interno. Refatorar para um único componente.
- **[UX-LOW]** Filtro de período `30d` é default mas usa `useCoachRecentEvaluations(30)` hardcoded para 30 itens (linha 62) sem respeitar o período selecionado. Filtro de período só afeta `useCoachDashboardMetrics` mas não a lista. Inconsistente para o utilizador.
- **[VISUAL-LOW]** Bloco fraco/forte (linha 181) usa `grid-cols-2` fixo — quando só um existe, ocupa metade vazia. Considerar `flex` ou condicional layout.
- **[A11Y-LOW]** `<Brain>` icon no header não tem `aria-hidden`. Não bloqueante, mas refinamento enterprise costuma corrigir.

### Bugs / TypeScript
- **[BUG-LOW]** Variável `dominantRisk` (linha 65) escolhe primeiro risco com count > 0 na ordem `high → medium → low`. Se `high=0, medium=5, low=10`, mostra "Médio". Isso é intencional (priorizar pior risco) mas o label "Deal Risk" sem indicação de "dominante" pode confundir. UX-question.

### Pontos fortes (manter)
- Skeleton states em `loadingEvals` e `loadingMetrics`.
- Empty state com mensagem clara ("Nenhuma avaliação ainda...").
- Cores de score consistentes: emerald ≥8, yellow ≥6, orange ≥4, red <4.

---

## 2. `src/pages/CoachTeamBoard.tsx` (211 linhas)

### Estrutura atual
- Header `h-[52px]` com `Users` icon + "CoachPRO™ — Equipa" + Select 7d/30d/90d.
- Section "Benchmark da Equipa" com 3 metrics inline (nota média, talk ratio, critério mais fraco).
- Section "Consultores" com Table (Consultor, Nota, Calls, Trend, Gap).
- Cada row é clicável → `/coach/team/:userId`.

### Issues visuais/UX
- **[VISUAL-MEDIUM]** `BenchmarkBar` (linha 69) usa `useCoachDashboardMetrics('30d')` hardcoded, ignorando o filtro de período da página. Inconsistência: muda o período no header mas o benchmark não atualiza.
- **[VISUAL-LOW]** `scoreBadge` interno (linha 25) tem 3 thresholds (8/6/<6), enquanto `CoachDashboard.tsx` tem 4 (8/6/4/<4). Inconsistência de paleta entre telas irmãs.
- **[UX-LOW]** Tabela sem ordenação clicável (apenas Reunioes.tsx tem). Para "Equipa" com >5 consultores fica difícil identificar piores.
- **[VISUAL-LOW]** Badge "Deal Risk" no row (linha 110) só aparece quando `deal_risk_count > 0`, mas não indica quantidade. Hover/title ajudaria.

### Bugs / TypeScript
- **[IMPORT-LOW]** Importa `TrendingUp` mas `TrendIcon` está local. Sem problema funcional.
- **[A11Y-LOW]** Linha clicável de Table é `<TableRow onClick>` (linha 99). Não é botão — sem keyboard nav. Para uma board enterprise é gap notável.

### Pontos fortes (manter)
- `UserAvatar` com fallback para iniciais.
- Skeleton states adequados.
- Empty state ("Nenhum consultor com avaliações...").

---

## 3. `src/pages/CoachConsultantProfile.tsx` (367 linhas)

### Estrutura atual
- Header `h-[52px]` com botão "← Equipa", avatar+nome, Select de período.
- Hero card: avatar grande, nome, email, nota média, calls, trend.
- Section "Evolução de Scorecard" com `<ScoreChart>` SVG inline (linha 53).
- Grid 2 colunas: "Forças" (verde) e "Áreas a Melhorar" (yellow).
- Lista "Últimas Avaliações" com `EvaluationCard`.
- Botão final "Agendar sessão de coaching".

### Issues visuais/UX
- **[VISUAL-MEDIUM]** Header tem **dois** elementos de avatar+nome: um pequeno (size=sm, linha 235) e um grande no hero card (size=lg, linha 254). Redundante — refatorar para mostrar só no hero ou só no header.
- **[VISUAL-LOW]** `ScoreChart` SVG é custom, sem tooltip rico, sem grid lines, sem eixo X com datas. Em comparação com BIPro (que usa Recharts), parece amador. Considerar substituir por Recharts.
- **[VISUAL-LOW]** Benchmark line (linha 101) é dashed mas a legenda "— — benchmark equipa" (linha 289) está fora do SVG, separada por margin. Pode quebrar visualmente.

### Bugs / TypeScript
- **[BUG-MEDIUM]** Linhas 214-216:
  ```ts
  const top3Strengths = detail.evaluations
    .flatMap(e => [])
    .slice(0, 3);
  ```
  `flatMap(e => [])` retorna **sempre array vazio**. `top3Strengths` nunca é usado depois. **Código morto** — provavelmente trabalho inacabado.
- **[BUG-LOW]** `strengthCriteria` e `weakCriteria` (linhas 218-219) usam `detail.strongest_criterion` (singular) wrapped em array — sempre tem 0 ou 1 item. Section "Forças" (plural) lista 1 critério. UX-misleading.
- **[IMPORT-UNUSED]** `TrendingUp`, `TrendingDown`, `Minus` importados (linha 3) mas só `TrendIcon` os usa. OK.

### Pontos fortes (manter)
- Empty states claros.
- `formatDistanceToNow` com locale `ptBR`.
- Skeleton states adequados.

---

## 4. `src/pages/CoachMeetingEvaluation.tsx` (628 linhas)

### Estrutura atual
- Header com botão back + título da reunião + data + score badge + "Re-avaliar".
- 4 Tabs: **Scorecard / Coaching / Flow Map / Email**.
- **Scorecard**: Score gauge SVG, talk ratio + perguntas + monólogo, breakdown por secção, lista de critérios.
- **Coaching**: Pontos fortes, gaps, script de coaching, agenda follow-up, próximos passos.
- **Flow Map**: Sentiment arc + talk ratio bar + concorrentes mencionados.
- **Email**: Status (enviado/não enviado) + reenviar + preview.

### Issues visuais/UX
- **[VISUAL-MEDIUM]** Tab "Flow Map" é a mais escassa — só mostra sentiment arc + talk ratio (que já existe na Scorecard) + concorrentes. Conteúdo duplicado vs. Scorecard. Redesign necessário ou consolidar.
- **[VISUAL-LOW]** `ScoreGauge` (linha 88) é semi-circular mas o "/ 10" abaixo (linha 126) é textinho pequeno separado. Pode integrar dentro do SVG.
- **[UX-MEDIUM]** Não há indicação de estado de processamento da avaliação (`evaluation.status`). Botão "Re-avaliar" desabilita se `status === 'processing'` (linha 282) mas não há feedback visual sobre o status atual em si.

### Bugs / TypeScript
- **[BUG-CRITICAL]** Linha 372-374:
  ```ts
  const sectionCriteria = criteria.filter(c => {
    return true;
  });
  ```
  `sectionCriteria` é declarado mas **nunca usado**. Filter retorna sempre `true` — efeito de copiar todos os critérios. Bug ou trabalho inacabado: provavelmente deveria filtrar critérios por secção (`c.section_id === sec.id`) e renderizar dentro do bloco da secção. Atualmente todos os critérios são renderizados separadamente abaixo (linha 403). **Bloqueante para refinamento — corrigir lógica.**
- **[BUG-LOW]** Tab `email` (linha 553+) renderiza preview se `evaluation.strengths || evaluation.gaps || evaluation.next_steps` (linha 586) — mas o preview interno checa `&& length > 0` em cada um. Se todos forem `[]` (não-null), passa o outer check mas mostra card vazio.
- **[TYPE-LOW]** `verdictChip` (linha 37) tem `Record<EvaluationVerdict, ...>` — bom. Mas `dealRiskLabel` retorna `string` plain (linha 64). Inconsistência de padrão.

### Pontos fortes (manter)
- Tabs bem separados por fluxo de uso.
- Sentiment arc é creativo e visualmente útil.
- Loading/error states bem tratados.
- Mutation `useCoachReEvaluateMeeting` com feedback `isPending`.

---

## 5. `src/components/config/CoachProConfig.tsx` (1194 linhas)

### Estrutura atual
- Header com `BrainCircuit` icon + título "CoachPRO™" + descrição.
- 2 Tabs: **Playbooks / Configurações**.
- **Playbooks** tab: grid 2 colunas — esquerda lista templates de sistema + meus playbooks; direita editor (PlaybookEditor com sections+criteria).
- **Configurações** tab: contexto IA, notificações, sumário semanal, atribuição automática de playbook por meeting type.

### Issues visuais/UX
- **[VISUAL-HIGH]** **Tela é gigante** (1194 linhas) num único componente. Grid 2 colunas força horizontal scrolling em telas <1280px. Briefing diz "single-screen redesign" — está claro que precisa fragmentação.
- **[VISUAL-MEDIUM]** `CriterionEditor` (linha 271) tem **muitos campos inline** (título + switch obrigatório + delete + peso slider + descrição + 2 exemplos + hints). Em mobile/tablet quebra mal. Considerar collapse ou modal.
- **[UX-MEDIUM]** "Guardar critério" só aparece quando `dirty=true` (linha 425) — bom. Mas se o utilizador clica fora ou navega antes de salvar, perde tudo sem aviso. Sem `beforeunload` warning.
- **[UX-LOW]** "Atribuição automática de Playbook" (linha 1112) — se utilizador define dois playbooks como `is_default_for_type` para o mesmo meeting type, só um será o "padrão real" (RLS/seed dependente). UI permite essa ambiguidade.

### Bugs / TypeScript
- **[BUG-LOW]** Linha 152: `cloneTemplateId` é dependência do `useEffect` mas `templates` também — toda vez que `templates` reidrata (e.g. mutation), o efeito reroda e pode resetar `name` e `type` se utilizador já tiver editado (porque `if (tmpl)` resetará name). Comportamento subtil.
- **[BUG-LOW]** `handleDefaultForType` (linha 971) faz **N updates simultâneos** sem `await` por playbook do tipo — race condition possível. Em production seed-load isso pode dar inconsistência.
- **[IMPORT-UNUSED]** `Pencil` (linha 4) — usado linha 847. OK, mantido.

### Pontos fortes (manter)
- Estrutura modular: NewPlaybookDialog, CriterionEditor, SectionEditor, PlaybookEditor, PlaybooksTab, SettingsTab.
- AlertDialog para delete (não usa native confirm).
- Templates de sistema separados claramente de "Meus Playbooks".

---

## 6. `src/pages/ReuniaoSingle.tsx` (737 linhas)

### Estrutura atual
- Top action bar (sticky) com Status dropdown + Re-agendar + Google Cal + Teams + Delete.
- Header card: status accent bar + título + data/hora + duração + consultor + lead.
- 3 Tabs: **Detalhes / Registros / Relacionado**.
- **Detalhes**: Modo edição inline (toggle), grid 2 colunas com data/hora/local/link/resultado/consultor/status/observações. Bloco "CoachPRO" condicional ao módulo ativo.
- **Registros**: Lista de `MeetingRecordCard`s.
- **Relacionado**: Negócio + Cliente.

### Issues visuais/UX
- **[VISUAL-HIGH]** Bloco CoachPRO (linha 552-581) é minúsculo — apenas 1 badge + 1 botão "Ver Avaliação". Para uma reunião que **já tem avaliação**, é desperdício de espaço enterprise. Briefing diz "singles melhorados" — provavelmente quer score visível inline + insights diretos.
- **[VISUAL-MEDIUM]** Mistura linguagem visual `rounded-[2px]` do ReuniaoSingle com `rounded-[4px]/lg` do CoachPRO. Quando o utilizador clica "Ver Avaliação" e volta, sente que mudou de produto.
- **[UX-LOW]** "Modo de edição ativo" banner (linha 421) é primary blue — destacante. Mas `Cancelar` button é ghost (low contrast). Difícil ver.
- **[UX-LOW]** Status dropdown é optimistic (linha 152) — bom UX, mas se reverter por erro, não há toast. Falha silenciosa.

### Bugs / TypeScript
- **[BUG-LOW]** `extractTime` (linha 69) usa `getHours/getMinutes` — depende do timezone local do browser. Para reuniões agendadas em outras TZ pode mostrar horário incorreto.
- **[BUG-LOW]** Linha 174-176: `editLocation || undefined` — se utilizador apaga o local, `''` vira `undefined` e o backend não atualiza (não escreve null). Bug potencial: o local não é "limpável" via edição.
- **[A11Y-LOW]** `<a>` com `target="_blank"` tem `rel="noopener noreferrer"` (linha 279) — bom. Mas action bar tem `Edit3` icon como botão sem `aria-label`.

### Pontos fortes (manter)
- Optimistic update do status com revert.
- Edit mode bem isolado com banner visual.
- Navegação contextual via `useNavigation`.
- Responsividade `lg:grid-cols-2`.

---

## 7. `src/pages/Reunioes.tsx` (827 linhas)

### Estrutura atual
- ScheduleTabNav no topo.
- Tab bar interno (Lista / Semanal / Mensal) + botões Bloquear / Refresh / Nova Reunião.
- Google Calendar status bar (apenas em weekly/monthly).
- Filtros (apenas em list view): search + filtros avançados colapsáveis (status chips + período + equipe + consultor) + active filter pills.
- KPI strip: Total / Agendadas / Compareceram / Não compareceu / Show Rate.
- Lista (Table) com Sort, paginação, retry sync, badges de status.
- Weekly e Monthly views via `CalendarioSemanalView` e `CalendarioView`.

### Issues visuais/UX
- **[VISUAL-MEDIUM]** **Não tem coluna de "Avaliação Coach"** na Table de lista. Briefing pede "lista de meetings com avaliação" — atualmente só dá pra ver a avaliação entrando em `ReuniaoSingle`. Falta column showing score inline ou link "Avaliada/Pendente".
- **[VISUAL-LOW]** KPI strip e filtros têm dois `border-b border-border` empilhados — espaço apertado. Considerar mais respiro.
- **[VISUAL-LOW]** Tabela usa `STATUS_BADGE` hardcoded inline (linha 711). Em telas Coach (Dashboard, MeetingEvaluation) usa palettes diferentes. Inconsistência de status colors.
- **[UX-LOW]** Filtros avançados são collapsible — bom para limpeza visual, mas active filter pills ficam fora do collapse, podendo causar confusão ("vejo o pill mas onde está o controle?").

### Bugs / TypeScript
- **[BUG-LOW]** Linha 197-203: `statusCounts` filtra `agendado` OR `agendada` (mistura de IDs). Reflete inconsistência de schema/seed mas é defensivo. OK.
- **[BUG-LOW]** Linha 295-302: `formatTime` retorna `"–"` (em-dash) entre start/end. Em paginação alta, dois en-dashes seguidos podem confundir tabulação.
- **[TYPE-LOW]** Linha 246: `let av: any, bv: any` — uso de `any` com eslint-disable acima. Aceitável para sort polimórfico, mas refinamento enterprise costuma narrowed unions.
- **[A11Y-LOW]** TableRow `onClick` sem keyboard nav (mesmo gap que CoachTeamBoard).

### Pontos fortes (manter)
- Sort funcional com indicador visual.
- Active filter pills com clear individual.
- Empty state distingue "sem reuniões" vs "filtros sem matches".
- Retry sync com toast feedback.
- Paginação com truncation inteligente.
- Realtime subscription via `useRealtimeSubscription`.

---

## Pontos de atenção transversais (cross-cutting)

### Para o refinamento "visual enterprise consistente"
1. **Definir tokens unificados antes de implementar:** radius (`[2px]` vs `[4px]` vs `lg`), section header style (`text-[11px] tracking-widest` vs `text-xs tracking-wide`), border colors (`border-border` vs `border-zinc-800`).
2. **Score color thresholds** divergem entre `CoachDashboard.tsx` (4 níveis) e `CoachTeamBoard.tsx` (3 níveis) — alinhar.
3. **Period filter behavior** inconsistente: alguns hooks ignoram o período da página (CoachTeamBoard `BenchmarkBar`, CoachDashboard `useCoachRecentEvaluations(30)`).

### Para "filtros funcionais"
- Reunioes.tsx já tem filtros robustos. Coach* não têm filtros tabulares — apenas Select de período. Verificar se o briefing pede mais filtros nos Coach* ou só consistência de período.

### Para "charts com dados reais"
- Único chart real é o `ScoreChart` SVG inline em `CoachConsultantProfile.tsx` — custom, sem Recharts. Considerar migração para Recharts (já usado em BIPro) por consistência.

### Para "lista de meetings com avaliação"
- `Reunioes.tsx` Table **não tem coluna de avaliação**. Adicionar inline (score badge + status `evaluated/pending`) é provavelmente a entrega chave aqui.

### Para "singles melhorados"
- `ReuniaoSingle.tsx` tem bloco CoachPRO atrofiado (1 badge + 1 botão). Expansão para mostrar score, top issues, deal risk inline parece ser o objetivo.

### Para "sem TypeScript errors novos"
- Bugs **bloqueantes** identificados (devem ser corrigidos no refinamento, não introduzidos):
  - `CoachMeetingEvaluation.tsx:372-374` — `filter(c => true)` sem uso (BUG-CRITICAL)
  - `CoachConsultantProfile.tsx:214-216` — `flatMap(e => [])` código morto (BUG-MEDIUM)

### Para "sem mudanças de schema"
- Confirmado no contrato (memory `feedback_data_only_no_schema_changes`). QA verificará no veredicto final que nenhuma migration nova foi criada.

---

## Checklist final para Fase 2 (veredicto)

Quando os devs terminarem, verificarei nesta ordem:

| # | Critério | Foco |
|---|---|---|
| 1 | Code review | Tokens unificados? Padrão de section headers? `BUG-CRITICAL` corrigido? |
| 2 | Unit tests | `npm test` passa sem regressões? |
| 3 | Acceptance criteria | Visual enterprise + filtros + charts reais + lista com avaliação + singles melhorados |
| 4 | Sem regressões | Reunioes.tsx sort/filters/pagination ainda funcionam? Optimistic update do status? |
| 5 | Performance | Charts (Recharts?) sem N+1? `useCoachDashboardMetrics` re-fetched corretamente? |
| 6 | Security | Sem stack traces, RLS preservado, sem `any` introduzido em boundaries |
| 7 | Documentação | Coach Pro stories CP-1..CP-7 atualizadas com QA Results |
| 8 | Contratos API | Hooks (`useCoachEvaluations`, `useCoachTeam`, etc.) sem breaking changes |

---

**Baseline gerado em 2026-05-02 por dev-qa (Axikar). Aguardando notificação do team-lead para iniciar Fase 2.**
