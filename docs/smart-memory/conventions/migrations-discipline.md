---
title: Migration Discipline
type: convention
agent: dev-data-engineer
created: 2026-04-24
updated: 2026-04-24
tags: [migrations, lint, discipline, ci]
related: ["[[../project/conventions]]", "[[REL-04]]"]
---

# Migration Discipline

## Rules (enforced by lint-migrations.js)

| Code | Rule | Severity |
|---|---|---|
| MIG001 | Filename must start with 14-digit timestamp (`YYYYMMDDHHMMSS_`) | Error |
| MIG002 | `CREATE TABLE` must use `IF NOT EXISTS` | Error |
| MIG003 | `CREATE INDEX` must use `IF NOT EXISTS` | Error |
| MIG004 | `ADD COLUMN` must use `IF NOT EXISTS` | Error |
| MIG005 | `DROP TABLE` requires `-- @allow-destructive reason: ...` header | Error |
| MIG006 | Rollback file must exist (same dir or `supabase/migrations/rollbacks/`) | Error |
| MIG007 | File > 500 lines — consider splitting | Warning |
| MIG008 | `CREATE FUNCTION` should use `OR REPLACE` | Warning |

## Rollback conventions

- Path: `supabase/migrations/rollbacks/{ts}_{name}.rollback.sql` or sibling file `{ts}_{name}.rollback.sql`
- Header: `-- Rollback for: {original_filename}` + `-- Tested-against: {pg_version}`
- Use `IF EXISTS` / `DROP ... CASCADE` in rollbacks — never fail on double-apply

## Skip directives (file header only)

```sql
-- @lint-skip MIG002 reason: legacy table, IF NOT EXISTS breaks pg11 compat
-- @no-rollback reason: data seed only, rollback is truncate (too destructive)
-- @allow-destructive reason: removing legacy table after confirmed zero rows
```

## Running locally

```bash
# lint all migrations
node scripts/lint-migrations.js --all

# lint changed files vs main (CI mode)
node scripts/lint-migrations.js --changed-only

# lint a specific file
node scripts/lint-migrations.js supabase/migrations/20260424012000_adm_releases.sql
```

## Templates

- New migration: `supabase/migrations/_TEMPLATE.sql`
- Rollback: `supabase/migrations/rollbacks/_TEMPLATE.rollback.sql`

## CI integration

Handled by devops — see `.github/workflows/lint-migrations.yml`.
