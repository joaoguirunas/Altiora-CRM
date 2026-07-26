#!/usr/bin/env node
/**
 * REVOS — Client Sync Script
 *
 * Applies migrations to all active client Supabase projects by invoking
 * the adm-sync-client edge function via HTTP (avoids IPv6 issues on GitHub
 * Actions runners that can't reach db.PROJECT.supabase.co:5432 over IPv6).
 *
 * Required env:
 *   CONTROL_PLANE_URL              – Growth Sales Supabase URL
 *   CONTROL_PLANE_SERVICE_ROLE_KEY – service_role key of control plane
 *
 * Optional env:
 *   CLIENT_SLUG   – sync only this client (by slug)
 *   TRIGGERED_BY  – 'github_actions' | 'manual' (default: 'github_actions')
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Standalone guard ──────────────────────────────────────────────────────────
// While .standalone exists at the project root, this script refuses to run.
// Delete .standalone only in fully configured multi-tenant deployments.
const __rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(__rootDir, '.standalone'))) {
  console.error('🚫  STANDALONE MODE — multi-tenant sync is disabled in this repo.');
  console.error('    Delete .standalone at the project root to enable sync in a derived project.');
  process.exit(1);
}

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const CONTROL_URL  = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CONTROL_KEY  = process.env.CONTROL_PLANE_SERVICE_ROLE_KEY;
const CLIENT_SLUG  = process.env.CLIENT_SLUG || null;
const TRIGGERED_BY = process.env.TRIGGERED_BY || 'github_actions';

// Read current system version from version.json
let SYSTEM_VERSION = null;
try {
  const vJson = JSON.parse(readFileSync('version.json', 'utf8'));
  SYSTEM_VERSION = vJson.version;
} catch (_) {}

if (!CONTROL_URL || !CONTROL_KEY) {
  console.error('❌  CONTROL_PLANE_URL and CONTROL_PLANE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

// ─── Supabase REST helpers ────────────────────────────────────────────────────

const headers = {
  'apikey':        CONTROL_KEY,
  'Authorization': `Bearer ${CONTROL_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

async function sb(path, options = {}) {
  const url = `${CONTROL_URL}/rest/v1/${path}`;
  const res = await fetch(url, { headers, ...options });
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function getClients() {
  let qs = 'adm_clients?status=eq.active&order=created_at.asc&select=id,name,slug,supabase_url,db_version';
  if (CLIENT_SLUG) qs += `&slug=eq.${encodeURIComponent(CLIENT_SLUG)}`;
  return sb(qs);
}

async function getDecryptedToken(clientId) {
  const result = await sb('rpc/adm_client_decrypted_secrets', {
    method: 'POST',
    body: JSON.stringify({ p_client_id: clientId }),
  });
  return result?.[0]?.management_token || null;
}

async function updateClient(clientId, updates) {
  await sb(`adm_clients?id=eq.${clientId}`, {
    method:  'PATCH',
    body:    JSON.stringify(updates),
    headers: { ...headers, Prefer: 'return=minimal' },
  });
}

// ─── Per-client helpers ───────────────────────────────────────────────────────

async function applyMigrations(client) {
  // Calls adm-sync-client edge function via HTTP — avoids IPv6 TCP issue
  const fnUrl = `${CONTROL_URL}/functions/v1/adm-sync-client`;
  const res = await fetch(fnUrl, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${CONTROL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: client.id }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error ?? JSON.stringify(body)}`);
  if (body?.error) throw new Error(body.error);
  const applied = body.applied ?? 0;
  const failed = body.failed ?? 0;
  console.log(`  migrations → applied: ${applied}  failed: ${failed}`);
  if (body.errors?.length) {
    for (const e of body.errors) {
      console.error(`    ✗ ${e.name}: ${e.error?.substring(0, 200)}`);
    }
  }
  if (failed > 0 && applied === 0) throw new Error(`All ${failed} migration(s) failed — possible connection error`);
  if (failed > 0) console.warn(`  ⚠  ${failed} migration(s) failed (${applied} succeeded) — partial success`);
  return body;
}

function extractProjectRef(supabaseUrl) {
  return new URL(supabaseUrl).hostname.split('.')[0];
}

function getNoJwtFunctions() {
  // Read supabase/config.toml and extract functions with verify_jwt = false
  try {
    const configPath = join(__dirname, '..', 'supabase', 'config.toml');
    const config = readFileSync(configPath, 'utf8');
    const noJwt = [];
    const fnSectionRegex = /\[functions\.([^\]]+)\]\s*\n(?:.*\n)*?verify_jwt\s*=\s*false/g;
    let match;
    while ((match = fnSectionRegex.exec(config)) !== null) {
      noJwt.push(match[1]);
    }
    return noJwt;
  } catch {
    return [];
  }
}

function deployFunctions(projectRef, managementToken) {
  // Use client-specific management token if available, otherwise fall back to env
  const token = managementToken || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.log('  functions → nenhum management token disponível, pulando.');
    return;
  }
  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };

  // supabase functions deploy uses HTTP Management API — no IPv6 issue
  const out = execSync(`supabase functions deploy --project-ref ${projectRef}`, {
    stdio: 'pipe',
    timeout: 10 * 60 * 1000,
    env,
  }).toString().trim();
  const lines = out.split('\n').filter(Boolean);
  lines.forEach(l => console.log(`  ${l}`));

  // Re-deploy functions with verify_jwt=false to ensure --no-verify-jwt is applied.
  const noJwtFns = getNoJwtFunctions();
  if (noJwtFns.length > 0) {
    console.log(`  functions → applying --no-verify-jwt to: ${noJwtFns.join(', ')}`);
    for (const fn of noJwtFns) {
      execSync(`supabase functions deploy ${fn} --no-verify-jwt --project-ref ${projectRef}`, {
        stdio: 'pipe',
        timeout: 3 * 60 * 1000,
        env,
      });
    }
  }

  console.log('  functions → OK');
}

async function syncClient(client) {
  const migResult = await applyMigrations(client);

  // Deploy all edge functions to the client's Supabase project.
  // management_token is pgcrypto-encrypted at rest (ADR-ADM-02) — must decrypt via RPC.
  const projectRef = extractProjectRef(client.supabase_url);
  const decryptedToken = await getDecryptedToken(client.id);
  deployFunctions(projectRef, decryptedToken);

  return migResult;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  REVOS — Client Sync');
  console.log(`  trigger: ${TRIGGERED_BY}${CLIENT_SLUG ? ` | target: ${CLIENT_SLUG}` : ''}`);
  if (SYSTEM_VERSION) console.log(`  system version: ${SYSTEM_VERSION}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const clients = await getClients();

  if (!clients || clients.length === 0) {
    console.log('ℹ  Nenhum cliente ativo encontrado. Nada a sincronizar.');
    return;
  }

  console.log(`\n  ${clients.length} cliente(s) para sincronizar:\n`);
  clients.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (${c.slug})`));
  console.log('');

  const results = { success: 0, partial: 0, failed: 0 };

  for (const client of clients) {
    console.log(`\n▶  ${client.name}`);

    try {
      let migResult = await syncClient(client);

      // Client-level retry: if some migrations failed, wait 30s and try once more.
      // Only retries — no infinite loop. Second attempt is definitive.
      if (migResult && (migResult.failed ?? 0) > 0) {
        console.log(`  ⟳ ${client.name} — ${migResult.failed} migration(s) failed, retrying in 30s...`);
        await new Promise(r => setTimeout(r, 30_000));
        try {
          migResult = await syncClient(client);
        } catch (retryErr) {
          console.error(`  ✗ ${client.name} — retry also failed: ${retryErr.message || retryErr}`);
        }
      }

      if (SYSTEM_VERSION) {
        await updateClient(client.id, { db_version: SYSTEM_VERSION }).catch(() => {});
      }

      if (migResult && (migResult.failed ?? 0) > 0) {
        console.log(`  ~ ${client.name} — PARTIAL (some migrations failed after retry)`);
        results.partial++;
      } else {
        console.log(`  ✓ ${client.name} — OK`);
        results.success++;
      }

    } catch (err) {
      const errorMsg = err.message || String(err);
      console.error(`  ✗ ${client.name} — FAILED: ${errorMsg}`);
      results.failed++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Resultado: ✓ ${results.success} ok  ~ ${results.partial} parcial  ✗ ${results.failed} falhou`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Exit 1 only if ALL clients had total failure (zero migrations applied)
  if (results.failed > 0 && results.success === 0 && results.partial === 0) {
    process.exit(1);
  }
  if (results.partial > 0 || results.failed > 0) {
    console.warn('⚠  Some clients had partial or failed syncs — review logs above.');
  }
}

main().catch((err) => {
  console.error('\n❌  Erro fatal:', err.message || err);
  process.exit(1);
});
