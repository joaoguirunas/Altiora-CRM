-- Rollback for: 20260725350000_message_delivery_attempts.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: FIX-SENDS-FIRST-MSG-01 — AC8 + AC9

BEGIN;

-- Revoke grants first (avoids dependency errors)
REVOKE ALL ON public.message_delivery_attempts
  FROM authenticated, service_role;

REVOKE ALL ON SEQUENCE public.message_delivery_attempts_id_seq
  FROM authenticated, service_role;

-- Drop table (CASCADE removes policies, indexes, sequence automatically)
DROP TABLE IF EXISTS public.message_delivery_attempts CASCADE;

COMMIT;
