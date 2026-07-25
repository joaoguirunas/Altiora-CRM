-- Rollback for: 20260610000001_seed_default_loss_reasons.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- LOSS-01 — removes the 5 default loss reasons seeded with fixed UUIDs.
-- WARNING: If users have created custom loss reasons or referenced these IDs
--          in leads.loss_reason_id, adjust accordingly before deleting.

BEGIN;

DELETE FROM public.leads_loss_reasons
WHERE id IN (
  'a1b2c3d4-0001-0000-0000-000000000001',
  'a1b2c3d4-0001-0000-0000-000000000002',
  'a1b2c3d4-0001-0000-0000-000000000003',
  'a1b2c3d4-0001-0000-0000-000000000004',
  'a1b2c3d4-0001-0000-0000-000000000005'
);

COMMIT;
