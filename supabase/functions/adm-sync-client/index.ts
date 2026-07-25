/**
 * adm-sync-client — REL-01 AC6
 *
 * Applies the tenant migrations from a specific release to a client Supabase project.
 * Called by scripts/sync-clients.js (manual / workflow_dispatch) and eventually
 * by the REL-02 "Atualizar" UI button.
 *
 * Flow:
 *   1. Resolve which release to apply (target_version or latest from adm_releases)
 *   2. Decrypt client credentials via adm_client_decrypted_secrets RPC
 *   3. Fetch list of already-applied migrations from client's supabase_migrations
 *   4. For each NEW client-side migration:
 *      a. Fetch SQL content from GitHub (git_sha + GITHUB_REPO)
 *      b. Apply via Supabase Management API /database/query
 *      c. Mark as applied in supabase_migrations.schema_migrations
 *   5. UPDATE adm_clients.current_version + INSERT adm_client_versions audit row
 *
 * Auth:  service_role only — Bearer must match SUPABASE_SERVICE_ROLE_KEY
 * Method: POST
 * Body:
 *   {
 *     "client_id":      "uuid",          // required — adm_clients.id
 *     "target_version": "4.70",          // optional — omit for latest release
 *     "triggered_by":   "github_actions",// optional audit field
 *     "reason":         "force sync"     // optional audit field
 *   }
 *
 * Response 200:
 *   { "ok": true, "applied": N, "failed": N, "skipped": N, "version": "4.70" }
 *   { "ok": false, "applied": N, "failed": N, "skipped": N, "version": "4.70", "errors": [...] }
 * Response 4xx/5xx:
 *   { "error": "..." }
 *
 * Required env vars:
 *   SUPABASE_URL               — control plane project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — control plane service role key
 *   GITHUB_REPO                — "owner/repo" (for fetching migration SQL by SHA)
 *
 * Optional env vars:
 *   GITHUB_TOKEN               — personal access token for private repo access
 *
 * ⚠️  DEPLOY: standard JWT verification is fine for this fn (service_role callers
 *     pass their own Bearer token verified in the auth gate below).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GITHUB_REPO     = Deno.env.get('GITHUB_REPO') ?? '';   // 'owner/repo'
const GITHUB_TOKEN    = Deno.env.get('GITHUB_TOKEN') ?? '';  // optional for private repos
const SUPABASE_MGMT   = 'https://api.supabase.com/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncBody {
  client_id:       string;
  target_version?: string;
  triggered_by?:   string;
  reason?:         string;
}

interface AdmRelease {
  id:              string;
  version:         string;
  git_sha:         string;
  migrations:      string[];
  min_compat_from: string;
  changelog:       string | null;
  is_baseline:     boolean;        // REL-05 AC3 — true for squashed baseline releases
  schema_hash:     string | null;  // REL-03 AC2 — canonical hash for drift detection
}

/** REL-05 AC4 — Compare semver-like strings ("4.70" > "4.50"). */
function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const [aMaj, aMin = 0] = parts(a);
  const [bMaj, bMin = 0] = parts(b);
  return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
}

interface MigrationError {
  name:  string;
  error: string;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);

  // ── Auth gate: service_role only ─────────────────────────────────────────
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== SUPABASE_KEY) {
    return json({ error: 'Unauthorized — service_role token required' }, 401);
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ── Parse + validate body ────────────────────────────────────────────────
  let body: SyncBody;
  try {
    body = await req.json() as SyncBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { client_id, target_version, triggered_by = 'unknown', reason } = body;

  if (!client_id || typeof client_id !== 'string') {
    return json({ error: 'Missing required field: client_id (uuid string)' }, 400);
  }

  if (!GITHUB_REPO) {
    return json({ error: 'GITHUB_REPO env var not configured — cannot fetch migration SQL' }, 500);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // ── Look up client ───────────────────────────────────────────────────────
  const { data: client, error: clientErr } = await db
    .from('adm_clients')
    .select('id, name, supabase_url, current_version')
    .eq('id', client_id)
    .eq('status', 'active')
    .maybeSingle();

  if (clientErr || !client) {
    const msg = clientErr?.message ?? 'not found or not active';
    console.error(`[adm-sync-client] client ${client_id}: ${msg}`);
    return json({ error: `Client not found or not active: ${client_id}` }, 404);
  }

  const clientRecord = client as {
    id: string;
    name: string;
    supabase_url: string;
    current_version: string | null;
  };

  // ── Look up release ──────────────────────────────────────────────────────
  let releaseData: AdmRelease | null = null;
  if (target_version) {
    const { data, error } = await db
      .from('adm_releases')
      .select('id, version, git_sha, migrations, min_compat_from, changelog, is_baseline, schema_hash')
      .eq('version', target_version)
      .maybeSingle();
    if (error || !data) {
      return json({ error: `Release not found: ${target_version}` }, 404);
    }
    releaseData = data as AdmRelease;
  } else {
    const { data, error } = await db
      .from('adm_releases')
      .select('id, version, git_sha, migrations, min_compat_from, changelog, is_baseline, schema_hash')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      return json({ error: 'No releases available in adm_releases' }, 404);
    }
    releaseData = data as AdmRelease;
  }

  const release = releaseData;

  // ── REL-05 AC4: min_compat_from compatibility check ─────────────────────
  // Skip check if current_version is null (new client — handled by AC3 below).
  if (clientRecord.current_version && release.min_compat_from) {
    if (compareVersions(clientRecord.current_version, release.min_compat_from) < 0) {
      console.error(
        `[adm-sync-client] ${clientRecord.name} — INCOMPATIBLE: ` +
        `current=${clientRecord.current_version} min_compat_from=${release.min_compat_from}`
      );
      return json({
        error:
          `Version incompatible: client is on v${clientRecord.current_version} but ` +
          `release v${release.version} requires min_compat_from=${release.min_compat_from}. ` +
          `Apply a baseline squash first or upgrade incrementally.`,
        code: 'VERSION_INCOMPATIBLE',
      }, 422);
    }
  }

  // ── REL-05 AC3: New client onboarding — detect baseline ─────────────────
  // When current_version IS NULL, look for the most recent baseline release.
  // If found (and it differs from the target), apply its migrations first so the
  // tenant starts from the consolidated schema rather than re-running all history.
  let baselineSegment: { gitSha: string; migrations: string[] } | null = null;
  if (!clientRecord.current_version) {
    const { data: baselineData } = await db
      .from('adm_releases')
      .select('version, git_sha, migrations, is_baseline')
      .eq('is_baseline', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (baselineData) {
      const bl = baselineData as { version: string; git_sha: string; migrations: string[]; is_baseline: boolean };
      // Only use as bootstrap if baseline version is <= target (don't apply future baseline)
      if (compareVersions(bl.version, release.version) <= 0 && bl.version !== release.version) {
        const blMigrations = (bl.migrations as string[]).filter(path => {
          const p = path.replace(/\\/g, '/');
          return p.includes('supabase/migrations/') && !p.includes('migrations_adm');
        });
        if (blMigrations.length > 0) {
          baselineSegment = { gitSha: bl.git_sha, migrations: blMigrations };
          console.log(
            `[adm-sync-client] ${clientRecord.name} — new client: prepending baseline ` +
            `v${bl.version} (${blMigrations.length} migrations) before target v${release.version}`
          );
        }
      }
    }
  }

  console.log(
    `[adm-sync-client] ${clientRecord.name} — version: ${release.version} ` +
    `git_sha: ${release.git_sha.substring(0, 8)} triggered_by: ${triggered_by}`
  );

  // ── Decrypt client credentials ───────────────────────────────────────────
  const { data: secretsRows } = await db.rpc('adm_client_decrypted_secrets', {
    p_client_id: client_id,
  });
  const secrets = (secretsRows as Array<{
    service_role_key: string;
    db_password: string;
    management_token: string;
  }> | null)?.[0];

  if (!secrets?.management_token) {
    return json({
      error: 'management_token not configured for this client. Set it in ADM → Credentials.',
    }, 422);
  }

  // ── Extract project ref from supabase_url ────────────────────────────────
  let projectRef: string;
  try {
    projectRef = new URL(clientRecord.supabase_url).hostname.split('.')[0];
    if (!projectRef || projectRef.length < 4) throw new Error('invalid ref');
  } catch {
    return json({ error: `Invalid supabase_url: ${clientRecord.supabase_url}` }, 422);
  }

  // ── Filter to client-side migrations only ────────────────────────────────
  // Exclude adm-only migrations (supabase/migrations_adm/) from tenant sync.
  // Include only paths under supabase/migrations/ (no _adm suffix).
  const allMigrations = (release.migrations as string[]);
  const clientMigrations = allMigrations.filter(path => {
    const normalized = path.replace(/\\/g, '/');
    return normalized.includes('supabase/migrations/') &&
           !normalized.includes('migrations_adm');
  });

  console.log(
    `[adm-sync-client] ${clientRecord.name} — release has ` +
    `${allMigrations.length} total migrations, ${clientMigrations.length} tenant-side`
  );

  // ── No tenant migrations (and no baseline to prepend) → adm-only release ──
  if (clientMigrations.length === 0 && !baselineSegment) {
    await recordClientVersion(db, client_id, clientRecord.current_version, release.version, 'success', reason);
    await updateClientVersion(db, client_id, release.version);
    await insertAuditLog(db, client_id, release.version, 0, 0, 0, triggered_by, reason);
    return json({ ok: true, applied: 0, failed: 0, skipped: 0, version: release.version,
      message: 'No tenant migrations in this release — version updated' });
  }

  // ── Fetch already-applied migrations from client DB ──────────────────────
  const appliedVersions = await getAppliedMigrations(secrets.management_token, projectRef);

  // ── Build ordered migration segments ─────────────────────────────────────
  // REL-05 AC3: For new clients, prepend baseline segment before the target release.
  // Each segment has its own git_sha so migrations are fetched from the correct tree.
  const migrationSegments: Array<{ gitSha: string; migPath: string }> = [];

  if (baselineSegment) {
    for (const migPath of baselineSegment.migrations) {
      migrationSegments.push({ gitSha: baselineSegment.gitSha, migPath });
    }
  }
  for (const migPath of clientMigrations) {
    migrationSegments.push({ gitSha: release.git_sha, migPath });
  }

  // ── Apply each migration ─────────────────────────────────────────────────
  let applied = 0;
  let skipped = 0;
  const errors: MigrationError[] = [];

  for (const { gitSha, migPath } of migrationSegments) {
    const filename = migPath.replace(/\\/g, '/').split('/').pop() ?? migPath;
    // Extract timestamp prefix — the first 14 digits of the filename
    const versionMatch = filename.match(/^(\d{14})/);
    const version = versionMatch?.[1] ?? filename.replace(/\.sql$/i, '');

    // Skip already-applied (idempotency)
    if (appliedVersions.has(version)) {
      console.log(`[adm-sync-client]   ${filename} — already applied ⏭`);
      skipped++;
      continue;
    }

    // Fetch SQL from GitHub using the release's git_sha
    let sql: string;
    try {
      sql = await fetchMigrationSql(gitSha, migPath);
    } catch (fetchErr) {
      const errMsg = (fetchErr as Error).message;
      console.error(`[adm-sync-client]   ${filename} — GitHub fetch failed: ${errMsg}`);
      errors.push({ name: filename, error: `GitHub fetch failed: ${errMsg}` });
      continue;
    }

    // Apply the migration SQL via Supabase Management API
    const applyResult = await applyMigrationSql(
      secrets.management_token,
      projectRef,
      version,
      filename,
      sql,
    );

    if (applyResult.ok) {
      console.log(`[adm-sync-client]   ${filename} — applied ✓`);
      applied++;
    } else {
      console.error(`[adm-sync-client]   ${filename} — failed: ${applyResult.error}`);
      errors.push({ name: filename, error: applyResult.error });
    }
  }

  const failed = errors.length;

  // ── Record results in control plane ─────────────────────────────────────
  const status = failed === 0 ? 'success' : applied > 0 ? 'partial' : 'failed';

  // Always insert an adm_client_versions row (audit trail — includes failed attempts)
  await recordClientVersion(db, client_id, clientRecord.current_version, release.version, status, reason);

  // Only update current_version if at least some migrations succeeded
  const totalMigs = migrationSegments.length;
  if (applied > 0 || (failed === 0 && skipped === totalMigs)) {
    // All were either applied or already done — client is at this version
    await updateClientVersion(db, client_id, release.version);
  }

  await insertAuditLog(db, client_id, release.version, applied, failed, skipped, triggered_by, reason);

  // ── REL-03 AC2 support: store schema_hash after successful sync ───────────
  // After a clean sync, compute the tenant's schema hash and cache it in
  // adm_releases.schema_hash (if not already set). adm-drift-check uses this
  // as the expected baseline for future drift comparisons.
  if (failed === 0 && !release.schema_hash && secrets.service_role_key) {
    try {
      const tenantDb = createClient(clientRecord.supabase_url, secrets.service_role_key, {
        auth: { persistSession: false },
      });
      const { data: hashData, error: hashErr } = await tenantDb.rpc('compute_schema_hash');
      if (!hashErr && hashData) {
        await db
          .from('adm_releases')
          .update({ schema_hash: hashData as string })
          .eq('version', release.version)
          .is('schema_hash', null); // race-safe: only update if still null
        console.log(
          `[adm-sync-client] ${clientRecord.name} — schema_hash stored for release ` +
          `${release.version}: ${(hashData as string).slice(0, 12)}...`
        );
      } else if (hashErr) {
        console.warn(`[adm-sync-client] compute_schema_hash non-fatal: ${hashErr.message}`);
      }
    } catch (e) {
      console.warn(`[adm-sync-client] schema_hash compute threw (non-fatal): ${(e as Error).message}`);
    }
  }

  console.log(
    `[adm-sync-client] ${clientRecord.name} done: ` +
    `applied=${applied} failed=${failed} skipped=${skipped} status=${status} version=${release.version}`
  );

  return json({
    ok:      failed === 0,
    applied,
    failed,
    skipped,
    version: release.version,
    ...(errors.length > 0 ? { errors } : {}),
  });
});

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
 * Returns the set of migration version timestamps already applied in the tenant project.
 * Queries supabase_migrations.schema_migrations via Management API.
 * Returns empty set on any error — caller will attempt to re-apply and rely on SQL idempotency.
 */
async function getAppliedMigrations(
  managementToken: string,
  projectRef: string,
): Promise<Set<string>> {
  try {
    const res = await fetch(`${SUPABASE_MGMT}/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managementToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        query: 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC',
      }),
    });

    if (!res.ok) {
      console.warn(`[adm-sync-client] getAppliedMigrations: HTTP ${res.status} — will not skip any`);
      return new Set();
    }

    // Management API returns rows as JSON array
    const data = await res.json() as Array<{ version: string }>;
    const versions = Array.isArray(data) ? data.map((r) => r.version) : [];
    console.log(`[adm-sync-client] client has ${versions.length} applied migrations`);
    return new Set(versions);
  } catch (e) {
    console.warn('[adm-sync-client] getAppliedMigrations exception:', (e as Error).message);
    return new Set();
  }
}

/**
 * Fetches migration SQL from GitHub using the release's git SHA.
 * Handles both public (no token) and private (GITHUB_TOKEN) repos.
 */
async function fetchMigrationSql(gitSha: string, migPath: string): Promise<string> {
  // Normalize path separators
  const normalizedPath = migPath.replace(/\\/g, '/');
  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${gitSha}/${normalizedPath}`;

  const headers: Record<string, string> = { Accept: 'text/plain' };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${normalizedPath} @ ${gitSha.substring(0, 8)}`);
  }
  const sql = await res.text();
  if (!sql.trim()) throw new Error(`Empty SQL content for ${normalizedPath}`);
  return sql;
}

/**
 * Applies a migration SQL file to the client project via Management API.
 * Two-step: execute DDL + record in supabase_migrations (separate call, non-fatal).
 */
async function applyMigrationSql(
  managementToken: string,
  projectRef: string,
  version: string,
  filename: string,
  sql: string,
): Promise<{ ok: boolean; error: string }> {
  const queryUrl = `${SUPABASE_MGMT}/projects/${projectRef}/database/query`;
  const headers = {
    'Authorization': `Bearer ${managementToken}`,
    'Content-Type':  'application/json',
  };

  // Step 1: apply the migration DDL
  try {
    const applyRes = await fetch(queryUrl, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ query: sql }),
    });

    if (!applyRes.ok) {
      const errText = await applyRes.text().catch(() => '');
      return { ok: false, error: `HTTP ${applyRes.status}: ${errText.substring(0, 500)}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Step 2: record in supabase_migrations (non-fatal — migration already applied)
  // Escape single quotes in values (filenames and versions only contain digits/underscores)
  const migName    = filename.replace(/\.sql$/i, '').replace(/'/g, "''");
  const safeVersion = version.replace(/'/g, "''");
  const trackSql   = [
    'INSERT INTO supabase_migrations.schema_migrations (version, name, statements)',
    `VALUES ('${safeVersion}', '${migName}', ARRAY[]::text[])`,
    'ON CONFLICT (version) DO NOTHING',
  ].join(' ');
  await fetch(queryUrl, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ query: trackSql }),
  }).catch((e: unknown) =>
    console.warn(
      `[adm-sync-client] tracking ${filename} in schema_migrations failed (non-fatal):`,
      (e as Error).message,
    )
  );

  return { ok: true, error: '' };
}

/**
 * Inserts a row in adm_client_versions for version audit trail.
 */
async function recordClientVersion(
  db:          ReturnType<typeof createClient>,
  clientId:    string,
  fromVersion: string | null,
  toVersion:   string,
  status:      'success' | 'failed' | 'partial',
  reason:      string | undefined,
): Promise<void> {
  const { error } = await db.from('adm_client_versions').insert({
    client_id:    clientId,
    from_version: fromVersion ?? null,
    to_version:   toVersion,
    applied_at:   new Date().toISOString(),
    applied_by:   null,   // system — no authenticated user in service_role context
    status,
    error_summary: status !== 'success'
      ? `sync ${status}${reason ? ` — ${reason}` : ''}`
      : null,
  });
  if (error) {
    console.warn('[adm-sync-client] recordClientVersion (non-fatal):', error.message);
  }
}

/**
 * Updates adm_clients.current_version.
 */
async function updateClientVersion(
  db:       ReturnType<typeof createClient>,
  clientId: string,
  version:  string,
): Promise<void> {
  const { error } = await db
    .from('adm_clients')
    .update({ current_version: version })
    .eq('id', clientId);
  if (error) {
    console.warn('[adm-sync-client] updateClientVersion (non-fatal):', error.message);
  }
}

/**
 * Inserts a row in adm_audit_log.
 */
async function insertAuditLog(
  db:          ReturnType<typeof createClient>,
  clientId:    string,
  version:     string,
  applied:     number,
  failed:      number,
  skipped:     number,
  triggeredBy: string,
  reason:      string | undefined,
): Promise<void> {
  await db.from('adm_audit_log').insert({
    action:    'client.sync',
    actor_id:  null,
    target_id: clientId,
    details:   { version, applied, failed, skipped, triggered_by: triggeredBy, reason: reason ?? null },
  }).then(({ error }) => {
    if (error) console.warn('[adm-sync-client] audit log (non-fatal):', error.message);
  });
}
