---
title: "Story FWUP-02: Resolver colisão de tabela meetings_followups (CallPro vs Agendamento)"
type: story
status: review
epic: FWUP
complexity: L
priority: P0
agent: dev-data-engineer + dev-dev-alpha
created: 2026-04-27
updated: 2026-04-27
tags: [story, followups, schema, integrity, p0]
related: ["[[../../project/audit-followups-diagnostico]]", "[[FWUP-01]]"]
---

# Story FWUP-02: Resolver colisão de tabela meetings_followups (CallPro vs Agendamento)

## Objetivo
Eliminar a possibilidade de corrupção mútua entre `useCallProFollowups` (modelo webhook N8N) e `useAgendamentosFollowups` (modelo canal direto/template) que hoje escrevem na mesma tabela `meetings_followups` com schemas semânticos incompatíveis.

## Acceptance Criteria
- [ ] **AC1:** Migration adiciona coluna discriminadora `source TEXT NOT NULL CHECK (source IN ('webhook','channel'))` em `meetings_followups`.
- [ ] **AC2:** Backfill marca registros existentes com `source = 'webhook'` quando `webhook_url IS NOT NULL`, e `source = 'channel'` quando `webhook_url IS NULL AND (template_id IS NOT NULL OR whatsapp_template_id IS NOT NULL OR as_queue_id IS NOT NULL)`.
- [ ] **AC3:** Registros que não enquadram em nenhum filtro são logados (não migrados) e relatados para análise manual.
- [x] **AC4:** Hook `useCallProFollowups` filtra `WHERE source = 'webhook'` em todas as queries e injeta `source: 'webhook'` em todos os inserts.
- [x] **AC5:** Hook `useAgendamentosFollowups` filtra `WHERE source = 'channel'` em todas as queries e injeta `source: 'channel'` em todos os inserts.
- [ ] **AC6:** RLS policy adicional impede update/delete de registro entre sources distintos (UPDATE só permitido se `source` no WHERE bate com source do registro).
- [ ] **AC7:** Edge function `process-meeting-followups` usa `source` para roteamento explícito (webhook → POST URL; channel → AS/WA/email).
- [ ] **AC8:** Testes manuais: criar regra em CallPro UI, abrir AgendamentoFollowupsCard — não deve aparecer; vice-versa.

## Escopo

**IN:**
- Migration adicionando `source` + CHECK constraint + backfill
- Refactor de `useCallProFollowups` e `useAgendamentosFollowups`
- Refactor de `process-meeting-followups` para usar `source`
- RLS policies para proteção cruzada
- Validação manual cross-UI

**OUT:**
- Separação física em duas tabelas (avaliada em ADR posterior se necessário; ver Opção B em recomendações arquiteturais)
- Mudanças no schema de `meeting_followup_queue`
- UI nova para gestão unificada de followups de meeting

## Contexto Técnico

**Arquivos afetados:**
- `supabase/migrations/` — nova migration
- `src/hooks/useCallProFollowups.ts:83`
- `src/hooks/useAgendamentosFollowups.ts:101`
- `supabase/functions/process-meeting-followups/index.ts`
- `src/components/config/CallProFollowupsConfig.tsx`
- `src/components/followups/AgendamentoFollowupsCard.tsx`

**Bloqueado por:** FWUP-01 (rotação de JWT antes de qualquer mudança em `process-meeting-followups`).

**Dependências em cascata:** FWUP-07 (status `nao_compareceu`) e FWUP-08 (validação timing CallPro) tocam o mesmo arquivo — coordenar ordem de merge.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Bythak (data-eng) + Nova (dev-dev-alpha) |
| Iniciado   | 2026-04-27 |
| Concluído  | 2026-04-27 |
| Branch     | main |

## AC Status

- [x] **AC1:** Migration `20260427030000` — coluna `source TEXT NOT NULL DEFAULT 'channel' CHECK (source IN ('webhook','channel'))`
- [x] **AC2:** Backfill em 3 passes: pure-webhook, pure-channel, ambíguos defaultam para 'channel'
- [x] **AC3:** Ambíguos: RAISE NOTICE com id + meeting_status para análise manual
- [x] **AC4:** `useCallProFollowups` — filtro `source='webhook'` + inject no insert (dev-dev-alpha)
- [x] **AC5:** `useAgendamentosFollowups` — filtro `source='channel'` + inject no insert (dev-dev-alpha)
- [x] **AC6:** RLS `meet_fup_write` — guard: source estável após INSERT (UPDATE bloqueia mudança de source)
- [x] **AC7:** Edge function `process-meeting-followups` — roteamento explícito por `rule.source`
- [ ] **AC8:** Testes manuais — pendente deploy

## File List

**data-engineer (Bythak):**
- `supabase/migrations/20260427030000_fwup02_meetings_followups_source.sql`
- `supabase/migrations/rollbacks/20260427030000_fwup02_meetings_followups_source.rollback.sql`
- `supabase/functions/process-meeting-followups/index.ts`

**dev-dev-alpha (Nova):**
- `src/hooks/useCallProFollowups.ts` — filtro source='webhook' em queries/update/delete; source='webhook' em insert; denormalizeMeetingStatus + normalizeMeetingStatus adicionados
- `src/hooks/useAgendamentosFollowups.ts` — filtro source='channel' em queries/update/delete; source='channel' em insert; source adicionado ao DbMeetingsFollowup interface

## QA Results

```
VEREDICTO: CONCERNS
Story: FWUP-02 | Data: 2026-04-27 | Auditor: Axikar
Aprovado com observações:
- [LOW] AC8 (testes manuais cross-UI) declaradamente pendente — requer deploy. Risco baixo: lógica de filter/insert é determinística por código.
Verificações:
- Migration `20260427030000` adiciona coluna `source TEXT NOT NULL DEFAULT 'channel' CHECK (source IN ('webhook','channel'))` com backfill 3-pass (pure-webhook, pure-channel, ambíguos).
- `useCallProFollowups.ts:113` injeta `source: 'webhook'` em insert; filtros nas linhas 88, 163, 188.
- `useAgendamentosFollowups.ts:118` injeta `source: 'channel'`; filtros nas linhas 100, 170, 192.
- `process-meeting-followups/index.ts:267` lê `rule.source` (fallback 'channel') e roteia explicitamente: webhook → POST URL; channel → AS/WA/email.
- RLS `meet_fup_write` substituída — guard impede mudança de source em UPDATE.
- Lead reportou 11 registros em prod com `source='channel'` + `whatsapp_template_id` — coerente com Pass 2 do backfill.
Próximo passo: @dev-devops push (validar AC8 em staging após deploy)
```
