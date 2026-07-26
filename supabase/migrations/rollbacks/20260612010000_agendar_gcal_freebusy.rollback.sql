-- Rollback for: 20260612010000_agendar_gcal_freebusy.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- @no-rollback reason: This migration used CREATE OR REPLACE FUNCTION for
--   get_booking_session() — the prior version is not recoverable from this file.
--   Dropping the function would break the booking flow entirely.
--   Restore from git history if needed:
--     git log --oneline -- supabase/migrations/*booking*
--   Find the prior migration that defined get_booking_session and restore it.

-- no-op: see header comment
