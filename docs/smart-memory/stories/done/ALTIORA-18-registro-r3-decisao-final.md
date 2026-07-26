---
title: "ALTIORA-18: Registrar R3 e decisão final — avançar ou encerrar (UC27)"
type: story
status: done
epic: ALTIORA-D
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, r3, fechamento, frontend]
related: ["[[ALTIORA-17]]", "[[ALTIORA-19]]", "[[ALTIORA-20]]"]
---

# ALTIORA-18: Registrar R3 e decisão final — avançar ou encerrar (UC27)

## Objetivo
Permitir ao Closer registrar o resultado da R3 com estrutura confirmada e levar o referral para "Em contratação" (se avançar) ou iniciar o fluxo de encerramento como Perdido (se não avançar).

## Acceptance Criteria
- [x] AC1: Na ficha do referral em etapa "R3 realizada/fechamento" ou posterior (position ≥ 10), seção "Resultado da R3" exibe: Estrutura confirmada (select), Valor estimado (numeric), Comparecimento (switch), Resultado geral (textarea, obrigatório), Decisão do cliente (select).
- [x] AC2: Ao selecionar "Avançar para contratação" e salvar, o referral move automaticamente para a etapa "Em contratação" via `handleStageClick(STAGE_EM_CONTRATACAO)`.
- [x] AC3: Ao selecionar "Não avançar", o sistema abre MotivoPerdasModal via callback `onNaoAvancar`.
- [x] AC4: "Continuar negociação" salva o resultado e abre ProximaAcaoModal via callback `onContinuarNegociacao`.
- [x] AC5: Campos obrigatórios (resultado geral, decisão) bloqueiam o botão Salvar quando vazios.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `supabase/migrations/20260725210000_altiora_r2_r3_data.sql` — tabela altiora_r3_data (compartilhado com ALTIORA-17)
- `src/hooks/useAltioraR2Data.ts` — useR3Data, useSaveR3Data (compartilhado com ALTIORA-17)
- `src/components/negocios/AltioraR3Section.tsx` — seção completa view/edit com AC2/AC3/AC4 callbacks
- `src/pages/NegocioSingle.tsx` — AltioraR3Section com onAvancarContratacao/onNaoAvancar/onContinuarNegociacao

## QA Results
<!-- QA preenche ao revisar -->
