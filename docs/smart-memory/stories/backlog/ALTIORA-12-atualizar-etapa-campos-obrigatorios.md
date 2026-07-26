---
title: "ALTIORA-12: Atualizar etapa com campos obrigatórios por transição (UC20)"
type: story
status: backlog
epic: ALTIORA-D
complexity: L
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, pipeline, etapa, validacao, fullstack]
related: ["[[ALTIORA-02]]", "[[ALTIORA-08]]", "[[ALTIORA-15]]", "[[ALTIORA-17]]", "[[ALTIORA-18]]"]
---

# ALTIORA-12: Atualizar etapa com campos obrigatórios por transição (UC20)

## Objetivo
Implementar validação de campos obrigatórios ao mover um referral entre etapas do pipeline Altiora, impedindo transições incompletas e registrando cada mudança com origem, destino, autor e data.

## Acceptance Criteria
- [ ] AC1: Ao arrastar ou selecionar nova etapa, se a etapa de destino tiver campos obrigatórios não preenchidos, o sistema exibe um modal/drawer com os campos faltantes antes de confirmar a transição. Transição só ocorre após preenchimento.
- [ ] AC2: Mapa de campos obrigatórios por etapa de destino (configurável via tabela `altiora_stage_requirements` ou JSON em `leads_stages.metadata`): R1 agendada → `link_meet_r1`; R1 realizada → `resultado_r1`; Análise Finvity → `link_finvity`; R2 agendada → `link_meet_r2`; R2 realizada → `resultado_r2`; R3 agendada → `link_meet_r3`; R3 realizada → `resultado_r3`; Em contratação → nenhum; Ganho → `data_emissao` + `valor_premio`.
- [ ] AC3: Salto de etapas (ex: de "Novo referral" direto para "R1 realizada") exibe aviso "Você está pulando etapas" e exige confirmação explícita + campos obrigatórios da etapa de destino preenchidos.
- [ ] AC4: Cada transição de etapa cria registro em `lead_stage_history(lead_id, from_stage_id, to_stage_id, actor_id, changed_at, skip_confirmed)` — migration incluída.
- [ ] AC5: Retorno a etapa anterior (ex: de "R1 realizada" para "R1 agendada") é permitido com confirmação, preserva o histórico anterior e não apaga dados da etapa mais avançada.

## Escopo

**IN:**
- Modal de validação de campos obrigatórios antes de confirmar transição
- Tabela `lead_stage_history` para auditoria (migration)
- Coluna `metadata JSONB` em `leads_stages` para armazenar mapa de campos obrigatórios (ou tabela `altiora_stage_requirements`)
- Atualização do `useUpdateNegocioStage` hook para disparar validação

**OUT:**
- Formulários completos de R1/R2/R3/Finvity (cobertos em ALTIORA-15/16/17/18)
- Configuração dos campos obrigatórios via UI (Admin pode editar o JSON/tabela diretamente no V1)

## Contexto Técnico
- `src/hooks/useUpdateNegocioStage.ts` — interceptar a mutação para validar campos antes do PUT
- `src/components/negocios/KanbanBoard.tsx` → `onStageChange` callback — adicionar gate de validação
- Mapa de campos obrigatórios: armazenar em `leads_stages.metadata = {required_fields: ['link_meet_r1']}` via seed no ALTIORA-01
- `lead_field_values` — verificar se os campos customizados estão preenchidos antes de confirmar

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
