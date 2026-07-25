-- =============================================================================
-- Migration: 20260725160000_altiora_contratacao.sql
-- Cria tabela altiora_contratacao para acompanhamento do processo de contratação
--
-- Estrutura:
--   - Dados da emissão (parceiro, data, valor, prêmio)
--   - Status de documentação e exames (checklists em JSONB)
--   - Status de entrevista financeira e underwriting (text + CHECK)
--   - UNIQUE(lead_id) → um processo de contratação por referral
--
-- Casos de uso cobertos:
--   UC28 — Acompanhar Processo de Contratação
--     - documentos_status: {doc_name: {status, data, notas}}
--     - exames_status: {exame_name: {status, data, notas}}
--     - entrevista_financeira_status
--     - underwriting_status
--   UC29 — Registrar Negócio Ganho
--     - parceiro_emissor, data_emissao, valor_final, premio_confirmado
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.altiora_contratacao (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referral associado (1 processo por lead)
  lead_id                         uuid NOT NULL
                                  REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Dados de emissão (preenchidos ao registrar como Ganho — UC29)
  parceiro_emissor                text,
  data_emissao                    date,
  data_confirmacao_emissao        date,
  valor_final                     numeric(15, 2),
  premio_confirmado               numeric(15, 2),

  -- Checklists de documentação e exames (UC28)
  -- Estrutura sugerida: {doc_name: {status: "pendente"|"entregue"|"aprovado", data: date, notas: text}}
  documentos_status               jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Estrutura sugerida: {exame_name: {status: "pendente"|"agendado"|"realizado"|"nao_aplicavel", data, notas}}
  exames_status                   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Status da entrevista financeira (UC28)
  entrevista_financeira_status    text NOT NULL DEFAULT 'pendente'
                                  CHECK (entrevista_financeira_status IN (
                                    'pendente', 'agendada', 'realizada', 'nao_aplicavel'
                                  )),

  -- Status de underwriting da seguradora (UC28)
  underwriting_status             text NOT NULL DEFAULT 'pendente'
                                  CHECK (underwriting_status IN (
                                    'pendente', 'em_analise', 'aprovado', 'recusado', 'nao_aplicavel'
                                  )),

  -- Observações gerais do processo
  notas                           text,

  -- Auditoria
  created_by                      uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  updated_by                      uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  -- Apenas um processo de contratação por referral
  CONSTRAINT altiora_contratacao_lead_uq UNIQUE (lead_id)
);

-- ── Trigger updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER altiora_contratacao_updated_at
  BEFORE UPDATE ON public.altiora_contratacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_altiora_contratacao_underwriting
  ON public.altiora_contratacao(underwriting_status);

CREATE INDEX IF NOT EXISTS idx_altiora_contratacao_entrevista
  ON public.altiora_contratacao(entrevista_financeira_status);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_contratacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_contratacao_authenticated
  ON public.altiora_contratacao
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Comentários ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_contratacao IS
  'Processo de contratação de seguros por referral — documentação, exames, entrevista e underwriting (UC28/UC29).';

COMMENT ON COLUMN public.altiora_contratacao.parceiro_emissor IS
  'Parceiro/seguradora responsável pela emissão da apólice (UC29).';

COMMENT ON COLUMN public.altiora_contratacao.documentos_status IS
  'Checklist de documentos: {doc_name: {status, data, notas}} (UC28).';

COMMENT ON COLUMN public.altiora_contratacao.exames_status IS
  'Checklist de exames médicos: {exame_name: {status, data, notas}} (UC28).';

COMMENT ON COLUMN public.altiora_contratacao.entrevista_financeira_status IS
  'Status da entrevista financeira: pendente | agendada | realizada | nao_aplicavel (UC28).';

COMMENT ON COLUMN public.altiora_contratacao.underwriting_status IS
  'Status de underwriting: pendente | em_analise | aprovado | recusado | nao_aplicavel (UC28).';

COMMENT ON COLUMN public.altiora_contratacao.valor_final IS
  'Valor final da apólice em R$ (UC29).';

COMMENT ON COLUMN public.altiora_contratacao.premio_confirmado IS
  'Prêmio confirmado pela seguradora em R$ (UC29).';

COMMIT;
