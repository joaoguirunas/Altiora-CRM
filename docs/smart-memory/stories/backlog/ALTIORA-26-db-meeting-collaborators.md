---
title: "ALTIORA-26: DB — tabela meeting_collaborators (colaboradores extra em reunião)"
type: story
status: active
epic: ALTIORA-D
complexity: S
agent: dev-architect
created: 2026-08-07
updated: 2026-08-07
tags: [story, altiora, reuniao, db, colaboradores]
related: ["[[../../decisions/ADR-ALTIORA-01-reunioes-multiplos-colaboradores]]", "[[ALTIORA-27-modal-multi-colaboradores]]"]
---

# ALTIORA-26: DB — tabela meeting_collaborators

## Objetivo
Criar a tabela de junção que permite associar 1+ colaboradores adicionais a uma reunião específica, sem alterar `leads.altiora_closer_id` nem `meetings.users_id`.

## Acceptance Criteria
- [ ] AC1: Migration cria `public.meeting_collaborators (id, meeting_id FK meetings ON DELETE CASCADE, user_id FK settings_users ON DELETE CASCADE, role text CHECK IN ('co_host','observer') DEFAULT 'co_host', added_by FK settings_users ON DELETE SET NULL, created_at)` com `UNIQUE (meeting_id, user_id)`.
- [ ] AC2: Índice em `meeting_collaborators(meeting_id)` e em `meeting_collaborators(user_id)`.
- [ ] AC3: RLS habilitada: SELECT permitido a quem já pode ler a `meeting` pai (reutilizar mesma condição de `users_read_own_meetings`, via EXISTS em `meetings`); INSERT/UPDATE/DELETE permitido a quem pode gerenciar a `meeting` pai (mesma condição de `users_manage_own_meetings`) — não criar regra de posse nova, herdar da reunião.
- [ ] AC4: Migration é idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) e tem rollback em `supabase/migrations/rollbacks/`.
- [ ] AC5: Comentários SQL (`COMMENT ON TABLE/COLUMN`) documentando que `meeting_collaborators` NÃO substitui `meetings.users_id` (organizador único, dono do token OAuth) — é lista de convidados/co-hosts adicionais.

## Escopo

**IN:**
- Tabela `meeting_collaborators` + RLS + índices + rollback
- Nenhuma mudança em `meetings`, `leads`, `settings_users`

**OUT:**
- UI de seleção (ALTIORA-27)
- Integração com edge functions de calendário (ALTIORA-28)
- Verificação de conflito de agenda para colaboradores (fora de escopo desta wave — ver ADR-ALTIORA-01, seção Consequências)

## Contexto Técnico
- Referência de padrão RLS herdada de reunião pai: `supabase/migrations/20260716150000_meetings_rls_pipeline_access.sql` (`users_manage_own_meetings`, `users_read_own_meetings`).
- Ver ADR-ALTIORA-01 para o modelo completo e razão da escolha (Opção B — tabela de junção vs jsonb/array).
- `settings_users` é a tabela de usuários internos (Closers/Gestores) — mesma referenciada por `meetings.users_id` e `meetings.altiora_created_by`.

## Dev Agent Record
| Campo | Valor |
|---|---|
| Agente | — |
| Iniciado | — |
| Concluído | — |
| Branch | — |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
