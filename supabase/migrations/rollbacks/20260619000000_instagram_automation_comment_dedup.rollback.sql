-- Rollback for: 20260619000000_instagram_automation_comment_dedup.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Removes the unique index added for Instagram comment deduplication.
-- WARNING: Removing this index re-enables duplicate execution of automation
--          rules for the same ig_message_id comment.

BEGIN;

DROP INDEX IF EXISTS public.instagram_automation_log_comment_claim_idx;

COMMIT;
