-- =============================================================================
-- Migration: 20260726300000_fix_dispatch_novo_lead_webhooks_trigger.sql
--
-- dispatch_novo_lead_webhooks() (trigger AFTER INSERT em leads) consulta
-- `public.webhooks` (colunas id, url, name, event_type, active) — tabela que
-- não existe mais. O sistema de webhooks migrou para `sends_webhooks`
-- (name, webhook_url, description, active — sem conceito de event_type),
-- provavelmente numa redesenho anterior que não atualizou este trigger.
--
-- Efeito: TODA inserção de lead (formulário, Meta Ads, webhook genérico,
-- e-mail referral, criação manual) falhava com
-- "relation "public.webhooks" does not exist" — o INSERT inteiro abortava.
--
-- Fix: torna o disparo de webhook defensivo (efeito colateral nunca deve
-- derrubar a criação do lead). Não tenta adivinhar o novo mapeamento de
-- sends_webhooks → tipo de evento; isso fica para uma migração dedicada
-- quando o modelo de webhooks por evento for redesenhado.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.dispatch_novo_lead_webhooks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  webhook_record RECORD;
  payload JSONB;
  cliente_data JSONB;
  request_id BIGINT;
BEGIN
  BEGIN
    -- Buscar dados do cliente se existir people_id
    IF NEW.people_id IS NOT NULL THEN
      SELECT to_jsonb(cp.*) INTO cliente_data
      FROM public.clients_people cp
      WHERE cp.id = NEW.people_id;
    END IF;

    -- Montar o payload
    payload := jsonb_build_object(
      'tipo', 'novo_lead',
      'timestamp', now(),
      'lead', to_jsonb(NEW),
      'cliente', COALESCE(cliente_data, '{}'::jsonb)
    );

    -- Iterar sobre webhooks ativos do tipo 'novo_lead'
    FOR webhook_record IN
      SELECT id, url, name
      FROM public.webhooks
      WHERE event_type = 'novo_lead' AND active = true
    LOOP
      BEGIN
        -- Enviar requisição HTTP POST via pg_net
        SELECT net.http_post(
          url := webhook_record.url,
          body := payload,
          params := '{}'::jsonb,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          timeout_milliseconds := 10000
        ) INTO request_id;

        -- Registrar log do webhook
        INSERT INTO public.webhook_logs (
          webhook_id,
          status_code,
          response_body,
          request_body,
          created_at
        ) VALUES (
          webhook_record.id,
          202, -- Enfileirado
          jsonb_build_object('queued', true, 'request_id', request_id),
          payload,
          now()
        );

      EXCEPTION WHEN OTHERS THEN
        -- Log de erro (não interrompe o loop nem a criação do lead)
        INSERT INTO public.webhook_logs (
          webhook_id,
          status_code,
          response_body,
          request_body,
          created_at
        ) VALUES (
          webhook_record.id,
          500,
          jsonb_build_object('error', SQLERRM, 'queued', false),
          payload,
          now()
        );
      END;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    -- public.webhooks não existe (ou qualquer outra falha no disparo) —
    -- nunca bloqueia a criação do lead em si.
    RAISE WARNING 'dispatch_novo_lead_webhooks: webhook dispatch failed (lead creation unaffected): %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

COMMIT;
