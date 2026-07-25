---
title: "ALTIORA-17: Registrar informações da R2 — produto, objeções e data da R3 (UC26)"
type: story
status: done
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, r2, produto, frontend]
related: ["[[ALTIORA-16]]", "[[ALTIORA-18]]", "[[ALTIORA-14]]"]
---

# ALTIORA-17: Registrar informações da R2 — produto, objeções e data da R3 (UC26)

## Objetivo
Disponibilizar ao Closer o formulário pós-R2 com produto apresentado, objeções levantadas, nível de interesse do cliente e data prevista da R3.

## Acceptance Criteria
- [x] AC1: Na ficha do referral em etapa "R2 realizada" ou posterior, seção "Resultado da R2" exibe: Produto apresentado (select: previdência, seguro de vida, investimentos, proteção patrimonial, combo), Objeções levantadas (textarea), Nível de interesse (select: alto, médio, baixo, sem interesse), Resultado geral (textarea), Data prevista da R3 (date picker — obrigatório quando nível de interesse é alto ou médio).
- [x] AC2: Contexto da R1 (diagnóstico, score, produtos de interesse) é exibido em modo read-only acima do formulário como referência ao Closer.
- [x] AC3: Alerta exibido quando Análise Finvity não foi registrada (ALTIORA-16) — mensagem "Análise Finvity pendente".
- [x] AC4: Ao salvar, persiste campos em `altiora_r2_data` e atualiza `leads.next_action_due_at` com a data da R3 quando informada.
- [x] AC5: Formulário disponível apenas quando referral está na etapa "R2 realizada" (position ≥ 8) — exibe "Preencher após a R2" nas etapas anteriores.

## Escopo

**IN:**
- Seção "Resultado da R2" na ficha do referral
- Exibição do contexto da R1 em read-only
- Alerta de Finvity pendente
- Persistência em `altiora_r2_data` (migration 20260725210000)

**OUT:**
- Formulário de R3 (cobre ALTIORA-18)
- Dados Elephan para R2 (V2 — V1 é totalmente manual)

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `supabase/migrations/20260725210000_altiora_r2_r3_data.sql` — tabelas altiora_r2_data e altiora_r3_data
- `src/hooks/useAltioraR2Data.ts` — useR2Data, useSaveR2Data, useR3Data, useSaveR3Data
- `src/components/negocios/AltioraR2Section.tsx` — seção completa view/edit com AC2 contexto R1, AC3 alerta Finvity, AC5 guard
- `src/pages/NegocioSingle.tsx` — AltioraR2Section adicionado após AltioraR1Section

## QA Results
<!-- QA preenche ao revisar -->
