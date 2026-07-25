/**
 * adm-baseline-check — REL-05 AC5
 *
 * Verifica semanalmente se o número de migrations incrementais (não-baseline)
 * desde o último baseline excede o threshold configurado.
 * Se sim: notifica super-admins inserindo entrada em `adm_audit_log` + log WARNING.
 *
 * Acionamento:
 *   - pg_cron `adm-baseline-check-weekly` (sábados 5h UTC)
 *   - Cron body: { "threshold": 100 }
 *
 * Lógica:
 *   1. Busca o release mais recente com `is_baseline = true` em `adm_releases`.
 *   2. Conta releases NÃO-baseline criadas APÓS o baseline (ou todas se não houver baseline).
 *   3. Se count > threshold: INSERT em `adm_audit_log` + retorna { needs_squash: true }.
 *   4. Caso contrário: { needs_squash: false }.
 *
 * Auth: service_role only (Bearer === SUPABASE_SERVICE_ROLE_KEY)
 * Method: POST
 * Body: { threshold?: number }  (default: 100)
 *
 * Response 200:
 *   {
 *     ok: true,
 *     needs_squash: boolean,
 *     incremental_count: number,
 *     threshold: number,
 *     last_baseline?: string,   // version string ou null
 *     checked_at: string
 *   }
 *
 * Env vars:
 *   SUPABASE_URL              — control plane URL
 *   SUPABASE_SERVICE_ROLE_KEY — control plane service role key
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const DEFAULT_THRESHOLD = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CheckBody {
  threshold?: number;
}

interface AdmRelease {
  id:          string;
  version:     string;
  is_baseline: boolean;
  created_at:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);

  // ── Auth gate: service_role only ──────────────────────────────────────────
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== SUPABASE_KEY) {
    return json({ error: 'Unauthorized — service_role token required' }, 401);
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Parse body (optional) ────────────────────────────────────────────────
  let threshold = DEFAULT_THRESHOLD;
  if (req.method === 'POST') {
    try {
      const body = await req.json() as CheckBody;
      if (typeof body.threshold === 'number' && body.threshold > 0) {
        threshold = body.threshold;
      }
    } catch {
      // Empty body or parse failure → use default threshold
    }
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  console.log(`[adm-baseline-check] starting weekly check (threshold=${threshold})`);

  // ── Fetch all releases ordered by creation date ───────────────────────────
  const { data: releases, error: relErr } = await db
    .from('adm_releases')
    .select('id, version, is_baseline, created_at')
    .order('created_at', { ascending: false });

  if (relErr) {
    console.error(`[adm-baseline-check] failed to fetch releases: ${relErr.message}`);
    return json({ error: `Failed to fetch releases: ${relErr.message}` }, 500);
  }

  const allReleases = (releases ?? []) as AdmRelease[];

  if (allReleases.length === 0) {
    console.log('[adm-baseline-check] no releases found — nothing to check');
    return json({
      ok:                true,
      needs_squash:      false,
      incremental_count: 0,
      threshold,
      last_baseline:     null,
      checked_at:        new Date().toISOString(),
    });
  }

  // ── Find the most recent baseline ─────────────────────────────────────────
  // allReleases is DESC order, so first baseline found = most recent
  const lastBaseline = allReleases.find(r => r.is_baseline) ?? null;

  let incrementalCount: number;
  if (lastBaseline) {
    // Count releases created AFTER the last baseline (non-baseline ones = delta)
    const baselineDate = lastBaseline.created_at;
    incrementalCount = allReleases.filter(
      r => !r.is_baseline && r.created_at > baselineDate,
    ).length;
  } else {
    // No baseline yet — count ALL non-baseline releases as incremental
    incrementalCount = allReleases.filter(r => !r.is_baseline).length;
  }

  const needsSquash = incrementalCount > threshold;

  console.log(
    `[adm-baseline-check] incremental_count=${incrementalCount} threshold=${threshold} ` +
    `last_baseline=${lastBaseline?.version ?? 'none'} needs_squash=${needsSquash}`,
  );

  // ── Notify if squash needed ───────────────────────────────────────────────
  if (needsSquash) {
    const message =
      `REL-05 baseline check: ${incrementalCount} incremental migrations since ` +
      `${lastBaseline ? `v${lastBaseline.version}` : 'beginning'} exceeds threshold ${threshold}. ` +
      `Consider running squash-baseline.js to consolidate migrations.`;

    console.warn(`[adm-baseline-check] ⚠️  ${message}`);

    // Insert into adm_audit_log so super-admins can see it in the control panel
    const { error: auditErr } = await db.from('adm_audit_log').insert({
      action:    'baseline.squash_needed',
      actor_id:  null,
      target_id: null,
      details:   {
        incremental_count: incrementalCount,
        threshold,
        last_baseline_version: lastBaseline?.version ?? null,
        last_baseline_date:    lastBaseline?.created_at ?? null,
        message,
      },
    });

    if (auditErr) {
      console.warn(`[adm-baseline-check] audit log insert non-fatal: ${auditErr.message}`);
    }
  }

  return json({
    ok:                true,
    needs_squash:      needsSquash,
    incremental_count: incrementalCount,
    threshold,
    last_baseline:     lastBaseline?.version ?? null,
    checked_at:        new Date().toISOString(),
  });
});
