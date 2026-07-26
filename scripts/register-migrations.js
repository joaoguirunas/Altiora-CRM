#!/usr/bin/env node
/**
 * Register client migrations into adm_migrations catalog.
 *
 * Reads supabase/client-migrations.json manifest, checks which entries
 * are missing or have changed sql_content in adm_migrations, then
 * inserts missing ones and patches changed ones with current file content.
 *
 * Required env:
 *   CONTROL_PLANE_URL              – Growth Sales Supabase URL
 *   CONTROL_PLANE_SERVICE_ROLE_KEY – service_role key of control plane
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Standalone guard ──────────────────────────────────────────────────────────
const __rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(__rootDir, '.standalone'))) {
  console.error('🚫  STANDALONE MODE — registering migrations to a control plane is disabled in this repo.');
  console.error('    Delete .standalone at the project root to enable this in a derived project.');
  process.exit(1);
}


const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONTROL_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CONTROL_KEY = process.env.CONTROL_PLANE_SERVICE_ROLE_KEY;

if (!CONTROL_URL || !CONTROL_KEY) {
  console.error('❌  CONTROL_PLANE_URL and CONTROL_PLANE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

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

function readMigrationSQL(entry) {
  const migrationsDir = join(ROOT, 'supabase', 'migrations');

  if (entry.files) {
    // Multiple files → concatenate SQL
    return entry.files
      .map(f => readFileSync(join(migrationsDir, f), 'utf8'))
      .join('\n\n-- ═══ next file ═══\n\n');
  }

  return readFileSync(join(migrationsDir, entry.file), 'utf8');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Register Client Migrations');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Load manifest
  const manifestPath = join(ROOT, 'supabase', 'client-migrations.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  console.log(`\n  Manifest: ${manifest.length} entries`);

  // 2. Fetch existing entries from adm_migrations (name + sql_content hash for diff)
  const existing = await sb('adm_migrations?select=name,sql_content');
  const existingMap = new Map(existing.map(e => [e.name, e.sql_content]));
  console.log(`  Catalog:  ${existingMap.size} entries already registered`);

  // 3. Split manifest into missing (INSERT) and changed (UPDATE)
  const toInsert = [];
  const toUpdate = [];

  for (const entry of manifest) {
    const sql = readMigrationSQL(entry);
    if (!existingMap.has(entry.name)) {
      toInsert.push({ entry, sql });
    } else if (existingMap.get(entry.name) !== sql) {
      toUpdate.push({ entry, sql });
    }
  }

  console.log(`  Missing:  ${toInsert.length} to register`);
  console.log(`  Changed:  ${toUpdate.length} to update\n`);

  if (toInsert.length === 0 && toUpdate.length === 0) {
    console.log('  ✅ All migrations already registered and up-to-date. Nothing to do.');
    return;
  }

  // 4. Insert missing entries + update changed entries
  let registered = 0;
  let updated = 0;
  let failed = 0;

  for (const { entry, sql } of toInsert) {
    try {
      const fileRef = entry.files ? entry.files.join(' + ') : entry.file;
      await sb('adm_migrations', {
        method: 'POST',
        body: JSON.stringify({
          name:        entry.name,
          order_index: entry.order_index,
          sql_content: sql,
        }),
      });
      console.log(`  ✓ [INSERT] ${entry.name} (${fileRef})`);
      registered++;
    } catch (err) {
      console.error(`  ✗ ${entry.name}: ${err.message}`);
      failed++;
    }
  }

  for (const { entry, sql } of toUpdate) {
    try {
      const fileRef = entry.files ? entry.files.join(' + ') : entry.file;
      await sb(`adm_migrations?name=eq.${encodeURIComponent(entry.name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sql_content: sql }),
      });
      console.log(`  ✓ [UPDATE] ${entry.name} (${fileRef})`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${entry.name}: ${err.message}`);
      failed++;
    }
  }

  // 5. Report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Registered: ${registered}  Updated: ${updated}  Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌  Erro fatal:', err.message || err);
  process.exit(1);
});
