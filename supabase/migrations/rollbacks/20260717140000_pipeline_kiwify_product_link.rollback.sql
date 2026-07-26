-- Rollback for: 20260717140000_pipeline_kiwify_product_link.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- WARNING: DROP COLUMN removes kiwify_product_id + kiwify_product_name from all pipelines.
--          Any linked Kiwify products are unlinked. Confirm no production linkages before applying.

BEGIN;

-- 1. Drop Kiwify product columns from leads_pipelines (index drops automatically)
ALTER TABLE public.leads_pipelines
  DROP COLUMN IF EXISTS kiwify_product_id,
  DROP COLUMN IF EXISTS kiwify_product_name;

-- 2. Drop unique constraint added to kiwify_event_mappings
ALTER TABLE public.kiwify_event_mappings
  DROP CONSTRAINT IF EXISTS kiwify_event_mappings_trigger_product_uq;

-- 3. Restore original write policy on leads_pipelines (allow all authenticated)
DROP POLICY IF EXISTS managers_write_pipelines ON public.leads_pipelines;
CREATE POLICY authenticated_write ON public.leads_pipelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Restore original write policy on leads_stages
DROP POLICY IF EXISTS managers_write_stages ON public.leads_stages;
CREATE POLICY authenticated_write ON public.leads_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Drop helper functions introduced by this migration
DROP FUNCTION IF EXISTS public.link_pipeline_to_kiwify_product(uuid, text, text, boolean);
DROP FUNCTION IF EXISTS public.unlink_pipeline_kiwify_product(uuid);

COMMIT;
