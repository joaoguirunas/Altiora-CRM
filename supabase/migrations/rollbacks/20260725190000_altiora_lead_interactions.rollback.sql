-- Rollback for: 20260725190000_altiora_lead_interactions.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: UC12 (ALTIORA-07), UC21 (ALTIORA-13)
-- WARNING: CASCADE removes all interaction rows. Confirm no production data before applying.
-- NOTE: 20260725201000 and 20260725240000 also modify the CHECK constraint on this table.
--       Apply their rollbacks FIRST before this one.

BEGIN;

DROP TABLE IF EXISTS public.altiora_lead_interactions CASCADE;

COMMIT;
