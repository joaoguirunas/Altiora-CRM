---
title: FWUP — QA Gate Report
type: qa-report
agent: dev-qa
created: 2026-04-27
updated: 2026-04-27
tags: [qa, fwup, gate, report]
related: ["[[../../stories/done/FWUP-01]]", "[[../../stories/done/FWUP-02]]", "[[../../stories/done/FWUP-03]]", "[[../../stories/done/FWUP-04]]", "[[../../stories/done/FWUP-05]]", "[[../../stories/done/FWUP-06]]", "[[../../stories/done/FWUP-07]]", "[[../../stories/done/FWUP-08]]", "[[../../stories/done/FWUP-09]]", "[[../../stories/done/FWUP-10]]", "[[../../stories/done/FWUP-11]]"]
---

# FWUP — QA Gate Report

**Auditor:** Axikar (dev-qa)
**Data:** 2026-04-27 (atualizado 20:30)
**Escopo:** 11 stories do epic FWUP (auditoria + refatoração de followups) + correção FWUP-11b
**Veredicto global:** ⚠️ **CONCERNS** — Pronto para push. AC9 do FWUP-11 (FAIL inicial) foi corrigido via FWUP-11b (commit 2f2d3b24, migration 20260427100000) — re-veredicto FWUP-11 promovido de FAIL → CONCERNS. Restante são validações manuais pendentes documentadas; nenhum bug bloqueante de funcionalidade.

---

## Tabela de Veredictos

| Story | Prioridade | Veredicto | ACs cumpridos | Issues principais |
|---|---|---|---|---|
| FWUP-01 | P0 | ⚠️ CONCERNS | 6/7 + 1 manual | AC1 (revogação JWT no Dashboard) é responsabilidade humana fora do CLI |
| FWUP-02 | P0 | ⚠️ CONCERNS | 7/8 | AC8 (testes manuais cross-UI) declaradamente pendente — requer deploy |
| FWUP-03 | P1 | ✅ PASS | 7/7 (com 03b) | Schema canônico verificado; 17 colunas presentes |
| FWUP-04 | P1 | ⚠️ CONCERNS | 6/7 | AC5 (Storybook/screenshot validando badges) declaradamente pendente |
| FWUP-05 | P1 | ✅ PASS | 7/7 | Callback 3-arg, lookup template_name, payload completo |
| FWUP-06 | P1 | ⚠️ CONCERNS | 6/7 | AC7 (teste manual com N8N down) não executado — requer ambiente |
| FWUP-07 | P1 | ⚠️ CONCERNS | 5/6 | AC5 (teste manual de regra com nao_compareceu) declaradamente pendente |
| FWUP-08 | P1 | ✅ PASS | 7/7 | `\|\| true` removido, toggle imediato + AS queue selector + alert→toast |
| FWUP-09 | P2 | ✅ PASS | 7/7 | 6 tabelas dropadas + 2 phantom fields removidos; zero refs cross-codebase |
| FWUP-10 | P2 | ✅ PASS | 8/8 | businessHours, _selectedTenantId, languageCode, Desativar, RPC reorder |
| FWUP-11 | P2 | ⚠️ CONCERNS¹ | 9/9 | (Inicial: FAIL — AC9 ausente.) Corrigido via FWUP-11b (migration 20260427100000, commit 2f2d3b24). Residual LOW: types.ts não regenerado. |

---

## Detalhes por Story

### FWUP-01 — JWT rotation infra (P0) — ⚠️ CONCERNS

**Verificação:**
- Migration `20260427020000_fwup01_rotate_service_role_jwt.sql` cria `sync_service_role_from_vault()` lendo de `vault.decrypted_secrets`, atualiza `_app_config.service_role_key`, registra audit log e expõe `trigger_fwup01_smoke_test()`.
- Smoke test 5/5 PASS confirmado em produção (story doc:128).
- Todas as referências de cron usam `secure_http_post` (verificado no Check 3 do smoke test).
- AC5 (grep de JWT em migrations): nova migration sem JWT literal — verificado.

**Concern:**
- **AC1 (LOW):** Revogação de JWT antigo via Supabase Dashboard é etapa manual fora do escopo de CLI/API por design de plataforma. Documentado em story:131 e migration:8-9. Risco residual: se operador esqueceu de regenerar o JWT, registros antigos no Git history continuam exploitáveis. **Recomendação:** Confirmar com operador que Passo 1 do checklist (`Settings → API → Regenerate service_role`) foi executado.

**Veredicto:** CONCERNS — pronto para push.

---

### FWUP-02 — source discriminator (P0) — ⚠️ CONCERNS

**Verificação:**
- Migration `20260427030000_fwup02_meetings_followups_source.sql` adiciona coluna `source TEXT NOT NULL DEFAULT 'channel' CHECK (source IN ('webhook','channel'))` com backfill em 3 passes.
- Backfill: pure-webhook (webhook_url + sem channel ids), pure-channel (channel id + sem webhook_url), ambíguos defaultam para 'channel' com RAISE NOTICE.
- RLS `meet_fup_write` substituída — guard impede mudança de source em UPDATE (linhas 100-138).
- `useCallProFollowups.ts:113` injeta `source: 'webhook'` em insert; `useCallProFollowups.ts:88,163,188` filtra `eq('source','webhook')`.
- `useAgendamentosFollowups.ts:118` injeta `source: 'channel'`; filtros nas linhas 100,170,192.
- `process-meeting-followups/index.ts:267` lê `rule.source` com fallback `?? 'channel'`. Roteamento explícito (webhook → POST URL; channel → AS/WA/email) verificado em linhas 263-300, 464.

**Sobre verificação prod (lead nota):**
Lead reportou 11 registros prod com `source='channel'` + `whatsapp_template_id` — confirmado coerente com Pass 2 do backfill (channel id presente, sem webhook_url). Lógica de inserts futuros do CallPro garante `source='webhook'` (linha 113 do hook).

**Concerns:**
- **AC8 (LOW):** Testes manuais cross-UI (criar regra CallPro UI, verificar não aparece em AgendamentoFollowupsCard) marcados pendente. Requer deploy + manual QA.

**Veredicto:** CONCERNS — pronto para push.

---

### FWUP-03 + 03b — schema canônico leads_stages_followups (P1) — ✅ PASS

**Verificação:**
- Migration `20260427040000_fwup03_canonicalize_leads_stages_followups.sql`: adiciona colunas canônicas (leads_stages_id, score_matrix_id, target_stage_id, control), backfill stage_id→leads_stages_id, dropa stage_id/name/delay_minutes.
- Migration `20260427060000_fwup03b_add_missing_canonical_columns.sql`: complementa adicionando type/subject/template_id/audio_file/days/hours/minutes (faltavam pois schema B/C tinha rodado primeiro em prod).
- Smoke tests inline em ambas migrations validam presença das 17 colunas canônicas.
- Hook `useFollowups` continua sem mudanças no payload (canonical = path ativo).

**Veredicto:** PASS — schema canônico verificado em prod.

---

### FWUP-04 — ScoreMatrix migrados (P1) — ⚠️ CONCERNS

**Verificação:**
- `MultiSelectScoreMatrix.tsx:21,39` usa `matrix.resolved_categories ?? []`.
- `ScoreMatrixSelector.tsx:61` usa `matrix.resolved_categories ?? []`.
- Hook `useScoreMatrixLabels.ts` existe.
- Zero referências a `objective_id`/`investment_id`/`framing_id` nos componentes (grep limpo).

**Concern:**
- **AC5 (LOW):** Storybook/screenshot manual validando renderização de badges em matriz com 3 categorias diferentes — declarado pendente (story:24). Sem evidência visual de que badges renderizam corretamente. Risco baixo — refatoração é mecânica e tipos passam.

**Veredicto:** CONCERNS — pronto para push.

---

### FWUP-05 — FollowupModal WA template (P1) — ✅ PASS

**Verificação:**
- `FollowupModal.tsx:477` `onSelect={(id, name, uuid) => upd({ template_id: id, template_name: name, whatsapp_template_id: uuid })}` — captura 3 args.
- `FollowupModal.tsx:46,64,109` FormState inclui `whatsapp_template_id`, default `''`, hydrate de followup.
- `FollowupModal.tsx:147` payload inclui `whatsapp_template_id`.
- `FollowupModal.tsx:101-103` carrega `template_name` via lookup em `whatsappTemplates.find(t => t.id_template === ...)`.
- Migration `20260427050000_fwup05_leads_stages_followups_waid_index.sql` garante FK + índice.

**Veredicto:** PASS — bug original (callback 2-arg) corrigido, persistência funcional.

---

### FWUP-06 — retry-worker (P1) — ⚠️ CONCERNS

**Verificação:**
- Edge function `supabase/functions/followup-retry-worker/index.ts` existe.
- Migration `20260427040000_fwup06_followup_retry_worker_cron.sql` adiciona `retry_count` em `meeting_followup_queue` (idempotente), cria índices `idx_mfq_retry` e `idx_fup_queue_retry`, define `trigger_followup_retry_worker()` usando `secure_http_post` (ADR-SP-05), registra pg_cron `*/10 * * * *`.
- AC1-AC6 cumpridos via código + migration.

**Concern:**
- **AC7 (MEDIUM):** Teste manual com N8N down não foi executado (story:81 reconhece). Risco: lógica de retry não validada end-to-end em ambiente real. **Recomendação:** Executar teste manual ou criar smoke test automatizado simulando timeout. Aceitável dada a complexidade do setup, mas prioridade alta antes de incidente real.

**Veredicto:** CONCERNS — pronto para push, mas teste de campo recomendado em sprint seguinte.

---

### FWUP-07 — nao_compareceu canonicalizado (P1) — ⚠️ CONCERNS

**Verificação:**
- Migration `20260427050000_fwup07_nao_compareceu_cleanup.sql`: backfill de `meetings_followups` com `'não compareceu'` → `'nao_compareceu'`, atualiza trigger `handle_meeting_followup_queue` para normalizar status legado, smoke test fail-fast.
- Grep `'não compareceu'` em src/: zero matches.
- ESLint rule `no-restricted-syntax` ativa em `eslint.config.js:27-31` bloqueando o literal.
- `src/types/meeting.ts` existe — tipo MeetingStatus centralizado.
- Trigger atualizado normaliza both `'agendada'/'agendado'` e `'não compareceu'/'nao_compareceu'/'cancelada'/'cancelado'` para evitar drift de enfileiramento.

**Concern:**
- **AC5 (LOW):** Teste manual de criação+save+reload de regra com status "Não compareceu" pendente (story:77).

**Veredicto:** CONCERNS — pronto para push.

---

### FWUP-08 — timing validation + AS queue (P1) — ✅ PASS

**Verificação:**
- `CallProFollowupsConfig.tsx`: zero ocorrências de `|| true` (grep limpo). Toggle "Disparo imediato" presente em linha 199.
- `FollowupModal.tsx`: zero ocorrências de "via N8N" / `alert(`. Selector AS queue em linhas 340-341. Validação `as_queue_id` em linha 135 (`form.canal === 'ligacao' && !form.as_queue_id`).
- `AgendamentoFollowupModal.tsx`: zero `alert(` — substituído por `toast.error()`.
- Migration `20260427060000_fwup08_leads_stages_followups_as_queue.sql` adiciona FK opcional + índice parcial.
- `useFollowups.ts` inclui `as_queue_id` em payload.

**Veredicto:** PASS — todas as ACs verificadas em código.

---

### FWUP-09 — dead tables drop (P2) — ✅ PASS

**Verificação:**
- Migration `20260427070000_fwup09_drop_dead_tables.sql`: `DROP TABLE IF EXISTS CASCADE` para 6 tabelas + `ALTER TABLE leads DROP COLUMN` para `followup_attempts`/`followup_status` + smoke test inline.
- Grep cross-codebase (src/ + supabase/functions/): zero referências a `crm_pipelines|crm_stages|crm_stage_followups|crm_agendamentos_followups|clients_meetings_followups|crm_campos_personalizados`.
- `types.ts` regenerada — sem `followup_attempts`/`followup_status` em leads.
- Story doc com Dev Agent Record vazio (cosmético; código está implementado).

**Veredicto:** PASS — sem regressões, smoke test cobre verificação.

---

### FWUP-10 — UI fixes (P2) — ✅ PASS

**Verificação:**
- AC1 (`businessHours.enabled`): removido — flag não aparece no estado (`EmailMegaConfig.tsx:27` mostra apenas timezone/start/end).
- AC2 (`_selectedTenantId`): renomeado em `PipelinesConfig.tsx:188` (intencional — sinaliza não-uso preservando interface contract).
- AC3 (`description: null`): removido do create payload em SendsPro (não aparece em grep).
- AC4 (compat-shims): documentados em `AgendamentoFollowupsCard.tsx`.
- AC5 (`languageCode`): `WhatsappTemplatePickerModal.tsx:128` usa `template.json_data?.languageCode` (não `language`).
- AC6 ("Desativar"): `StagesConfig.tsx:79,336` mostra "Desativar etapa (pode ser reativada)".
- AC7 (RPC reorder): migration `20260427090000_fwup10_reorder_stages_rpc.sql` existe.
- AC8 (`audio_file`): documentado como placeholder.

**Veredicto:** PASS — 8/8 ACs verificados.

---

### FWUP-11 — followup_queue rename (P2) — ⚠️ CONCERNS (após FWUP-11b)

**Verificação:**
- Migration `20260427080000_fwup11_followup_queue_pt_to_en.sql`: renomeia `canal→channel`, `mensagem→message`, `pessoa_id→person_id`, `scheduled_at→scheduled_for` em `followup_queue`. Cria VIEW `followup_queue_legacy` (grace period 30d). Recria índices.
- AC2-AC5, AC8 ✅ — verificados em code + migration.
- AC6 ✅ — `useFollowupQueue.ts:13,14,16,20,68-78` usa novos nomes EN.
- VIEW `followup_queue_legacy` criada (linhas 31-53 da migration).

**Histórico AC9:**
- **Veredicto inicial (19:50):** FAIL — Rename de `meeting_followup_queue.people_id` → `person_id` ausente da migration original.
- **Correção aplicada (20:30):** FWUP-11b — migration `20260427100000_fwup11b_meeting_followup_queue_people_to_person.sql` aplicada em prod via `RENAME COLUMN people_id TO person_id`. Edge function `process-meeting-followups/index.ts` (linhas 161, 173) e `useDeletarPessoa.ts:75` atualizados para usar `person_id`. Commit `2f2d3b24`. Typecheck passa sem erros.

**Concern residual:**
- **[LOW] types.ts não regenerado:** `src/integrations/supabase/types.ts:3286,3304,3322,3347-3348` ainda mostra `people_id` em Row/Insert/Update + `meeting_followup_queue_people_id_fkey` em Relationships. Não bloqueia compilação (Supabase client `.eq(col: string, val)` é permissivo), mas autocomplete IDE-driven fica obsoleto. Recomendar `supabase gen types typescript --linked --schema public` em sprint seguinte.

**Veredicto:** CONCERNS — AC9 cumprido. Push autorizado.

---

## Veredicto Global

⚠️ **CONCERNS** com 1 ❌ FAIL pontual em FWUP-11 (AC9).

**Resumo (após FWUP-11b):**
- 5 stories ✅ PASS (FWUP-03, 05, 08, 09, 10)
- 6 stories ⚠️ CONCERNS (FWUP-01, 02, 04, 06, 07, 11) — todas por validações manuais documentadas como pendentes ou cosmético (types.ts), nenhuma por bug de código
- 0 stories ❌ FAIL

**Nenhum bug bloqueante de funcionalidade detectado.** Migrations idempotentes, smoke tests passando, código frontend consistente com schema novo, segurança (FWUP-01/02) implementada com defensa em depth.

**Recomendações para sprint seguinte:**
1. Executar testes manuais pendentes em ambiente de staging:
   - FWUP-02/AC8: cross-UI CallPro vs Agendamento
   - FWUP-04/AC5: screenshot de badges com 3 categorias
   - FWUP-06/AC7: simular N8N down e validar retry path end-to-end
   - FWUP-07/AC5: criar regra com `nao_compareceu`, salvar, recarregar
2. Confirmar AC1 do FWUP-01 (revogação manual do JWT antigo no Supabase Dashboard).
3. Regenerar `src/integrations/supabase/types.ts` via `supabase gen types typescript --linked --schema public` para refletir rename FWUP-11b (concern LOW).

**Push autorizado** para todas as 11 stories. Epic FWUP encerrado com sucesso.
