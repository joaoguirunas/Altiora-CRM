-- Rollback for: 20260725211000_altiora_r2_r3_data.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: ALTIORA-17 (UC26 R2 data) + ALTIORA-18 (UC27 R3 data)
-- WARNING: CASCADE removes all R2/R3 result data. Confirm no production data before applying.
-- NOTE: Migrations 20260725220000_altiora_r2_data and 20260725230000_altiora_r3_data
--       create the same tables via CREATE TABLE IF NOT EXISTS (no-op when applied after this).
--       Rolling back THIS migration drops the tables for all three.

BEGIN;

DROP TABLE IF EXISTS public.altiora_r2_data CASCADE;
DROP TABLE IF EXISTS public.altiora_r3_data CASCADE;

COMMIT;
