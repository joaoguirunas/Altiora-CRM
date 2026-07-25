---
title: "ALTIORA-07: Atribuir Closer ao referral — automático por e-mail + manual (UC12)"
type: story
status: backlog
epic: ALTIORA-B
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, closer, atribuicao, fullstack]
related: ["[[ALTIORA-05]]", "[[ALTIORA-06]]", "[[ALTIORA-22]]"]
---

# ALTIORA-07: Atribuir Closer ao referral — automático por e-mail + manual (UC12)

## Objetivo
Implementar a atribuição do Closer responsável ao referral, tanto automaticamente (reconhecendo o destinatário no e-mail de handoff) quanto manualmente pelo Gestor Comercial, com registro da origem da decisão e notificação ao Closer atribuído.

## Acceptance Criteria
- [ ] AC1: Quando a edge function `altiora-email-referral-inbound` (ALTIORA-05) identifica um destinatário no campo CC/To que corresponde ao e-mail de um usuário Closer cadastrado no tenant, o referral é criado já com `closer_id` preenchido e etapa "Encaminhado ao comercial".
- [ ] AC2: Na ficha do referral (sidebar), o Gestor Comercial vê campo "Closer responsável" com select de todos os Closers ativos. Ao salvar, `closer_id` é atualizado, a etapa move para "Encaminhado ao comercial" (se ainda em "Novo referral") e um registro é inserido em `lead_interactions` com `type = 'closer_assigned'`, `actor_id` = gestor, `description` = "Atribuído manualmente a {nome_closer}".
- [ ] AC3: O Closer atribuído recebe notificação na aplicação (badge no sino) com texto "Novo referral atribuído a você: {nome_cliente}".
- [ ] AC4: Se o e-mail tiver múltiplos Closers como destinatários ou o destinatário não for reconhecido, o referral fica sem `closer_id` e aparece na lista de pendências do Gestor (sem blocker para criação).
- [ ] AC5: A coluna `closer_id` (FK para `settings_users.id`) existe em `leads` e tem índice para queries do tipo "minha carteira" (ALTIORA-10) — migration incluída nesta story se não coberta pelo ALTIORA-01.

## Escopo

**IN:**
- Campo "Closer responsável" na sidebar (`NegocioSidebar`) — select filtrado por `user_type = 'comercial'`
- Lógica de atribuição automática na edge function ALTIORA-05
- Registro em `lead_interactions` a cada atribuição
- Notificação ao Closer via tabela `notifications`

**OUT:**
- Reatribuição de Closer já atribuído (cobre ALTIORA-22)
- Permissões granulares de quem pode atribuir (usa regra simples: Gestor e Admin)
- Notificação por WhatsApp/e-mail externo (V2)

## Contexto Técnico
- `src/components/negocios/NegocioSidebar.tsx` → seção de responsável existente; verificar `AtribuirTimeResponsavel` component já presente
- `src/hooks/useUsuarios.ts` — para listar Closers (`user_type = 'comercial'`)
- Schema: `leads.closer_id UUID REFERENCES settings_users(id)` — nullable
- Indexar: `CREATE INDEX idx_leads_closer_id ON leads(closer_id)` via migration
- Notificação: inserir em `notifications(tenant_id, user_id, type, payload)` se tabela existir

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | — |
| Branch     | feature/ALTIORA-05-07-13-email-closer-calendar |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
