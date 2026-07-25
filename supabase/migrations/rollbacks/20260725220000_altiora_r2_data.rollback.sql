-- Rollback for: 20260725220000_altiora_r2_data.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- @no-rollback reason: altiora_r2_data was created by 20260725211000_altiora_r2_r3_data
--   via identical CREATE TABLE IF NOT EXISTS — this migration was a no-op when applied
--   after 211000. Dropping the table here would destroy data from 211000.
--   To remove altiora_r2_data, rollback 20260725211000_altiora_r2_r3_data instead.
--
-- This file is intentionally empty (safe no-op rollback).

BEGIN;
-- no-op: see header comment
COMMIT;
