-- =============================================================================
-- Migration: 20260725100000_altiora_pipeline.sql
-- Cria o pipeline Altiora com 13 etapas para gestão de referrals
--
-- UUIDs fixos (prefixo a100...) garantem idempotência e rollback determinístico.
-- ON CONFLICT DO NOTHING → seguro re-executar sem efeito colateral.
-- =============================================================================

BEGIN;

-- ── 1. Pipeline principal ────────────────────────────────────────────────────

INSERT INTO public.leads_pipelines (id, name, description, active, order_index)
VALUES (
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'Pipeline Altiora',
  'Pipeline de gestão de referrals Altiora — 13 etapas de handoff à contratação',
  true,
  100
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. 13 Etapas ─────────────────────────────────────────────────────────────

INSERT INTO public.leads_stages (id, leads_pipelines_id, name, order_index, color, active)
VALUES
  ('a1000000-0000-0000-0001-000000000001'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Novo referral',              1,  '#94A3B8', true),

  ('a1000000-0000-0000-0001-000000000002'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Encaminhado ao comercial',   2,  '#60A5FA', true),

  ('a1000000-0000-0000-0001-000000000003'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Contato iniciado',           3,  '#34D399', true),

  ('a1000000-0000-0000-0001-000000000004'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'R1 agendada',                4,  '#FBBF24', true),

  ('a1000000-0000-0000-0001-000000000005'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'R1 realizada',               5,  '#F97316', true),

  ('a1000000-0000-0000-0001-000000000006'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Análise Finvity',            6,  '#8B5CF6', true),

  ('a1000000-0000-0000-0001-000000000007'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'R2 agendada',                7,  '#EC4899', true),

  ('a1000000-0000-0000-0001-000000000008'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'R2 realizada',               8,  '#10B981', true),

  ('a1000000-0000-0000-0001-000000000009'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'R3 agendada',                9,  '#3B82F6', true),

  ('a1000000-0000-0000-0001-000000000010'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'R3 realizada / fechamento',  10, '#6366F1', true),

  ('a1000000-0000-0000-0001-000000000011'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Em contratação',             11, '#F59E0B', true),

  ('a1000000-0000-0000-0001-000000000012'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Ganho',                      12, '#22C55E', true),

  ('a1000000-0000-0000-0001-000000000013'::uuid,
   'a1000000-0000-0000-0000-000000000001'::uuid,
   'Perdido',                    13, '#EF4444', true)

ON CONFLICT (id) DO NOTHING;

COMMIT;
