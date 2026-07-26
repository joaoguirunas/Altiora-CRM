---
title: "ALTIORA-22: Reatribuição de Closer e correção de dados pelo Gestor/Admin (UC08/UC13)"
type: story
status: done
epic: ALTIORA-E
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, reatribuicao, correcao, frontend]
related: ["[[ALTIORA-07]]", "[[ALTIORA-08]]", "[[ALTIORA-21]]"]
---

# ALTIORA-22: Reatribuição de Closer e correção de dados pelo Gestor/Admin (UC08/UC13)

## Acceptance Criteria
- [x] AC1: Botão "Alterar responsável" visível para Gestor/Admin na seção Responsável do NegocioSidebar. Modal com: Closer atual (read-only), Novo Closer (select de ativos), Motivo (select).
- [x] AC2: Registra interaction closer_reassigned com from/to closer IDs, motivo, atividades_transferidas.
- [x] AC3: Toggle "Manter reuniões com responsável anterior" — flag salva no payload da interação.
- [x] AC4: useCorrigirCampo — atualiza campo crítico e registra manual_action no histórico.
- [x] AC5: Valida que o novo Closer está ativo antes de salvar; bloqueia com mensagem de erro.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Serak (dev-dev-gamma) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/04-terminologia-referral |

## File List
- `src/hooks/useAltioraReatribuicao.ts` — useReatribuirCloser, useCorrigirCampo, MOTIVOS_REATRIBUICAO, CAMPOS_CORRIGIVEIS
- `src/components/negocios/AltioraReatribuirModal.tsx` — modal AC1-AC3 (select closer, motivo, toggle manter atividades)
- `src/components/negocios/AltioraCorrigirDadosModal.tsx` — modal AC4 Admin (select campo, novo valor, motivo obrigatório)
- `src/components/negocios/NegocioSidebar.tsx` — botão "Alterar responsável" (Manager) + botão "Corrigir dados" (Admin) + ambos modais wired
- `src/pages/NegocioSingle.tsx` — passa isAdmin={isAdmin} via useUserPermissions para NegocioSidebar

## QA Results
<!-- QA preenche ao revisar -->
