/**
 * adm-releases-register — REL-01 AC4
 *
 * Registers a new release in the `adm_releases` control-plane table.
 * Called by the CI workflow `release-tag.yml` after each merge to main
 * that includes migration changes.
 *
 * Auth: service_role only (Authorization: Bearer <service_role_key>)
 * Method: POST
 * Body:
 *   {
 *     "version": "4.70",
 *     "git_sha": "abc1234...",
 *     "migrations": ["20260726000000_foo.sql", ...],
 *     "min_compat_from": "1.0",
 *     "changelog": "feat: ...",
 *     "is_baseline": false           // optional, default false
 *   }
 *
 * Response 200: { "ok": true, "inserted": true|false }
 * Response 400: { "error": "..." }
 * Response 401: unauthorized
 *
 * Idempotent: ON CONFLICT (version) DO NOTHING — safe to re-run.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReleasePayload {
  version:         string;
  git_sha:         string;
  migrations:      string[];
  min_compat_from?: string;
  changelog?:      string;
  is_baseline?:    boolean;
}

Deno.serve(async (req: Request) => {
  // ── Auth gate ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  // Only service_role may register releases — verify against the actual key
  if (token !== SUPABASE_SERVICE_KEY) {
    return json({ error: 'Unauthorized — service_role token required' }, 401);
  }

  // ── Method check ─────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let payload: ReleasePayload;
  try {
    payload = await req.json() as ReleasePayload;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // ── Validate required fields ─────────────────────────────────────────────────
  const { version, git_sha, migrations } = payload;
  if (!version || typeof version !== 'string') {
    return json({ error: 'Missing required field: version (string)' }, 400);
  }
  if (!git_sha || typeof git_sha !== 'string') {
    return json({ error: 'Missing required field: git_sha (string)' }, 400);
  }
  if (!Array.isArray(migrations)) {
    return json({ error: 'Missing required field: migrations (array)' }, 400);
  }

  // Sanitise version — must match semver-like pattern
  if (!version.match(/^\d+\.\d+(\.\d+)?$/)) {
    return json({ error: `Invalid version format: "${version}". Expected: "major.minor" or "major.minor.patch"` }, 400);
  }

  // ── Build insert row ─────────────────────────────────────────────────────────
  const row = {
    version,
    git_sha,
    migrations,
    min_compat_from: payload.min_compat_from ?? '1.0',
    changelog:       payload.changelog ?? null,
    is_baseline:     payload.is_baseline ?? false,
  };

  // ── Supabase admin client ────────────────────────────────────────────────────
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── INSERT (idempotente — ON CONFLICT (version) DO NOTHING) ─────────────────
  const { data, error, status } = await db
    .from('adm_releases')
    .insert(row)
    .select('id, version')
    .maybeSingle();

  if (error && status !== 409) {
    // 409 = unique violation (version already registered) → OK, idempotent
    console.error('[adm-releases-register] DB error:', error.message);
    return json({ error: `DB insert failed: ${error.message}` }, 500);
  }

  const inserted = !!data;

  // ── Audit log ────────────────────────────────────────────────────────────────
  if (inserted) {
    await db.from('adm_audit_log').insert({
      action:    'release.registered',
      actor_id:  null,  // system / CI
      target_id: data.id,
      details:   { version, migrations_count: migrations.length, is_baseline: row.is_baseline },
    }).then(({ error: auditErr }) => {
      if (auditErr) {
        console.warn('[adm-releases-register] audit log insert failed (non-fatal):', auditErr.message);
      }
    });

    console.log(`[adm-releases-register] Registered release ${version} (${migrations.length} migrations, git_sha: ${git_sha.slice(0, 8)})`);
  } else {
    console.log(`[adm-releases-register] Release ${version} already registered — skipped (idempotent).`);
  }

  return json({ ok: true, inserted, version });
});

// ── Helper ───────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
