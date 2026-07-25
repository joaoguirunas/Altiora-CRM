-- Rollback for: 20260616000000_business_hours.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- WARNING: DROP TABLE + DROP COLUMN removes business hours config and all
--          business_hours_only / bh_only_last settings on existing followup rules.

BEGIN;

-- 1. Drop business hours table (seed row inside is deleted automatically)
DROP TABLE IF EXISTS public.settings_business_hours CASCADE;

-- 2. Drop business hours columns from meetings_followups
ALTER TABLE public.meetings_followups
  DROP COLUMN IF EXISTS business_hours_only,
  DROP COLUMN IF EXISTS bh_only_last;

-- 3. Drop business hours columns from leads_stages_followups
ALTER TABLE public.leads_stages_followups
  DROP COLUMN IF EXISTS business_hours_only,
  DROP COLUMN IF EXISTS bh_only_last;

-- 4. Drop business hours columns from meeting_followup_queue
ALTER TABLE public.meeting_followup_queue
  DROP COLUMN IF EXISTS held_for_bh;

COMMIT;
