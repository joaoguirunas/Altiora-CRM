---
title: "Story FWUP-11: Padronizar nomenclatura PT→EN em followup_queue e meeting_followup_queue"
type: story
status: backlog
epic: FWUP
complexity: M
priority: P2
agent: dev-data-engineer
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, schema, naming, consistency, p2]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-09]]"]
---

# Story FWUP-11: Padronizar nomenclatura PT→EN em followup_queue e meeting_followup_queue

## Objetivo
Convergir colunas de `followup_queue` (que ainda usam `canal`, `mensagem`, mistura de FK names) para o padrão EN snake_case já adotado em `meeting_followup_queue` e tabelas pós-2025/10. Resolver também a divergência `scheduled_at` vs `scheduled_for`.

## Acceptance Criteria
- [ ] **AC1:** ADR define que **EN snake_case é convenção canônica** para todas as tabelas pós-2025; PT mantido apenas em tabelas legadas que serão futuramente squashadas.
- [ ] **AC2:** Migration renomeia `followup_queue.canal` → `channel`.
- [ ] **AC3:** Migration renomeia `followup_queue.mensagem` → `message`.
- [ ] **AC4:** Migration renomeia `followup_queue.scheduled_at` → `scheduled_for` (alinhar com `meeting_followup_queue`).
- [ ] **AC5:** VIEW `followup_queue_legacy` com colunas PT criada para grace period de 30 dias — frontend pode continuar lendo PT durante deploy gradual.
- [ ] **AC6:** Hooks `useFollowupQueue` (e qualquer outro consumer) atualizados para ler nomes EN.
- [ ] **AC7:** Pós-grace period, VIEW `followup_queue_legacy` é dropada em migration de cleanup.
- [ ] **AC8:** Auditoria final via grep confirma zero referências a `.canal`, `.mensagem`, `.scheduled_at` em `src/`.
- [ ] **AC9:** FK `meeting_followup_queue.people_id` (plural inconsistente) renomeada para `person_id` (singular, consistente com `clients_people` PK pattern).

## Escopo

**IN:**
- ADR de convenção de naming
- Migration de rename em `followup_queue`
- VIEW de compat `followup_queue_legacy` (grace period)
- Refactor de `useFollowupQueue` e consumers
- Rename de `meeting_followup_queue.people_id` → `person_id`
- Migration final de drop da VIEW de compat (após 30 dias)
- Auditoria via grep + CI guard

**OUT:**
- Rename de tabelas em si (`followup_queue` continua com nome PT, é só queue genérica)
- Rename de tabelas legadas que vão ser dropadas em FWUP-09
- i18n geral do projeto (escopo separado)

## Contexto Técnico

**Arquivos afetados:**
- `supabase/migrations/` — rename + VIEW + drop futuro
- `docs/smart-memory/decisions/` — ADR de naming
- `docs/smart-memory/project/conventions.md` — atualizar (responsabilidade da Lyra coordenar)
- `src/hooks/useFollowupQueue.ts`
- Outros consumers identificados via grep

**Risco:** **médio** — renames de coluna são operações não-atômicas em produção. VIEW de compat mitiga, mas requer coordenação com deploy frontend para evitar janela de inconsistência.

**Bloqueado por:** FWUP-09 (drop de tabelas mortas remove ruído antes do rename); FWUP-06 (sistema de retry estável antes de mexer em estrutura de queue).

**Coordenação:** envolver Lyra (dev-analyst) para atualizar `conventions.md` em paralelo com o ADR.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results

```
VEREDICTO INICIAL:    FAIL     — AC9 não cumprido (2026-04-27 19:50)
VEREDICTO INTERMEDIÁRIO: CONCERNS — AC9 corrigido via FWUP-11b (2026-04-27 20:30, primeira passada de re-QA)
VEREDICTO FINAL:      ❌ FAIL  — Regressão detectada em re-QA aprofundado (2026-04-27 20:35)
Story: FWUP-11 | Auditor: Axikar

═══════════════════════════════════════════════════════════════
RE-QA FWUP-11/AC9 (2026-04-27 20:35) — VEREDICTO: ❌ FAIL
═══════════════════════════════════════════════════════════════

Issues bloqueantes:

- [CRITICAL] Hook useCallProFollowups consome coluna inexistente:
  Arquivo: src/hooks/useCallProFollowups.ts:210-218
  Após FWUP-11b, meeting_followup_queue.people_id foi renomeada para person_id em prod.
  Mas o hook ainda faz:
    .from('meeting_followup_queue')
    .select(`id, rule_id, meeting_id, people_id, lead_id, ...
             person:clients_people!people_id ( id, name )`)
  Resultado: erro PostgREST 42703 ("column meeting_followup_queue.people_id does not exist")
  garantido assim que CallProFollowupsConfig.tsx:459 montar — queue da UI quebra.
  Também: interface FollowupQueueEntry.people_id (linha 35) desatualizada.
  O que corrigir: trocar people_id → person_id no select e no embed FK
    (`clients_people!person_id`); renomear campo na interface; atualizar QueueRow
    se referenciar entry.people_id.

- [HIGH] process-meeting-followups branch morto pós-FWUP-11b:
  Arquivo: supabase/functions/process-meeting-followups/index.ts:215-228
  Linha 215 seleciona meetings.people_id (correto — meetings ainda usa people_id);
  Linha 219 checa `if (mtg?.person_id)` (sempre falsy — campo nunca existe no objeto).
  Bug pré-existente, mas exposto pelo trabalho de FWUP-11b. Bloqueia o fallback
  "resolve person from meeting" quando o lead_id é nulo.
  O que corrigir: trocar `mtg.person_id` por `mtg.people_id` em 219 e 227, OU
  alias-ear no select (`select('person_id:people_id, lead_id, attendee_emails')`).

Issue não-bloqueante (mantido):

- [LOW] types.ts não regenerado:
  src/integrations/supabase/types.ts:3286,3304,3322,3347-3348 ainda mostra
  people_id em Row/Insert/Update + meeting_followup_queue_people_id_fkey em
  Relationships. Recomendar `supabase gen types typescript --linked --schema public`.

Verificações OK (mantidas de re-QA anterior):
- Migration 20260427100000_fwup11b aplicada em prod (RENAME COLUMN people_id → person_id).
- supabase/functions/process-meeting-followups/index.ts:161,173 usa person_id corretamente.
- src/hooks/useDeletarPessoa.ts:75 usa .eq('person_id', id) corretamente.
- followup_queue (FWUP-11 base) AC2-AC8 todos verificados, useFollowupQueue OK.
- AC9 do FWUP-11 (objetivo do FWUP-11b) cumprido no schema; mas implementação
  cliente do consumer Call Pro NÃO foi sincronizada — re-veredicto reverte para FAIL.

Próximo passo: @dev-data-engineer (ou @dev-dev-alpha — hook é frontend) corrigir
useCallProFollowups.ts e process-meeting-followups/index.ts:215-228 e ressubmeter.
Após correção: novo re-QA antes de @dev-devops push.

Correção aplicada (commit 2f2d3b24):
- Migration 20260427100000_fwup11b_meeting_followup_queue_people_to_person.sql aplicada em prod — RENAME COLUMN people_id TO person_id em meeting_followup_queue.
- supabase/functions/process-meeting-followups/index.ts atualizado — select e cast usam person_id (linhas 161, 173).
- src/hooks/useDeletarPessoa.ts:75 atualizado — .eq('person_id', id) em meeting_followup_queue.
- typecheck passa sem erros (Supabase client .eq() aceita string permissiva).

Aprovado com observações:
- [LOW] src/integrations/supabase/types.ts:3286,3304,3322,3347-3348 ainda mostra people_id em Row/Insert/Update + meeting_followup_queue_people_id_fkey em Relationships. Tipos não foram regenerados após o rename. Não bloqueia compilação (Supabase client .eq(col: string, val) tolera), mas tipagem fica incoerente — futuras edits IDE-driven podem usar autocomplete obsoleto. Recomendar `supabase gen types typescript --linked --schema public` em sprint seguinte.

Verificações pós-FWUP-11b:
- Migration 20260427100000 idempotente em PostgreSQL via RENAME COLUMN.
- Edge function process-meeting-followups (deployada) e useDeletarPessoa (frontend) consistentes com schema novo.
- Nenhuma referência a .eq('people_id', ...) em meeting_followup_queue em src/ ou supabase/functions/.

Verificações originais OK (FWUP-11 base):
- AC2-AC4: followup_queue colunas renomeadas (canal→channel, mensagem→message, pessoa_id→person_id, scheduled_at→scheduled_for).
- AC5: VIEW followup_queue_legacy criada.
- AC6: useFollowupQueue.ts:13,14,16,20,68-78 usa novos nomes EN.
- AC8: zero refs a .canal/.mensagem/.scheduled_at em src/.
- Smoke test inline fail-fast confirma rename.

Próximo passo: @dev-devops push autorizado. Regenerar types.ts em follow-up cosmético.
```

## WAIVER (2026-07-25)

**Decisão:** WAIVED — supersedido por drop do módulo CallPro.

`useCallProFollowups.ts` referenciado no laudo QA foi deletado em `20260609000000_drop_coach_pro_and_call_pro.sql`. O módulo CallPro foi completamente removido — não há consumer da coluna `people_id` no frontend. O fix é inviável e desnecessário.

**Status final:** WAIVED (mesmo padrão de FIX-COACH-01 e FIX-COACH-02)
