---
title: "ALTIORA-25: Alertas — referrals parados ou sem próxima ação (UC15)"
type: story
status: backlog
epic: ALTIORA-F
complexity: M
agent: dev-architect
created: 2026-07-25
updated: 2026-07-25
tags: [story, altiora, alertas, pendencias, frontend]
related: ["[[ALTIORA-03]]", "[[ALTIORA-10]]", "[[ALTIORA-11]]", "[[ALTIORA-24]]"]
---

# ALTIORA-25: Alertas — referrals parados ou sem próxima ação (UC15)

## Objetivo
Disponibilizar ao Gestor Comercial uma visão de pendências críticas: referrals sem Closer atribuído, sem próxima ação definida ou parados por mais de N dias sem atividade — com ações rápidas para resolver cada pendência.

## Acceptance Criteria
- [ ] AC1: Tab ou seção "Pendências" no pipeline Altiora (visível apenas para Gestor/Admin) lista referrals em 3 categorias: "Sem Closer" (closer_id null), "Sem próxima ação" (next_action_due_at null E etapa não-terminal), "Parados" (última atividade em `lead_interactions` > N dias sem atividade — N configurável em Settings, default 3 dias para etapas iniciais e 7 para etapas avançadas).
- [ ] AC2: Cada item da lista exibe: nome do cliente, etapa atual, tempo parado, Closer atual (se houver), e botões de ação rápida: "Atribuir Closer" (abre modal ALTIORA-07), "Definir ação" (abre modal ALTIORA-11), "Ver ficha".
- [ ] AC3: Pendência já resolvida (ex: Closer atribuído em outra sessão) desaparece da lista sem necessidade de reload manual — query invalidada via Realtime ou polling de 30s.
- [ ] AC4: Badge com contador de pendências é exibido no ícone/tab do pipeline Altiora na navegação quando há pendências abertas.
- [ ] AC5: Configuração do limite de dias "sem atividade" está disponível para Admin em Settings (campo numérico simples) sem necessidade de deploy.

## Escopo

**IN:**
- Tab "Pendências" no pipeline Altiora para Gestor/Admin
- Query de referrals sem Closer, sem próxima ação e parados por N dias
- Ações rápidas inline (atribuir Closer, definir ação)
- Badge de contador de pendências na navegação
- Configuração do limite de dias em Settings

**OUT:**
- Notificações por e-mail/WhatsApp ao Gestor (V2)
- SLA formal — usar "tempo decorrido" sem classificar cumprimento
- Configuração de limites por etapa (V1 usa N dias global)

## Contexto Técnico
- Query de "referrals parados": `leads WHERE leads_pipelines_id = ALTIORA_PIPELINE_ID AND status NOT IN ('lost','won') AND (SELECT MAX(created_at) FROM lead_interactions WHERE lead_id = leads.id) < NOW() - INTERVAL '{N} days'`
- Configuração de N dias: armazenar em tabela `pipeline_settings(pipeline_id, key, value)` ou `leads_pipelines.metadata JSONB`
- Badge de contador: usar React Query `useQuery` com `select: data => data.length` para exibir no menu
- Realtime: `supabase.channel('altiora-leads').on('postgres_changes', ...)` para invalidar a query de pendências

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
