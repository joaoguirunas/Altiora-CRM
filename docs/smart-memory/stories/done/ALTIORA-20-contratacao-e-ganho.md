---
title: "ALTIORA-20: Acompanhar contratação e registrar Ganho (UC28/UC29)"
type: story
status: done
epic: ALTIORA-E
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, contratacao, ganho, frontend]
related: ["[[ALTIORA-18]]", "[[ALTIORA-21]]", "[[ALTIORA-24]]"]
---

# ALTIORA-20: Acompanhar contratação e registrar Ganho (UC28/UC29)

## Objetivo
Permitir ao Closer atualizar manualmente o andamento do processo de contratação e registrar o negócio como Ganho quando a emissão for confirmada.

## Acceptance Criteria
- [x] AC1: Na ficha do referral em etapa "Em contratação" (position ≥ 11), seção "Acompanhamento de Contratação" exibe checklist: Documentos coletados, Exames médicos, Entrevista financeira, Underwriting. Cada item salva individualmente ao ser marcado.
- [x] AC2: Closer pode marcar qualquer item como "Não aplicável" (N/A) — item aparece riscado e não bloqueia o avanço.
- [x] AC3: Botão "Registrar Ganho" aparece após pelo menos 1 item marcado ou N/A. Abre modal com: Data de emissão (required), Valor do prêmio (required), Parceiro emissor (required).
- [x] AC4: Ao confirmar Ganho: status='won', etapa=Ganho, value=valorPremio, interação 'referral_won' inserida.
- [x] AC5: Sem data_emissao → botão "Confirmar Ganho" bloqueado.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `supabase/migrations/20260725240000_altiora_interaction_types_ganho.sql` — adiciona 'referral_won' ao CHECK constraint
- `src/hooks/useAltioraContratacao.ts` — useAltioraContratacao, useSave* hooks, useRegistrarGanho
- `src/components/negocios/AltioraContratacaoSection.tsx` — checklist + modal Registrar Ganho
- `src/pages/NegocioSingle.tsx` — AltioraContratacaoSection após AltioraR3Section

## QA Results
<!-- QA preenche ao revisar -->
