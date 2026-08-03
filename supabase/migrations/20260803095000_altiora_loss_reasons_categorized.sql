-- Motivos de perda categorizados para o pipeline Altiora.
-- leads_loss_reasons era uma lista plana e global (id, name) — sem forma de
-- diferenciar "perdido antes de qualquer reunião" de "reprovado após a R1"
-- de "perdido depois da R2". Adiciona `category` (nullable — reasons sem
-- categoria continuam valendo pra qualquer pipeline/etapa) e `order_index`
-- pra manter a ordem definida no negócio.

BEGIN;

ALTER TABLE public.leads_loss_reasons
  ADD COLUMN IF NOT EXISTS category TEXT
    CHECK (category IS NULL OR category IN ('pre_venda', 'reprovacao', 'pos_r2')),
  ADD COLUMN IF NOT EXISTS order_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_leads_loss_reasons_category
  ON public.leads_loss_reasons (category);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.leads_loss_reasons WHERE category IS NOT NULL) THEN
    RAISE NOTICE 'leads_loss_reasons já tem motivos categorizados — pulando seed (idempotência)';
    RETURN;
  END IF;

-- Pré-Venda — Contato iniciado / Agendamento, antes de qualquer reunião existir
INSERT INTO public.leads_loss_reasons (name, category, order_index) VALUES
  ('Não respondeu a nenhuma tentativa de contato (lead frio)',              'pre_venda', 1),
  ('Respondeu, mas não retornou mais durante a negociação de data',         'pre_venda', 2),
  ('Recusou explicitamente falar com a Altiora',                           'pre_venda', 3),
  ('Número ou e-mail de contato inválido/incorreto',                       'pre_venda', 4),
  ('Não é o momento — pediu para retomar futuramente',                     'pre_venda', 5),
  ('Fora do perfil, com base nas informações do referral (sem necessidade de diagnóstico)', 'pre_venda', 6),
  ('Outro (detalhar em observações)',                                      'pre_venda', 7);

-- Reprovação — logo após a R1, mesmo com comparecimento
INSERT INTO public.leads_loss_reasons (name, category, order_index) VALUES
  ('Patrimônio insuficiente para o perfil de atuação da Altiora',          'reprovacao', 1),
  ('Não é decisor / não tem autonomia sobre o patrimônio',                 'reprovacao', 2),
  ('Já possui estrutura patrimonial adequada (sem lacuna real identificada)', 'reprovacao', 3),
  ('Perfil não aderente ao produto (sem necessidade de proteção internacional)', 'reprovacao', 4),
  ('Diagnóstico incompleto e cliente não retornou para concluir',          'reprovacao', 5),
  ('Outro (detalhar em observações)',                                      'reprovacao', 6);

-- Pós-R2 — processo avançou, mas não fechou
INSERT INTO public.leads_loss_reasons (name, category, order_index) VALUES
  ('Optou por um concorrente',                                            'pos_r2', 1),
  ('Parou de responder, sem retorno (ghosting)',                          'pos_r2', 2),
  ('Timing inadequado — pode retomar futuramente',                        'pos_r2', 3),
  ('Objeção não resolvida sobre a estrutura internacional/trust',         'pos_r2', 4),
  ('Decisão negativa da família ou sócios',                               'pos_r2', 5),
  ('Condições (valor/prêmio) fora do esperado pelo cliente',              'pos_r2', 6),
  ('Outro (detalhar em observações)',                                     'pos_r2', 7);

END $$;

COMMIT;
