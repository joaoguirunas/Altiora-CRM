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
- [x] AC1: Migration cria `public.meeting_collaborators (id, meeting_id FK meetings ON DELETE CASCADE, user_id FK settings_users ON DELETE CASCADE, role text CHECK IN ('co_host','observer') DEFAULT 'co_host', added_by FK settings_users ON DELETE SET NULL, created_at)` com `UNIQUE (meeting_id, user_id)`.
- [x] AC2: Índice em `meeting_collaborators(meeting_id)` e em `meeting_collaborators(user_id)`.
- [x] AC3 (revisado — ver nota abaixo): RLS habilitada, herdando o estado REAL de `meetings` hoje (`meetings_access_policy`, `USING (true)`), não as policies granulares `users_read_own_meetings`/`users_manage_own_meetings` — essas nunca foram aplicadas em produção (confirmado via `pg_policy`/`pg_proc`). Decisão do Chief registrada em ADR-ALTIORA-01 (seção "Nota de implementação"). TODO explícito no comentário SQL para endurecer junto se/quando `meetings` for endurecida.
- [x] AC4: Migration é idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de recriar) e tem rollback (`supabase/migrations/20260807260000_create_meeting_collaborators.rollback.sql`, ao lado da migration — convenção usada nas migrations mais recentes do projeto, não no subdiretório `rollbacks/`).
- [x] AC5: Comentários SQL (`COMMENT ON TABLE/COLUMN/POLICY`) documentando que `meeting_collaborators` NÃO substitui `meetings.users_id` (organizador único, dono do token OAuth) nem `leads.altiora_closer_id` — é lista de convidados/co-hosts adicionais.

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
| Agente | dev-data-engineer (Bythak) |
| Iniciado | 2026-08-07 |
| Concluído | 2026-08-07 |
| Branch | — (não commitado — aguardando Grav) |

**Bloqueio encontrado e resolvido:** AC3 conforme escrito assumia policies granulares
(`users_read_own_meetings`/`users_manage_own_meetings`) que nunca foram aplicadas em produção — a
policy real de `meetings` é `USING (true)`. Reportado ao Chief antes de implementar; decisão: espelhar
o estado real, com TODO explícito para endurecer junto no futuro. Ver ADR-ALTIORA-01 (nota de
implementação) e `.claude/agent-memory/dev-data-engineer/meeting-collaborators-rls-conflict.md`.

## File List
- `supabase/migrations/20260807260000_create_meeting_collaborators.sql`
- `supabase/migrations/20260807260000_create_meeting_collaborators.rollback.sql`
- `docs/smart-memory/agents/data-engineer/schema.md` (seção `meeting_collaborators` + nota RLS em `meetings`)
- `docs/smart-memory/agents/data-engineer/migrations-log.md` (entrada 20260807260000)
- `docs/smart-memory/decisions/ADR-ALTIORA-01-reunioes-multiplos-colaboradores.md` (nota de implementação)

## QA Results
<!-- QA preenche ao revisar -->
