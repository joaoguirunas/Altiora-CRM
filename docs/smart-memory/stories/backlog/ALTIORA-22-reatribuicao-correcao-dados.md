---
title: "ALTIORA-22: Reatribuição de Closer e correção de dados pelo Gestor/Admin (UC08/UC13)"
type: story
status: backlog
epic: ALTIORA-E
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, reatribuicao, correcao, frontend]
related: ["[[ALTIORA-07]]", "[[ALTIORA-08]]", "[[ALTIORA-21]]"]
---

# ALTIORA-22: Reatribuição de Closer e correção de dados pelo Gestor/Admin (UC08/UC13)

## Objetivo
Permitir ao Gestor Comercial e Admin reatribuir o Closer de um referral com preservação do histórico anterior, e corrigir dados críticos com registro de antes/depois e motivo da correção.

## Acceptance Criteria
- [ ] AC1: Na ficha do referral, Gestor/Admin vê botão "Alterar responsável" ao lado do campo Closer. Ao clicar, abre modal com: Closer atual (read-only), Novo Closer (select de Closers ativos), Motivo da troca (select: redistribuição, erro de atribuição, ausência do Closer, pedido do cliente). Ao confirmar, atualiza `leads.closer_id`, move etapa para "Encaminhado ao comercial" (se ainda em "Novo referral") e notifica ambos os Closers.
- [ ] AC2: Histórico preservado: `lead_interactions` recebe registro `type = 'closer_reassigned'` com `metadata = {from_closer_id, to_closer_id, motivo, atividades_transferidas: boolean}`.
- [ ] AC3: Opção "Manter atividades com o responsável anterior": se marcada, as reuniões futuras agendadas (de ALTIORA-13) **não** são transferidas ao novo Closer — exibido como toggle no modal de reatribuição.
- [ ] AC4: Admin pode corrigir dados críticos (origem, data handoff, produto sugerido, valor do prêmio) com modal de confirmação exigindo motivo textual; salva via `lead_field_values` com campo `corrected_by` e `correction_reason`.
- [ ] AC5: Correção com conflito de integridade (ex: tentar setar `closer_id` de usuário inativo) é bloqueada com mensagem de erro específica.

## Escopo

**IN:**
- Modal "Alterar responsável" com campos de reatribuição
- Registro de reatribuição em `lead_interactions`
- Opção de transferir/manter atividades anteriores
- Modal de correção de dados críticos para Admin com campo de motivo

**OUT:**
- Mesclagem de referrals duplicados (FA-01 do UC08 — V2)
- Auditoria de todas as alterações de campo (cobre ALTIORA-21 para campos críticos)

## Contexto Técnico
- `NegocioSidebar` — seção de responsável; adicionar botão "Alterar responsável" visível apenas para `user_type = 'gestor' || 'admin'`
- `useUsuarios` — listar Closers ativos para o select
- Notificação ao Closer anterior e novo: inserir em `notifications` para ambos
- `lead_field_values` — adicionar colunas `corrected_by UUID` e `correction_reason TEXT` (nullable) via migration para rastrear correções

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
