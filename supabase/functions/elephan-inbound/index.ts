/**
 * Elephan.ai Inbound Webhook — Meeting Completed
 *
 * ⚠️  DEPLOY: supabase functions deploy elephan-inbound --no-verify-jwt
 *
 * Dispara quando uma reunião gravada pela Elephan termina de processar.
 * Schema confirmado via `GET /v1/transcribes/{id}` (docs em
 * https://elephan-api.readme.io/, base https://api.elephan.dev):
 *
 *   { id, title?, dateIncluded, status, duration?,
 *     user: { id, name, email },   // consultor Altiora que fez a call — NÃO o cliente
 *     prompt: { id, name, type } | null,
 *     transcript: { text, speakers?: [{ text, start, end, sentiment }] },
 *     keywords: string[], tags: string[], importantPoints: string[],
 *     sentimentAnalysis: unknown | null, summary: string | null,
 *     deal: { id, type, crmUrl } | null,   // sempre {id:"0", crmUrl:null} hoje — sem link de CRM
 *     url_file: string }                    // URL da gravação
 *
 * O payload NÃO contém e-mail/telefone do cliente. Correlação com o
 * Altiora-CRM é feita por: e-mail do `user` (consultor) → settings_users
 * → reunião mais próxima no horário (`meetings.users_id` + `start_time`),
 * em janelas crescentes (MATCH_WINDOWS_MS: ±90min → mesmo dia → ±3 dias —
 * janelas mais largas = match menos confiável) → `leads_id` dessa reunião.
 *
 * Pré-requisitos no CRM para o vínculo funcionar (ver conversa ALTIORA):
 *   1. Os consultores reais precisam existir em `settings_users` com o
 *      MESMO e-mail que usam na Elephan.
 *   2. Precisa haver uma reunião real em `meetings` (users_id + horário)
 *      próxima do horário da call gravada.
 * Sem os dois (ou se nenhuma janela achar reunião), a call cai em
 * `elephan_unmatched_events` (status='pending') para vínculo manual —
 * nada se perde, só não fica visível no negócio até alguém resolver.
 *
 * O vínculo automático por horário só acontece quando é inequívoco: uma única
 * reunião candidata na janela de ±90min. Se houver mais de uma, ou se a única
 * candidata só apareceu numa janela larga, a call também vira pendência — com
 * status='needs_confirmation' e os candidatos em `candidate_meeting_ids`, para
 * o closer dizer de qual contato era a reunião (migration 20260821140000).
 *
 * O webhook de teste da Elephan manda `{ event: "test", data: { message, webhookId } }`
 * — sem `data.id`, então é ignorado (logado, não processado).
 *
 * Se o payload real do evento "meeting completed" vier só com uma
 * referência mínima (ex: `{ data: { id } }`), fazemos fallback e buscamos
 * o registro completo via `GET /v1/transcribes/{id}` com ELEPHAN_API_KEY.
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ELEPHAN_API_KEY          (Bearer token — Team API Key da Elephan)
 *   ELEPHAN_WEBHOOK_SECRET   (opcional — TODO ELEPHAN-01: a Elephan não expôs
 *                             um mecanismo de assinatura na config do webhook;
 *                             se/quando expuser, ajustar verifySecret())
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-elephan-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ELEPHAN_API_BASE = 'https://api.elephan.dev';

// ── Schema real (GET /v1/transcribes/{id}) ───────────────────────────────────

interface ElephanSpeaker {
  text: string;
  start: number;
  end: number;
  sentiment?: { Sentiment: string; SentimentScore?: Record<string, number> };
}

/**
 * Uma linha do score card. A Elephan aplica um `prompt` (playbook) à call e
 * devolve uma resposta por pergunta, em três formatos:
 *   - `score`  — nota numérica (0–10)
 *   - `yesNo`  — 'yes' | 'no'
 *   - aberta   — só question/questionId, e o texto (quando existe) vem em
 *                `answer`/`text`. Nos payloads observados até hoje as abertas
 *                chegaram SEM campo de resposta; por isso ambos são opcionais e
 *                a UI trata ausência como "não respondida".
 */
interface ElephanAnswer {
  questionId?: string;
  question?: string;
  score?: number;
  yesNo?: 'yes' | 'no' | string;
  answer?: string;
  text?: string;
}

interface ElephanTranscribe {
  id: string;
  title?: string;
  dateIncluded: string;
  dateModified?: string;
  status: string;
  duration?: number;
  user?: { id: string; name: string; email: string };
  prompt?: { id: string; name: string; type: string } | null;
  transcript?: { text: string; speakers?: ElephanSpeaker[] };
  keywords?: string[];
  tags?: string[];
  importantPoints?: string[];
  sentimentAnalysis?: unknown;
  summary?: string | null;
  deal?: { id: string; type: string; crmUrl: string | null } | null;
  url_file?: string;
  /** Score card — ver ElephanAnswer. Estava chegando e sendo descartado. */
  answers?: ElephanAnswer[];
  competitors?: unknown[];
}

/**
 * Normaliza o score card para gravar em `meeting_records.ai_metadata.scorecard`.
 *
 * Sobre `scoreAverage`: a média ignora notas 0. Nos payloads reais, 0 aparece em
 * perguntas que não se aplicaram àquela call (ex: "o quanto o silêncio do
 * cliente foi conduzido sem soar insistente", numa conversa em que o cliente
 * respondeu na hora) — contá-las como zero derrubaria a nota de forma enganosa.
 * `scoreZero` fica exposto para a UI poder dizer quantas ficaram de fora, em vez
 * de esconder a decisão. Se a Elephan confirmar que 0 é nota real, basta trocar
 * o filtro aqui e no espelho do frontend (src/utils/elephanScorecard.ts).
 */
function buildScorecard(transcribe: ElephanTranscribe) {
  const answers = Array.isArray(transcribe.answers) ? transcribe.answers : [];
  if (answers.length === 0) return null;

  const scores = answers
    .filter((a) => typeof a.score === 'number')
    .map((a) => a.score as number);
  const scored = scores.filter((s) => s > 0);
  const yesNo = answers.filter((a) => a.yesNo === 'yes' || a.yesNo === 'no');
  const open = answers.filter((a) => typeof a.score !== 'number' && !a.yesNo);

  return {
    prompt: transcribe.prompt ?? null,
    answers,
    stats: {
      total: answers.length,
      scoreCount: scores.length,
      scoreZero: scores.length - scored.length,
      scoreAverage: scored.length
        ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
        : null,
      yesCount: yesNo.filter((a) => a.yesNo === 'yes').length,
      noCount: yesNo.filter((a) => a.yesNo === 'no').length,
      openCount: open.length,
      openAnswered: open.filter((a) => !!(a.answer ?? a.text)).length,
    },
  };
}

interface ElephanWebhookEnvelope {
  event?: string;
  data?: Partial<ElephanTranscribe> & { message?: string; webhookId?: string };
  timestamp?: string;
  [key: string]: unknown;
}

function verifySecret(req: Request): boolean {
  const expected = Deno.env.get('ELEPHAN_WEBHOOK_SECRET');
  if (!expected) return true; // Elephan não expôs assinatura na UI ainda — ver TODO ELEPHAN-01

  const headerSecret = req.headers.get('x-elephan-secret');
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  return headerSecret === expected || bearer === expected;
}

/** Busca o transcribe completo na API da Elephan quando o webhook não trouxe os detalhes. */
async function fetchTranscribe(id: string, log: ReturnType<typeof createLogger>): Promise<ElephanTranscribe | null> {
  const apiKey = Deno.env.get('ELEPHAN_API_KEY');
  if (!apiKey) {
    log.warn('ELEPHAN_API_KEY not set — cannot fetch full transcribe', { id });
    return null;
  }
  try {
    const res = await fetch(`${ELEPHAN_API_BASE}/v1/transcribes/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      log.warn('transcribe fetch failed', { id, status: res.status });
      return null;
    }
    const body = await res.json();
    return body?.data ?? null;
  } catch (err) {
    log.error('transcribe fetch error', { id, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Busca os insights (customer_need, feature_request, competitive_gap, etc.)
 * gerados pela IA da Elephan para essa call. Best-effort: a API não tem filtro
 * por transcribeId que funcione, então buscamos a lista paginada e filtramos
 * aqui; qualquer falha retorna [] sem derrubar o webhook.
 */
async function fetchInsights(
  transcribeId: string,
  log: ReturnType<typeof createLogger>
): Promise<Array<{ type: string; description: string; details?: string }>> {
  const apiKey = Deno.env.get('ELEPHAN_API_KEY');
  if (!apiKey) return [];
  try {
    const res = await fetch(`${ELEPHAN_API_BASE}/v1/insights?limit=200`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      log.warn('insights fetch failed', { transcribeId, status: res.status });
      return [];
    }
    const body = await res.json();
    const all = (body?.data ?? []) as Array<{
      type: string; description: string; details?: string; transcribe?: { id: string };
    }>;
    return all
      .filter(i => i.transcribe?.id === transcribeId)
      .map(i => ({ type: i.type, description: i.description, details: i.details }));
  } catch (err) {
    log.error('insights fetch error', { transcribeId, error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

Deno.serve(async (req: Request) => {
  const log = createLogger('elephan-inbound');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const rawBody = await req.text();
  let envelope: ElephanWebhookEnvelope;
  try {
    envelope = JSON.parse(rawBody || '{}');
  } catch {
    await supabase.from('webhook_logs').insert({
      source: 'elephan',
      event: 'parse_error',
      payload: { raw: rawBody.slice(0, 5000) },
      error_detail: 'invalid JSON body',
    });
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!verifySecret(req)) {
    log.warn('rejected — invalid secret');
    await supabase.from('webhook_logs').insert({ source: 'elephan', event: 'forbidden', payload: envelope });
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventType = envelope.event ?? 'unknown';

  // Evento de teste da Elephan ({event:"test", data:{message,webhookId}}) — sem `data.id`, nada a processar
  if (!envelope.data?.id) {
    log.info('no transcribe id in payload — logging only', { event: eventType });
    await supabase.from('webhook_logs').insert({ source: 'elephan', event: eventType, payload: envelope });
    return new Response(JSON.stringify({ ok: true, processed: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Payload já veio completo? Usa direto. Senão, busca na API pelo id.
    let transcribe: ElephanTranscribe | null = null;
    if (envelope.data.transcript || envelope.data.user) {
      transcribe = envelope.data as ElephanTranscribe;
    } else {
      transcribe = await fetchTranscribe(envelope.data.id, log);
    }

    if (!transcribe) {
      await supabase.from('webhook_logs').insert({
        source: 'elephan',
        event: `${eventType}:fetch_failed`,
        payload: envelope,
        error_detail: `could not resolve transcribe ${envelope.data.id}`,
      });
      return new Response(JSON.stringify({ ok: false, error: 'transcribe not resolved' }), {
        status: 200, // 200 para evitar retry agressivo — já está logado para revisão manual
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Consultor (Elephan `user.email`) → settings_users
    let closerUserId: string | null = null;
    if (transcribe.user?.email) {
      const { data: closer } = await supabase
        .from('settings_users')
        .select('id')
        .eq('email', transcribe.user.email)
        .maybeSingle();
      closerUserId = closer?.id ?? null;
    }

    let meetingId: string | null = null;
    let leadId: string | null = null;
    let matchWindowUsed: number | null = null;

    // 3.0 Tier de maior confiança: [ref:<meeting_id>] embutido no título do evento
    // de calendário (google-cal-upsert-event/ms-teams-upsert-event/zoom-upsert-event)
    // — a Elephan captura esse título como `transcribe.title`. Sem ambiguidade entre
    // R1/R2/R3 do mesmo negócio, então pula direto pra etapa 4 se achar.
    const refMatch = transcribe.title?.match(/\[ref:([0-9a-fA-F-]{36})\]/);
    if (refMatch) {
      const { data: refMeeting } = await supabase
        .from('meetings')
        .select('id, leads_id')
        .eq('id', refMatch[1])
        .maybeSingle();
      if (refMeeting) {
        meetingId = refMeeting.id;
        leadId = refMeeting.leads_id;
        log.info('matched via [ref:] title tag — highest confidence', { transcribeId: transcribe.id, meetingId });
      } else {
        log.warn('[ref:] tag found but meeting no longer exists', { transcribeId: transcribe.id, refId: refMatch[1] });
      }
    }

    // 3. Sem match por ref — reunião real mais próxima do horário da call, do
    //    mesmo consultor, em janelas crescentes (mais larga = menor confiança).
    const MATCH_WINDOWS_MS = [
      90 * 60_000,        // ±90min — cobre atraso/duração da call
      24 * 60 * 60_000,   // mesmo dia (±24h)
      3 * 24 * 60 * 60_000, // ±3 dias — último recurso antes de virar pendência manual
    ];

    // Reuniões plausíveis que NÃO foram vinculadas sozinhas — o closer escolhe
    // qual delas era esta call. Ver migration 20260821140000.
    let candidateMeetingIds: string[] = [];

    if (!meetingId && closerUserId) {
      const callTime = new Date(transcribe.dateIncluded).getTime();
      for (const windowMs of MATCH_WINDOWS_MS) {
        const { data: candidates } = await supabase
          .from('meetings')
          .select('id, leads_id, start_time')
          .eq('users_id', closerUserId)
          .not('leads_id', 'is', null)
          .gte('start_time', new Date(callTime - windowMs).toISOString())
          .lte('start_time', new Date(callTime + windowMs).toISOString())
          .order('start_time', { ascending: true })
          .limit(5);

        if (!candidates?.length) continue;

        // Só vincula sozinho quando é inequívoco: um único candidato dentro da
        // janela mais estreita. Vários candidatos, ou match que só apareceu numa
        // janela larga, viram confirmação — colar no negócio errado em silêncio
        // é pior do que pedir um clique ao closer.
        const isNarrowWindow = windowMs === MATCH_WINDOWS_MS[0];
        if (candidates.length === 1 && isNarrowWindow) {
          meetingId = candidates[0].id;
          leadId = candidates[0].leads_id;
          matchWindowUsed = windowMs;
        } else {
          candidateMeetingIds = candidates.map((c) => c.id);
          log.info('ambiguous or low-confidence match — asking for confirmation', {
            transcribeId: transcribe.id,
            candidates: candidateMeetingIds.length,
            windowMs,
          });
        }
        break;
      }
    }

    if (!meetingId) {
      log.warn('call not linked automatically — parking for manual resolution', {
        transcribeId: transcribe.id,
        closerEmail: transcribe.user?.email,
        dateIncluded: transcribe.dateIncluded,
        candidates: candidateMeetingIds.length,
      });

      const topics = [...(transcribe.keywords ?? []), ...(transcribe.tags ?? [])];
      await supabase.from('elephan_unmatched_events').upsert(
        {
          transcribe_id: transcribe.id,
          call_date: transcribe.dateIncluded,
          title: transcribe.title ?? null,
          closer_email: transcribe.user?.email ?? null,
          closer_user_id: closerUserId,
          summary: transcribe.summary ?? (topics.length ? `Tópicos: ${topics.join(', ')}` : null),
          duration_seconds: transcribe.duration ?? null,
          recording_url: transcribe.url_file ?? null,
          transcript_text: transcribe.transcript?.text ?? null,
          raw_payload: transcribe,
          candidate_meeting_ids: candidateMeetingIds,
          // 'needs_confirmation' = achamos reuniões plausíveis e queremos que o
          // closer diga qual; 'pending' = não achamos nada e ele busca o negócio.
          status: candidateMeetingIds.length ? 'needs_confirmation' : 'pending',
        },
        { onConflict: 'transcribe_id', ignoreDuplicates: false },
      );

      await supabase.from('webhook_logs').insert({
        source: 'elephan',
        event: `${eventType}:unmatched`,
        payload: { envelope, transcribeId: transcribe.id },
      });
      // 200 — não é erro nosso; fica registrado em elephan_unmatched_events para vínculo manual
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (matchWindowUsed && matchWindowUsed > MATCH_WINDOWS_MS[0]) {
      log.warn('matched via widened window — lower confidence', {
        transcribeId: transcribe.id,
        leadId,
        windowMs: matchWindowUsed,
      });
    }

    // 4. Artefatos — grava tudo que a Elephan mandou, sem perder nada em ai_metadata
    const records: Record<string, unknown>[] = [];

    if (transcribe.url_file) {
      records.push({
        meeting_id: meetingId,
        record_type: 'recording',
        source: 'elephan',
        url: transcribe.url_file,
        duration_seconds: transcribe.duration ?? null,
      });
    }

    if (transcribe.transcript?.text) {
      records.push({
        meeting_id: meetingId,
        record_type: 'transcript',
        source: 'elephan',
        content: transcribe.transcript.text,
        content_format: 'text',
        ai_metadata: { speakers: transcribe.transcript.speakers ?? null },
      });
    }

    const insights = await fetchInsights(transcribe.id, log);
    const topics = [...(transcribe.keywords ?? []), ...(transcribe.tags ?? [])];
    const scorecard = buildScorecard(transcribe);
    if (transcribe.summary || transcribe.importantPoints?.length || topics.length || transcribe.sentimentAnalysis || insights.length || scorecard) {
      records.push({
        meeting_id: meetingId,
        record_type: 'ai_summary',
        source: 'elephan',
        content: transcribe.summary ?? null,
        ai_key_topics: topics.length ? topics : null,
        ai_next_steps: transcribe.importantPoints?.length ? transcribe.importantPoints : null,
        // Nota agregada do score card, ARREDONDADA: a coluna é integer e um
        // 8.7 faria o Postgres rejeitar (22P02) e o registro inteiro se perder.
        // A média exata fica em ai_metadata.scorecard.stats.scoreAverage.
        // Nullable de propósito: call sem prompt aplicado não tem nota, e 0 aqui
        // seria lido como "péssima".
        ai_score: typeof scorecard?.stats.scoreAverage === 'number'
          ? Math.round(scorecard.stats.scoreAverage)
          : null,
        ai_metadata: {
          sentimentAnalysis: transcribe.sentimentAnalysis ?? null,
          prompt: transcribe.prompt ?? null,
          insights: insights.length ? insights : null,
          scorecard,
          competitors: transcribe.competitors?.length ? transcribe.competitors : null,
        },
      });
    }

    // Insere um de cada vez — o PostgREST rejeita insert em lote quando os
    // objetos do array têm conjuntos de chaves diferentes (PGRST102), e aqui
    // recording/transcript/ai_summary sempre têm formatos diferentes.
    for (const record of records) {
      const { error: recErr } = await supabase.from('meeting_records').insert(record);
      if (recErr) log.error('failed to insert meeting_record', { record_type: record.record_type, error: recErr.message });
    }

    await supabase.from('webhook_logs').insert({
      source: 'elephan',
      event: eventType,
      payload: { envelope, transcribeId: transcribe.id },
    });

    log.info('processed', { event: eventType, closerUserId, leadId, meetingId, recordCount: records.length });

    return new Response(JSON.stringify({ ok: true, matched: true, leadId, meetingId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('unhandled error', { error: err instanceof Error ? err.message : String(err) });
    await supabase.from('webhook_logs').insert({
      source: 'elephan',
      event: 'error',
      payload: envelope,
      error_detail: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
