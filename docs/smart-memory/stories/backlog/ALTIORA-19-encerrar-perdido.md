---
title: "ALTIORA-19: Encerrar referral como Perdido — motivo obrigatório e reabertura (UC16)"
type: story
status: backlog
epic: ALTIORA-E
complexity: S
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, perdido, encerramento, frontend]
related: ["[[ALTIORA-18]]", "[[ALTIORA-01]]", "[[ALTIORA-21]]"]
---

# ALTIORA-19: Encerrar referral como Perdido — motivo obrigatório e reabertura (UC16)

## Objetivo
Adaptar o fluxo de encerramento de referral como Perdido para o contexto Altiora, exigindo motivo obrigatório da lista Altiora, registrando a etapa em que ocorreu a perda e possibilitando reabertura pelo Gestor.

## Acceptance Criteria
- [ ] AC1: Botão "Encerrar como Perdido" (disponível para Closer e Gestor) abre modal com: Lista fechada de motivos Altiora (select — obrigatório), Possibilidade de retomada futura (toggle sim/não), Observações adicionais (textarea — opcional). Sem motivo selecionado, botão "Confirmar" fica desabilitado.
- [ ] AC2: Ao confirmar, referral move para etapa "Perdido" e `leads.status = 'lost'`; registra em `lead_interactions`: `type = 'referral_lost'`, `actor_id` = usuário, `metadata = {motivo_id, etapa_anterior, possibilidade_retomada}`.
- [ ] AC3: Motivos disponíveis no modal são os cadastrados no ALTIORA-01 (seeds em `leads_loss_reasons`) — não hardcoded no frontend.
- [ ] AC4: Gestor Comercial pode "Reabrir referral": seleciona etapa de retorno (select das etapas ativas) e define próxima ação; sistema move o referral de volta e registra o encerramento anterior preservado no histórico.
- [ ] AC5: Referral em status "Perdido" exibe banner vermelho na ficha com motivo e data do encerramento. Closer não pode editar campos do referral encerrado.

## Escopo

**IN:**
- Modal de encerramento como Perdido adaptado para motivos Altiora
- Registro da etapa anterior no `lead_interactions`
- Funcionalidade de Reabertura pelo Gestor
- Banner de status na ficha

**OUT:**
- Criação de novos motivos de perda via UI (Admin edita seeds diretamente no V1)
- Relatórios de motivos de perda (cobre ALTIORA-24)

## Contexto Técnico
- `src/components/negocios/MotivoPerdasModal.tsx` — modal existente de motivos de perda; adaptar para usar motivos do ALTIORA-01
- `src/hooks/useNegocios.ts` → `useUpdateNegocio` — já suporta `status = 'lost'` e `leads_loss_reasons_id`
- `StageColumn.tsx` — botão "Encerrar como perdido" já existe no menu de contexto do card; verificar se dispara `MotivoPerdasModal`
- Campo adicional: `lost_at_stage_id` em `leads` — nullable, registra a etapa em que ocorreu a perda

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
<!-- QA preenche ao revisar -->
