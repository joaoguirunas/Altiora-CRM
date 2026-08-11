/**
 * Elephan.ai — busca os insights (customer_need, feature_request,
 * product_feedback, usability_issue, competitive_gap, other_observation)
 * gerados pela IA da Elephan para uma call específica.
 *
 * A API não tem filtro por transcribeId que funcione (`/v1/insights?transcribeId=`
 * é ignorado pelo backend deles — retorna o mesmo resultado paginado de sempre),
 * então buscamos a lista paginada e filtramos aqui por `transcribe.id`.
 *
 * Usado por:
 *   - useLinkElephanPendencia (vínculo manual, tela Pendências Elephan.ai)
 *   - elephan-inbound (vínculo automático, best-effort — não falha o webhook)
 *
 * Env vars: ELEPHAN_API_KEY (Bearer token — Team API Key da Elephan)
 */
import { createLogger } from '../_shared/logger.ts';

const ELEPHAN_API_BASE = 'https://api.elephan.dev';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ElephanInsight {
  id: string;
  type: string;
  description: string;
  details?: string;
  transcribe?: { id: string; name?: string };
}

Deno.serve(async (req: Request) => {
  const log = createLogger('elephan-fetch-insights');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('ELEPHAN_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ELEPHAN_API_KEY not set', insights: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let transcribeId: string | undefined;
  try {
    const body = await req.json();
    transcribeId = body?.transcribeId;
  } catch {
    // body ausente/inválido — tratado abaixo
  }

  if (!transcribeId) {
    return new Response(JSON.stringify({ error: 'transcribeId is required', insights: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(`${ELEPHAN_API_BASE}/v1/insights?limit=200`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      log.warn('insights fetch failed', { transcribeId, status: res.status });
      return new Response(JSON.stringify({ insights: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = await res.json();
    const all = (body?.data ?? []) as ElephanInsight[];
    const matching = all
      .filter(i => i.transcribe?.id === transcribeId)
      .map(i => ({ type: i.type, description: i.description, details: i.details }));

    log.info('insights fetched', { transcribeId, count: matching.length });
    return new Response(JSON.stringify({ insights: matching }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('insights fetch error', { transcribeId, error: err instanceof Error ? err.message : String(err) });
    return new Response(JSON.stringify({ insights: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
