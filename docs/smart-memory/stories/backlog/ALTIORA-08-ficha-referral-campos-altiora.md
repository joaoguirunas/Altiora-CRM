---
title: "ALTIORA-08: Ficha do referral — campos específicos Altiora (UC04)"
type: story
status: backlog
epic: ALTIORA-C
complexity: L
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, ficha, sidebar, frontend]
related: ["[[ALTIORA-01]]", "[[ALTIORA-03]]", "[[ALTIORA-07]]", "[[ALTIORA-21]]"]
---

# ALTIORA-08: Ficha do referral — campos específicos Altiora (UC04)

## Objetivo
Adaptar a `NegocioSidebar` para exibir a ficha completa do referral Altiora com todas as seções e campos específicos do negócio, respeitando visibilidade por perfil.

## Acceptance Criteria
- [ ] AC1: A sidebar do referral Altiora exibe as seções: **Contato** (nome, e-mail, telefone editáveis), **Origem** (origem referral, data handoff, indicador — read-only após criação), **Responsável** (Closer, data de atribuição), **Etapa atual** (nome da etapa + data de entrada), **Produto** (produto sugerido — editável pelo Closer), **Próxima ação** (tipo, descrição, prazo — editável), **Observações** (textarea rich-text), **Reuniões** (lista resumida com link para ALTIORA-13), **Documentos** (lista de anexos com link para UC30).
- [ ] AC2: Campos sensíveis (valor do prêmio, dados financeiros) são exibidos apenas para perfis Gestor e Admin; Closer vê "—" nesses campos.
- [ ] AC3: Edições inline (campos que permitem edição) disparam `useUpdateNegocio` / `useUpdatePessoa` e persistem no banco — confirmado via toast de sucesso e reload da query.
- [ ] AC4: Ao clicar fora de um campo em edição sem salvar, as alterações são descartadas e o valor original é restaurado (comportamento já existente no componente, não deve regredir).
- [ ] AC5: Referral em etapa "Perdido" ou "Ganho" exibe a sidebar em modo read-only (sem campos editáveis), com banner de status no topo.

## Escopo

**IN:**
- Extensão das abas/seções da `NegocioSidebar` para incluir campos Altiora
- Controle de visibilidade por `user_type` (Closer vs Gestor/Admin)
- Estado read-only para referrals encerrados (Perdido/Ganho)

**OUT:**
- Criação de nova sidebar do zero (reaproveitar `NegocioSidebar`)
- Formulários de R1/R2/R3 e Finvity (cobertos em ALTIORA-15/16/17/18)
- Linha do tempo/histórico (cobre ALTIORA-21)
- Upload de documentos (cobre story separada de UC30)

## Contexto Técnico
- `src/components/negocios/NegocioSidebar.tsx` — estrutura de abas existente (Tabs: cliente, negocios, etc.)
- Campos customizados Altiora em `lead_field_definitions` + `lead_field_values` — usar hooks `useLeadFieldDefinitionsByEntity` / `useLeadFieldValuesByEntity` já presentes na sidebar
- `useAuth.ts` → `profile.user_type` para controle de visibilidade
- Condição "pipeline Altiora": verificar `negocio.pipeline_id === ALTIORA_PIPELINE_ID`

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
