---
title: "ALTIORA-01: DB — Schema base do pipeline Altiora"
type: story
status: backlog
epic: ALTIORA-A
complexity: L
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, schema, pipeline, data-engineer]
related: ["[[ALTIORA-02]]", "[[ALTIORA-05]]", "[[ALTIORA-23]]"]
---

# ALTIORA-01: DB — Schema base do pipeline Altiora

## Objetivo
Criar a estrutura de dados necessária para o pipeline Altiora: seed das 13 etapas, motivos de perda específicos, campos customizados do referral e coluna `closer_id` em `leads`.

## Acceptance Criteria
- [ ] AC1: Pipeline "Altiora Referrals" criado na tabela `leads_pipelines` com `active = true` e as 13 etapas (Novo referral → Encaminhado ao comercial → Contato iniciado → R1 agendada → R1 realizada → Análise Finvity → R2 agendada → R2 realizada → R3 agendada → R3 realizada/fechamento → Em contratação → Ganho → Perdido) com `position` correto em `leads_stages`.
- [ ] AC2: Motivos de perda Altiora inseridos em `leads_loss_reasons` (mínimo 6 opções: sem interesse, indisponibilidade financeira, sem perfil Finvity, concorrente, sem retorno, outro).
- [ ] AC3: Campos customizados criados em `lead_field_definitions` para o pipeline Altiora: `origem_referral` (select), `data_handoff` (date), `produto_sugerido` (text), `link_finvity` (url), `link_meet_r1` / `link_meet_r2` / `link_meet_r3` (url), `resultado_r1` (text), `resultado_r2` (text), `resultado_r3` (text), `data_emissao` (date), `valor_premio` (numeric), `parceiro_emissor` (text).
- [ ] AC4: Migration versionada aplicável sem erros em ambiente local (`supabase db reset` não quebra) e com rollback documentado.
- [ ] AC5: Nenhuma tabela existente é alterada de forma incompatível — apenas INSERTs e novas colunas nullable.

## Escopo

**IN:**
- Seed do pipeline e das 13 etapas Altiora em `leads_pipelines` / `leads_stages`
- Seed dos motivos de perda Altiora em `leads_loss_reasons`
- Campos customizados em `lead_field_definitions` (entity = `lead`, pipeline_id referenciando o Altiora)
- Migration com arquivo `YYYYMMDD_altiora_base_schema.sql` em `supabase/migrations/`

**OUT:**
- Alterações em tabelas RLS existentes (cobre ALTIORA-23)
- Criação de novas tabelas — reaproveitar infra existente
- Configuração de usuários (cobre ALTIORA-23)
- Webhook/edge functions

## Contexto Técnico
- Tabelas principais: `leads_pipelines`, `leads_stages`, `leads_loss_reasons`, `lead_field_definitions`
- Hook existente: `usePipelines.ts` / `usePipelinesReal.ts` — reaproveitar para leitura das etapas
- Tenant Altiora: obter `tenant_id` via `supabase.auth.getUser()` no contexto do seed
- Migration deve seguir padrão `YYYYMMDDHHMMSS_descricao.sql` já adotado no projeto
- Consultar `20260716140000_leads_rls_pipeline_access.sql` para entender RLS atual em `leads`

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
