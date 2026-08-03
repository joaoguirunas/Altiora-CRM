---
title: "SD-02: Migration consolidada — adicionar todas as colunas faltantes"
type: story
status: done
epic: SD
complexity: M
agent: dev-data-engineer
created: 2026-07-26
updated: 2026-07-26
completed: 2026-07-26
tags: [story, database, migration, schema]
related: [SD-01-schema-drift-audit]
---

# SD-02: Migration consolidada — adicionar todas as colunas faltantes

## Objetivo
Com base no gap report da SD-01, gerar e aplicar uma única migration `20260726210000_schema_drift_fix.sql` que adiciona todas as colunas faltantes em todas as tabelas afetadas.

## Acceptance Criteria
- [ ] AC1: Migration usa `ADD COLUMN IF NOT EXISTS` em todo lugar (safe to re-run)
- [ ] AC2: Cobre TODAS as colunas identificadas na SD-01, não apenas `meetings`
- [ ] AC3: Migration aplicada via `supabase db push --project-ref dtsmbqrzyxhjjjvpjfjd`
- [ ] AC4: Smoke test: query `SELECT` pelas colunas novas retorna sem erro
- [ ] AC5: Migration `20260726200000_meetings_missing_columns.sql` (já criada) é absorvida ou aplicada primeiro

## Escopo

**IN:**
- Criar `supabase/migrations/20260726210000_schema_drift_fix.sql`
- Aplicar via Supabase CLI

**OUT:**
- Código-fonte (não editar hooks — isso é responsabilidade do dev-dev-gamma)
- RLS policies (não alterar)

## Contexto Técnico
`meetings` table schema real (da migration original `20251005205003`):
- `id`, `created_at`, `updated_at`, `leads_id` (uuid FK), `users_id` (uuid FK), 
- `start_time` (timestamptz), `end_time` (timestamptz), `status`, `location`, `notes`, 
- `google_meet_link`, `google_event_id`, `source`, `attendees` (jsonb), `quantity`,
- `google_last_synced_at`, `gcal_sync_error`, `calendar_id`, `ms_meeting_id`
- FALTAM: `title`, `people_id`, `meeting_link`, `description`

Colunas já corrigidas no código: `leads_id` (não `lead_id`), `users_id` (não `user_id`), `google_meet_link` (não `meeting_link`).
A migration pendente `20260726200000` precisa ser aplicada primeiro ou ser incorporada.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-data-engineer |
| Iniciado   | 2026-07-26 |
| Concluído  | — |
| Output     | Migration aplicada + smoke test OK |
