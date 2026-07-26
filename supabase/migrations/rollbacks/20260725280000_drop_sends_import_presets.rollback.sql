-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK: DROP sends_import_presets (20260725280000)
-- Recria a tabela no estado original de 20260430110000_fwup23_sends_import_presets.
-- AVISO: dados não são restaurados (zero rows em prod — tabela nunca populada).
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.sends_import_presets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  field_mapping jsonb       NOT NULL DEFAULT '{}',
  lead_control  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sends_import_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sends_import_presets_auth" ON public.sends_import_presets;
CREATE POLICY "sends_import_presets_auth" ON public.sends_import_presets
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_sends_import_presets_updated_at ON public.sends_import_presets;
CREATE TRIGGER update_sends_import_presets_updated_at
  BEFORE UPDATE ON public.sends_import_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  public.sends_import_presets IS 'Pre-configured CSV field mappings for lead import in Sends campaigns';
COMMENT ON COLUMN public.sends_import_presets.field_mapping IS 'FieldMappingConfig JSON: {name, whatsapp, crm_extra, lead_extra}';
COMMENT ON COLUMN public.sends_import_presets.lead_control  IS 'Value set on leads.control for all leads imported with this preset';

COMMIT;
