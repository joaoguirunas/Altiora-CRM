-- Rollback for: 20260615000000_meeting_followup_templates_v2.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- MFUP-V2 — Removes seeded templates and followup rules.
-- WARNING: Removes 8 whatsapp_templates + 8 meetings_followups seed rows.
--          If templates were approved/activated by Meta or rules have triggered
--          queued followups, additional cleanup may be required.

BEGIN;

-- Remove seeded meetings_followup rules (UUIDs from migration)
DELETE FROM public.meetings_followups
WHERE id IN (
  'b2000001-0000-0000-0000-000000000001',
  'b2000001-0000-0000-0000-000000000002',
  'b2000001-0000-0000-0000-000000000003',
  'b2000001-0000-0000-0000-000000000004',
  'b2000001-0000-0000-0000-000000000005',
  'b2000001-0000-0000-0000-000000000006',
  'b2000001-0000-0000-0000-000000000007',
  'b2000001-0000-0000-0000-000000000008'
);

-- Remove seeded WhatsApp templates (UUIDs from migration)
DELETE FROM public.whatsapp_templates
WHERE id IN (
  'a1000001-0000-0000-0000-000000000001',
  'a1000001-0000-0000-0000-000000000002',
  'a1000001-0000-0000-0000-000000000003',
  'a1000001-0000-0000-0000-000000000004',
  'a1000001-0000-0000-0000-000000000005',
  'a1000001-0000-0000-0000-000000000006',
  'a1000001-0000-0000-0000-000000000007',
  'a1000001-0000-0000-0000-000000000008'
);

COMMIT;
