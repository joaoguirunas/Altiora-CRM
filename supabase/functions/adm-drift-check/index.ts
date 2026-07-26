/**
 * adm-drift-check — REL-03 AC2
 *
 * Detecta drift de schema entre o schema real de cada tenant e o hash
 * canônico armazenado em `adm_releases.schema_hash` para a versão corrente
 * do cliente.
 *
 * Acionamento:
 *   - pg_cron `adm-drift-check-daily` (0 4 * * *) — cron path, body vazio
 *   - Manual via POST — útil para debugging
 *
 * Fluxo por cliente:
 *   1. Busca todos os clientes ativos com `current_version` definida.
 *   2. Para cada cliente:
 *      a. Resolve credenciais via `adm_client_decrypted_secrets` RPC.
 *      b. Cria Supabase client do tenant com `service_role_key`.
 *      c. Chama `compute_schema_hash()` no banco do tenant → `actual_hash`.
 *      d. Lê `adm_releases.schema_hash` para `current_version` → `expected_hash`.
 *         - Se `expected_hash IS NULL` → lazy baseline: armazena `actual_hash`
 *           como canônico na release. Não reporta drift (primeira execução).
 *         - Se `expected_hash` existe E `actual_hash != expected_hash`:
 *           INSERT em `adm_client_drift` (idempotente — skip se já há row
 *           'detected' para o mesmo client_id + expected_release).
 *         - Se hashes iguais → no-op (schema ok).
 *   3. Retorna resumo JSON.
 *
 * Auth: service_role only (Bearer === SUPABASE_SERVICE_ROLE_KEY)
 * Method: POST (cron) ou GET (manual ping)
 *
 * Env vars requeridos:
 *   SUPABASE_URL               — control plane URL
 *   SUPABASE_SERVICE_ROLE_KEY  — control plane service role key
 *
 * Tabelas relevantes (control plane):
 *   adm_clients             — lista de tenants (supabase_url, current_version)
 *   adm_releases            — schema_hash esperado por versão
 *   adm_client_drift        — log de drifts detectados
 *
 * RPC tenant:
 *   compute_schema_hash()   — migration 20260725320000; GRANT TO service_role
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdmClient {
  id:              string;
  name:            string;
  supabase_url:    string;
  current_version: string;
}

interface AdmRelease {
  id:          string;
  version:     string;
  schema_hash: string | null;
}

interface DecryptedSecrets {
  service_role_key: string | null;
  db_password:      string | null;
  management_token: string | null;
}

interface ClientResult {
  client_id:      string;
  client_name:    string;
  outcome:        'ok' | 'drifted' | 'baselined' | 'skip_no_hash_rpc' | 'skip_no_credentials' | 'skip_no_release' | 'error';
  actual_hash?:   string;
  expected_hash?: string;
  error?:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Resolve schema_hash from the tenant database via RPC. Returns null on any failure. */
async function computeTenantHash(
  tenantUrl: string,
  tenantServiceKey: string,
  clientName: string,
): Promise<string | null> {
  try {
    const tenantDb = createClient(tenantUrl, tenantServiceKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await tenantDb.rpc('compute_schema_hash');
    if (error) {
      console.error(
        `[adm-drift-check] compute_schema_hash failed for ${clientName}: ${error.message}`,
      );
      return null;
    }
    return (data as string) ?? null;
  } catch (e) {
    console.error(
      `[adm-drift-check] compute_schema_hash threw for ${clientName}: ${(e as Error).message}`,
    );
    return null;
  }
}

/** INSERT drift row if no 'detected' row already exists for (client_id, expected_release). */
async function insertDriftIfNew(
  db: ReturnType<typeof createClient>,
  clientId: string,
  clientName: string,
  expectedRelease: string,
  expectedHash: string,
  actualHash: string,
): Promise<void> {
  // Idempotency: skip if a 'detected' row already exists for this client + release
  const { data: existing } = await db
    .from('adm_client_drift')
    .select('id')
    .eq('client_id', clientId)
    .eq('expected_release', expectedRelease)
    .eq('status', 'detected')
    .maybeSingle();

  if (existing) {
    console.log(
      `[adm-drift-check] ${clientName} — drift already recorded for release ${expectedRelease}, skipping insert`,
    );
    return;
  }

  const { error: insertErr } = await db.from('adm_client_drift').insert({
    client_id:        clientId,
    detected_at:      new Date().toISOString(),
    expected_hash:    expectedHash,
    actual_hash:      actualHash,
    expected_release: expectedRelease,
    diff_summary:     'Schema diverges from expected release hash',
    status:           'detected',
  });

  if (insertErr) {
    console.error(
      `[adm-drift-check] ${clientName} — adm_client_drift INSERT failed: ${insertErr.message}`,
    );
  } else {
    console.warn(
      `[adm-drift-check] ${clientName} — DRIFT DETECTED for release ${expectedRelease}. ` +
      `expected=${expectedHash.slice(0, 12)}... actual=${actualHash.slice(0, 12)}...`,
    );
  }
}

/** Store the computed hash as the canonical baseline for a release (lazy first-run). */
async function storeReleaseHash(
  db: ReturnType<typeof createClient>,
  releaseVersion: string,
  hash: string,
  clientName: string,
): Promise<void> {
  const { error } = await db
    .from('adm_releases')
    .update({ schema_hash: hash })
    .eq('version', releaseVersion)
    .is('schema_hash', null); // safety: only update if still null (race-safe)

  if (error) {
    console.error(
      `[adm-drift-check] ${clientName} — could not store baseline hash for release ` +
      `${releaseVersion}: ${error.message}`,
    );
  } else {
    console.log(
      `[adm-drift-check] ${clientName} — baseline hash established for release ${releaseVersion}: ` +
      `${hash.slice(0, 12)}...`,
    );
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Auth gate: service_role only ──────────────────────────────────────────
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== SUPABASE_KEY) {
    return json({ error: 'Unauthorized — service_role token required' }, 401);
  }

  // ── Method check ──────────────────────────────────────────────────────────
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  console.log('[adm-drift-check] starting drift check run');

  // ── Fetch all active clients with current_version set ─────────────────────
  const { data: clients, error: clientsErr } = await db
    .from('adm_clients')
    .select('id, name, supabase_url, current_version')
    .eq('status', 'active')
    .not('current_version', 'is', null);

  if (clientsErr) {
    console.error(`[adm-drift-check] failed to fetch clients: ${clientsErr.message}`);
    return json({ error: `Failed to fetch clients: ${clientsErr.message}` }, 500);
  }

  const activeClients = (clients ?? []) as AdmClient[];
  console.log(`[adm-drift-check] ${activeClients.length} active clients with current_version`);

  // ── Cache releases — deduplicate lookups for the same version ─────────────
  const releaseCache = new Map<string, AdmRelease | null>();

  const results: ClientResult[] = [];
  let drifted = 0;
  let ok = 0;
  let baselined = 0;
  let errors = 0;

  // ── Process each client ───────────────────────────────────────────────────
  for (const client of activeClients) {
    const { id: clientId, name: clientName, supabase_url: tenantUrl, current_version: version } = client;

    console.log(`[adm-drift-check] checking ${clientName} (version: ${version})`);

    // ── Look up release record ─────────────────────────────────────────────
    let release: AdmRelease | null = null;
    if (releaseCache.has(version)) {
      release = releaseCache.get(version) ?? null;
    } else {
      const { data: releaseData, error: releaseErr } = await db
        .from('adm_releases')
        .select('id, version, schema_hash')
        .eq('version', version)
        .maybeSingle();

      if (releaseErr) {
        console.error(
          `[adm-drift-check] ${clientName} — release lookup failed: ${releaseErr.message}`,
        );
        results.push({ client_id: clientId, client_name: clientName, outcome: 'error', error: releaseErr.message });
        errors++;
        continue;
      }

      release = (releaseData as AdmRelease | null) ?? null;
      releaseCache.set(version, release);
    }

    if (!release) {
      console.warn(
        `[adm-drift-check] ${clientName} — release '${version}' not found in adm_releases, skipping`,
      );
      results.push({ client_id: clientId, client_name: clientName, outcome: 'skip_no_release' });
      continue;
    }

    // ── Resolve tenant credentials ────────────────────────────────────────
    const { data: secretsRows, error: secretsErr } = await db.rpc(
      'adm_client_decrypted_secrets',
      { p_client_id: clientId },
    );

    if (secretsErr || !secretsRows) {
      console.error(
        `[adm-drift-check] ${clientName} — credentials fetch failed: ${secretsErr?.message ?? 'no rows'}`,
      );
      results.push({ client_id: clientId, client_name: clientName, outcome: 'skip_no_credentials', error: secretsErr?.message });
      continue;
    }

    const secrets = (secretsRows as DecryptedSecrets[])[0];
    if (!secrets?.service_role_key) {
      console.warn(`[adm-drift-check] ${clientName} — no service_role_key configured, skipping`);
      results.push({ client_id: clientId, client_name: clientName, outcome: 'skip_no_credentials' });
      continue;
    }

    // ── Compute actual schema hash from tenant ────────────────────────────
    const actualHash = await computeTenantHash(tenantUrl, secrets.service_role_key, clientName);

    if (!actualHash) {
      // compute_schema_hash() not deployed to this tenant yet — cannot check drift
      results.push({
        client_id:   clientId,
        client_name: clientName,
        outcome:     'skip_no_hash_rpc',
        error:       'compute_schema_hash() RPC failed or not deployed to tenant',
      });
      errors++;
      continue;
    }

    // ── Compare hashes ────────────────────────────────────────────────────
    const expectedHash = release.schema_hash;

    if (!expectedHash) {
      // First run for this release — establish canonical baseline (lazy)
      await storeReleaseHash(db, version, actualHash, clientName);
      // Update local cache so subsequent clients in this batch use the new hash
      release.schema_hash = actualHash;
      releaseCache.set(version, release);

      results.push({
        client_id:   clientId,
        client_name: clientName,
        outcome:     'baselined',
        actual_hash: actualHash,
      });
      baselined++;
      continue;
    }

    if (actualHash === expectedHash) {
      console.log(`[adm-drift-check] ${clientName} — schema OK ✓`);
      results.push({
        client_id:     clientId,
        client_name:   clientName,
        outcome:       'ok',
        actual_hash:   actualHash,
        expected_hash: expectedHash,
      });
      ok++;
    } else {
      await insertDriftIfNew(db, clientId, clientName, version, expectedHash, actualHash);
      results.push({
        client_id:     clientId,
        client_name:   clientName,
        outcome:       'drifted',
        actual_hash:   actualHash,
        expected_hash: expectedHash,
      });
      drifted++;
    }
  }

  const summary = {
    ok:         true,
    checked:    activeClients.length,
    ok_count:   ok,
    drifted,
    baselined,
    errors,
    results,
    ran_at:     new Date().toISOString(),
  };

  console.log(
    `[adm-drift-check] done — checked=${activeClients.length} ok=${ok} drifted=${drifted} ` +
    `baselined=${baselined} errors=${errors}`,
  );

  return json(summary);
});
