/**
 * adm-drift-repair — REL-03 AC7
 *
 * Repara drift de schema re-aplicando a release corrente do tenant.
 * Chamado pelo frontend via `useRepairDrift` hook (DriftModal AC6).
 *
 * Fluxo:
 *   1. Autentica caller — super-admin JWT ou service_role.
 *   2. Lê o drift record em `adm_client_drift`.
 *   3. Chama `adm-sync-client` (service_role) com o client_id e current_version.
 *   4. Se sync ok: UPDATE adm_client_drift SET status='repaired', repaired_at, repaired_by.
 *   5. Retorna { ok: true, version }.
 *
 * Auth:
 *   - Aceita Bearer === SUPABASE_SERVICE_ROLE_KEY (calls de sistema).
 *   - Aceita JWT autenticado de super-admin (supabase.functions.invoke do frontend).
 *     Super-admin: settings_users.super_admin = true AND active = true.
 *
 * Method: POST
 * Body: { client_id: string, drift_id: string }
 *
 * Response 200: { ok: true, version: string }
 * Response 4xx: { error: string }
 *
 * Env vars:
 *   SUPABASE_URL              — control plane URL
 *   SUPABASE_SERVICE_ROLE_KEY — control plane service role key
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RepairBody {
  client_id: string;
  drift_id:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Resolves caller identity from Authorization header.
 * Returns { userId, isServiceRole } or null if unauthorized.
 */
async function resolveAuth(
  req: Request,
  db: ReturnType<typeof createClient>,
): Promise<{ userId: string | null; isServiceRole: boolean } | null> {
  const auth = req.headers.get('Authorization') ?? '';

  if (!auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7);

  // Service role fast-path
  if (token === SUPABASE_KEY) {
    return { userId: null, isServiceRole: true };
  }

  // User JWT — validate via Supabase getUser and check super_admin
  try {
    // Use a throw-away client with the user's token to validate
    const userClient = createClient(SUPABASE_URL, token, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);

    if (userErr || !user?.id) {
      console.warn('[adm-drift-repair] getUser failed:', userErr?.message ?? 'no user');
      return null;
    }

    // Check super_admin in settings_users
    const { data: su, error: suErr } = await db
      .from('settings_users')
      .select('super_admin, active')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .maybeSingle();

    if (suErr || !su?.super_admin) {
      console.warn(
        `[adm-drift-repair] user ${user.id} is not super_admin or not active`,
      );
      return null;
    }

    return { userId: user.id, isServiceRole: false };
  } catch (e) {
    console.error('[adm-drift-repair] auth check threw:', (e as Error).message);
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // ── Auth ─────────────────────────────────────────────────────────────────
  const caller = await resolveAuth(req, db);
  if (!caller) {
    return json({ error: 'Unauthorized — super-admin or service_role required' }, 401);
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: RepairBody;
  try {
    body = await req.json() as RepairBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { client_id, drift_id } = body;

  if (!client_id || typeof client_id !== 'string') {
    return json({ error: 'Missing required field: client_id' }, 400);
  }
  if (!drift_id || typeof drift_id !== 'string') {
    return json({ error: 'Missing required field: drift_id' }, 400);
  }

  console.log(
    `[adm-drift-repair] client=${client_id} drift=${drift_id} by=${caller.isServiceRole ? 'service_role' : caller.userId}`,
  );

  // ── Fetch drift record ───────────────────────────────────────────────────
  const { data: drift, error: driftErr } = await db
    .from('adm_client_drift')
    .select('id, client_id, expected_release, status')
    .eq('id', drift_id)
    .eq('client_id', client_id)
    .maybeSingle();

  if (driftErr || !drift) {
    const msg = driftErr?.message ?? 'not found';
    return json({ error: `Drift record not found: ${msg}` }, 404);
  }

  const driftRecord = drift as {
    id: string;
    client_id: string;
    expected_release: string;
    status: string;
  };

  if (driftRecord.status !== 'detected') {
    return json({
      error: `Drift record is already ${driftRecord.status} — nothing to repair`,
    }, 409);
  }

  // ── Call adm-sync-client to re-apply the expected release ────────────────
  console.log(
    `[adm-drift-repair] invoking adm-sync-client for release ${driftRecord.expected_release}`,
  );

  let syncOk = false;
  let syncVersion = '';
  let syncError = '';

  try {
    const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/adm-sync-client`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        client_id,
        target_version: driftRecord.expected_release,
        triggered_by:   'drift-repair',
        reason:         `Repair drift record ${drift_id}`,
      }),
    });

    const syncBody = await syncRes.json() as {
      ok: boolean;
      version?: string;
      error?: string;
      applied?: number;
      failed?: number;
    };

    syncOk      = syncBody.ok === true;
    syncVersion = syncBody.version ?? driftRecord.expected_release;
    syncError   = syncBody.error ?? (syncBody.failed ? `${syncBody.failed} migrations failed` : '');

    console.log(
      `[adm-drift-repair] sync result: ok=${syncOk} version=${syncVersion} ` +
      (syncError ? `error=${syncError}` : ''),
    );
  } catch (e) {
    syncError = (e as Error).message;
    console.error('[adm-drift-repair] adm-sync-client fetch threw:', syncError);
  }

  if (!syncOk) {
    return json({
      ok:    false,
      error: `Sync failed: ${syncError}`,
    }, 422);
  }

  // ── Mark drift record as repaired ────────────────────────────────────────
  const { error: updateErr } = await db
    .from('adm_client_drift')
    .update({
      status:      'repaired',
      repaired_at: new Date().toISOString(),
      repaired_by: caller.userId ?? null,
    })
    .eq('id', drift_id)
    .eq('status', 'detected'); // safety: only update if still detected

  if (updateErr) {
    // Sync succeeded but update failed — non-fatal (drift will re-check on next cron)
    console.warn(
      `[adm-drift-repair] drift record update non-fatal: ${updateErr.message}`,
    );
  }

  console.log(
    `[adm-drift-repair] REPAIRED drift ${drift_id} for client ${client_id} → version ${syncVersion}`,
  );

  return json({ ok: true, version: syncVersion });
});
