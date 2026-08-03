-- =============================================================================
-- Migration: 20260726290000_fix_auto_link_score_matrix_trigger.sql
--
-- auto_link_score_matrix() (trigger BEFORE INSERT OR UPDATE em clients_people)
-- ainda fazia `NEW.score := ...`, mas a coluna `clients_people.score` não
-- existe mais — o valor numérico do score vive em `score_matrix.score_number`,
-- acessado via join por `clients_people.score_matrix_id`.
--
-- Efeito: TODO insert em clients_people (formulário, Meta Ads, webhook,
-- WhatsApp, criação manual, e-mail referral) falhava com
-- "record "new" has no field "score"". Bug de schema drift, não isolado a
-- nenhuma feature específica.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_score_matrix()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matrix_id uuid;
  v_score integer;
BEGIN
  -- Só processa se os 3 campos estiverem preenchidos
  IF NEW.score_objective_id IS NOT NULL
     AND NEW.score_investment_id IS NOT NULL
     AND NEW.score_framing_id IS NOT NULL THEN

    -- Busca a matriz correspondente
    SELECT matrix_id, matrix_score
    INTO v_matrix_id, v_score
    FROM public.find_score_matrix(
      NEW.score_objective_id,
      NEW.score_investment_id,
      NEW.score_framing_id
    );

    -- Se encontrou, atualiza o vínculo (score numérico vem de score_matrix.score_number via join)
    IF v_matrix_id IS NOT NULL THEN
      NEW.score_matrix_id := v_matrix_id;
    ELSE
      NEW.score_matrix_id := NULL;
    END IF;
  ELSE
    NEW.score_matrix_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
