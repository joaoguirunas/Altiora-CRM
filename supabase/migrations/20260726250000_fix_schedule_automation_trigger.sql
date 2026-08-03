-- Fix: fn_schedule_automation_on_status_change usava NEW.lead_id
-- mas a coluna na tabela meetings é leads_id.
-- Causa: "record 'new' has no field 'lead_id'" ao inserir/atualizar meetings.

CREATE OR REPLACE FUNCTION public.fn_schedule_automation_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trigger_status TEXT;
  v_lead_id        UUID;
  v_lead           RECORD;
  v_rule           RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'bloqueio manual' THEN
    RETURN NEW;
  END IF;

  v_trigger_status := CASE NEW.status
    WHEN 'agendado'         THEN 'criado'
    WHEN 'compareceu'       THEN 'realizado'
    WHEN 'cancelado'        THEN 'cancelado'
    WHEN 'não compareceu'   THEN 'no_show'
    WHEN 'confirmado'       THEN 'confirmado'
    WHEN 'reagendado'       THEN 'reagendado'
    ELSE NULL
  END;

  IF v_trigger_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Usa leads_id (nome correto da coluna) com fallback por people_id
  v_lead_id := NEW.leads_id;

  IF v_lead_id IS NULL AND NEW.people_id IS NOT NULL THEN
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE people_id = NEW.people_id
       AND status = 'em-andamento'
       AND archived = false
     ORDER BY updated_at DESC
     LIMIT 1;

    v_lead_id := v_lead.id;
  ELSE
    SELECT id, leads_pipelines_id, leads_stages_id
      INTO v_lead
      FROM public.leads
     WHERE id = v_lead_id;
  END IF;

  IF v_lead_id IS NULL OR v_lead.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sa.target_pipeline_id, sa.target_stage_id
    INTO v_rule
    FROM public.schedule_automations sa
   WHERE sa.pipeline_id = v_lead.leads_pipelines_id
     AND sa.trigger_status = v_trigger_status
     AND sa.is_active = true
   LIMIT 1;

  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.leads
     SET leads_pipelines_id = v_rule.target_pipeline_id,
         leads_stages_id    = v_rule.target_stage_id,
         updated_at         = NOW()
   WHERE id = v_lead_id;

  INSERT INTO public.leads_updates (lead_id, from_stage_id, to_stage_id, notes)
  VALUES (
    v_lead_id,
    v_lead.leads_stages_id,
    v_rule.target_stage_id,
    'Automação Schedule: meeting status → ' || NEW.status
  );

  RETURN NEW;
END;
$$;
