/**
 * fup-programados-worker — FUP-AUTO-01 WORKER-1
 *
 * Processes the `fup_programados` queue every 5 minutes (via pg_cron).
 * Picks rows WHERE status='pending' AND scheduled_at <= now() AND deleted_at IS NULL.
 *
 * Dispatch by tipo:
 *  etapa_crm   → UPDATE leads SET leads_stages_id = etapa_id WHERE id = lead_id
 *  agendamento → INSERT into meetings (title, start_time, end_time, people_id)
 *  programado  → call whatsapp-outbound with template_id or mensagem
 *
 * Status flow: pending → processing → done | failed
 * MAX_RETRIES = 3 (marks failed after that).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;

interface FupRow {
  id: string;
  lead_id: string;
  people_id: string | null;
  agent_id: string | null;
  tipo: 'etapa_crm' | 'agendamento' | 'programado';
  etapa_id: string | null;
  template_id: string | null;
  mensagem: string | null;
  agendamento_titulo: string | null;
  motivo: string | null;
  scheduled_at: string;
  retry_count: number;
  // Joined
  person: { name: string | null; whatsapp: string | null } | null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase     = createClient(supabaseUrl, serviceKey);
  const log          = createLogger('fup-programados-worker');
  const results      = { processed: 0, done: 0, failed: 0, skipped: 0 };

  try {
    // ── 1. Fetch pending FUPs due now ─────────────────────────────────────────
    const { data: rows, error: fetchErr } = await (supabase as any)
      .from('fup_programados')
      .select(`
        id, lead_id, people_id, agent_id, tipo,
        etapa_id, template_id, mensagem, agendamento_titulo, motivo,
        scheduled_at, retry_count,
        person:clients_people!people_id (name, whatsapp)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (fetchErr) {
      log.error('fetch_failed', { error: fetchErr.message });
      return json({ success: false, error: fetchErr.message, results }, 500);
    }

    const fups: FupRow[] = rows ?? [];
    log.info('batch_start', { count: fups.length });

    for (const fup of fups) {
      results.processed++;

      // ── 2. Mark processing ─────────────────────────────────────────────────
      const { error: lockErr } = await (supabase as any)
        .from('fup_programados')
        .update({ status: 'processing' })
        .eq('id', fup.id)
        .eq('status', 'pending');

      if (lockErr) {
        // Already picked up by another invocation (race) — skip
        log.warn('lock_conflict', { fup_id: fup.id });
        results.skipped++;
        continue;
      }

      // ── 3. Dispatch by tipo ────────────────────────────────────────────────
      let dispatchResult: { success: boolean; error?: string };
      try {
        switch (fup.tipo) {
          case 'etapa_crm':
            dispatchResult = await handleEtapaCrm(supabase, fup, log);
            break;
          case 'agendamento':
            dispatchResult = await handleAgendamento(supabase, fup, log);
            break;
          case 'programado':
            dispatchResult = await handleProgramado(supabase, fup, log);
            break;
          default:
            dispatchResult = { success: false, error: `tipo desconhecido: ${fup.tipo}` };
        }
      } catch (err) {
        dispatchResult = { success: false, error: err instanceof Error ? err.message : String(err) };
      }

      // ── 4. Update final status ─────────────────────────────────────────────
      if (dispatchResult.success) {
        await (supabase as any)
          .from('fup_programados')
          .update({ status: 'done', fired_at: new Date().toISOString(), error_message: null })
          .eq('id', fup.id);
        results.done++;
        log.info('fup_done', { fup_id: fup.id, tipo: fup.tipo });
      } else {
        const newRetry = fup.retry_count + 1;
        const isFinal  = newRetry >= MAX_RETRIES;
        await (supabase as any)
          .from('fup_programados')
          .update({
            status:        isFinal ? 'failed' : 'pending',
            retry_count:   newRetry,
            error_message: dispatchResult.error ?? 'Erro desconhecido',
          })
          .eq('id', fup.id);
        results.failed++;
        log.error('fup_failed', { fup_id: fup.id, tipo: fup.tipo, error: dispatchResult.error, retries: newRetry, final: isFinal });
      }
    }

    log.info('batch_done', results);
    return json({ success: true, results });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('unexpected', { error: msg });
    return json({ success: false, error: msg, results }, 500);
  }
});

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleEtapaCrm(
  supabase: any,
  fup: FupRow,
  log: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; error?: string }> {
  if (!fup.etapa_id) return { success: false, error: 'etapa_id ausente para tipo etapa_crm' };

  const { error } = await supabase
    .from('leads')
    .update({ leads_stages_id: fup.etapa_id })
    .eq('id', fup.lead_id);

  if (error) {
    log.error('etapa_crm_update_failed', { fup_id: fup.id, lead_id: fup.lead_id, error: error.message });
    return { success: false, error: `Erro ao mover etapa: ${error.message}` };
  }

  log.info('etapa_crm_done', { fup_id: fup.id, lead_id: fup.lead_id, etapa_id: fup.etapa_id });
  return { success: true };
}

async function handleAgendamento(
  supabase: any,
  fup: FupRow,
  log: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; error?: string }> {
  const title = fup.agendamento_titulo ?? fup.motivo ?? 'Reunião programada pelo agente IA';
  const startTime = new Date(fup.scheduled_at);
  const endTime   = new Date(startTime.getTime() + 60 * 60 * 1000); // +1h default

  const { error } = await supabase
    .from('meetings')
    .insert({
      title,
      start_time:  startTime.toISOString(),
      end_time:    endTime.toISOString(),
      people_id:   fup.people_id ?? null,
      status:      'agendado',
    });

  if (error) {
    log.error('agendamento_insert_failed', { fup_id: fup.id, error: error.message });
    return { success: false, error: `Erro ao criar agendamento: ${error.message}` };
  }

  log.info('agendamento_done', { fup_id: fup.id, lead_id: fup.lead_id, title });
  return { success: true };
}

async function handleProgramado(
  supabase: any,
  fup: FupRow,
  log: ReturnType<typeof createLogger>,
): Promise<{ success: boolean; error?: string }> {
  if (!fup.person?.whatsapp) {
    return { success: false, error: 'Contato sem número de WhatsApp cadastrado' };
  }

  if (!fup.template_id && !fup.mensagem) {
    return { success: false, error: 'Tipo programado requer template_id ou mensagem' };
  }

  // INSERT pre-message record
  const { data: msgRow, error: msgErr } = await supabase
    .from('messages')
    .insert({
      content:     fup.mensagem ?? `[Template: ${fup.template_id}]`,
      from_contact: 'sistema',
      message_type: 'texto',
      status:       'pending',
      source_type:  'fup_programado',
    })
    .select('id')
    .maybeSingle();

  if (msgErr) {
    log.warn('programado_msg_insert_failed', { fup_id: fup.id, error: msgErr.message });
    // Non-fatal — proceed without message_id
  }

  const outboundPayload: Record<string, unknown> = {
    to:         fup.person.whatsapp,
    people_id:  fup.people_id,
    message_ids: msgRow?.id ? [msgRow.id] : [],
  };

  if (fup.template_id) {
    outboundPayload.messages = [{
      type:          'template',
      template_name: fup.template_id,
      language_code: 'pt_BR',
    }];
  } else {
    outboundPayload.messages = [{
      type: 'text',
      body: fup.mensagem,
    }];
  }

  const { error: outboundErr } = await supabase.functions.invoke('whatsapp-outbound', {
    body: outboundPayload,
  });

  if (outboundErr) {
    log.error('programado_outbound_failed', { fup_id: fup.id, error: outboundErr.message });
    return { success: false, error: `whatsapp-outbound error: ${outboundErr.message}` };
  }

  log.info('programado_done', { fup_id: fup.id, whatsapp: fup.person.whatsapp, template_id: fup.template_id });
  return { success: true };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
