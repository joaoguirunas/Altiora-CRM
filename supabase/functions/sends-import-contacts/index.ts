/**
 * SENDS-IMPORT-CONTACTS
 *
 * POST /sends-import-contacts
 *
 * Processes an imported contact list for SENDS PRO campaigns:
 *   1. Normalizes phone numbers (last 11 digits, strip non-digits)
 *   2. Deduplicates against clients_people (whatsapp / phone / email)
 *   3. Creates new clients_people when no match found
 *   4. Optionally inserts lead_field_values for person extra fields (entity_type='pessoa')
 *   5. Optionally creates leads + lead_field_values when create_leads=true
 *   6. Persists Q-fields (q1_*...q26_*) directly in clients_people columns
 *   7. Optionally deduplicates and links clients_companies via company_struct
 *   8. Tracks progress in sends_import_sessions
 *   9. Returns people_ids for sends_contacts population
 *
 * ⚠️ DEPLOY: supabase functions deploy sends-import-contacts --no-verify-jwt
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportContactsInput {
  rows: Array<Record<string, string>>;
  field_mapping: {
    name: string;
    whatsapp?: string;
    email?: string;
    company?: string;                    // legacy — ignored, log warning only
    lead_control?: string;               // CSV column whose value sets leads.control per row
    crm_extra?: Record<string, string>;      // { [field_key]: header_csv } — pessoa entity
    empresa_extra?: Record<string, string>;  // { [field_key]: header_csv } — empresa entity
    lead_extra?: Record<string, string>;     // { [field_key]: header_csv } — negocio/lead entity
    score_cat?: Record<string, string>;                    // { [categoryId]: csvHeader }
    value_maps?: Record<string, Record<string, string>>;   // { ["score_cat:categoryId"]: { [csvValue]: itemId } }
    q_field?: Record<string, string>;   // { [q_column_key]: csvHeader }
    company_struct?: Record<string, string>; // { [company_field]: csvHeader }
    lead_cols?: Record<string, string>; // { [native_col_key]: csvHeader } — native leads table columns
  };
  create_leads: boolean;
  pipeline_id?: string;
  stage_id?: string;
  channel: string;
  send_id?: string;
  lead_control?: string;     // value set on leads.control for all imported leads
  score_matrix_id?: string;  // direct score matrix to assign to all imported leads
  assign_user_id?: string;   // settings_users.id to assign as lead owner
  assign_team_id?: string;   // settings_teams.id to assign as lead team
  origem_lista?: string;     // saved to leads.origem_lista for all imported leads
}

interface ImportContactsOutput {
  session_id: string;
  new_people: number;
  existing_people: number;
  failed_rows: number;
  total: number;
  people_ids: string[];
  contacts: Array<{ people_id: string; whatsapp: string | null; email: string | null }>;
}

// ── Phone normalization ───────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  // Strip non-digits and leading zeros (international access codes like 00/0)
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  // Already has BR country code (55) + 10–11 digit local number → keep as-is
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // Local BR number (10–11 digits without DDI) → add 55
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  // Other formats (too short, international non-BR) → return stripped digits
  return digits;
}

// ── String normalization for company dedup ────────────────────────────────────

function normalizeCompanyName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let body: ImportContactsInput;
  try {
    body = await req.json() as ImportContactsInput;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const {
    rows, field_mapping, create_leads, pipeline_id, stage_id, send_id,
    lead_control, score_matrix_id, assign_user_id, assign_team_id, origem_lista,
  } = body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return new Response(
      JSON.stringify({ error: 'rows is required and must be a non-empty array' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!field_mapping?.name) {
    return new Response(
      JSON.stringify({ error: 'field_mapping.name is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Create import session ─────────────────────────────────────────────────

  const { data: session, error: sessionError } = await supabase
    .from('sends_import_sessions')
    .insert({
      send_id: send_id ?? null,
      status: 'processing',
      total_rows: rows.length,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ error: 'Failed to create import session', details: sessionError?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const sessionId = session.id as string;

  // ── Pre-fetch field definition ID maps (once, outside the per-row loop) ─────

  const { crm_extra, empresa_extra, lead_extra, score_cat, value_maps, q_field, company_struct, lead_cols } = field_mapping;

  // Defensive handler for legacy payload containing company simple field (no-op, 1-release warning)
  if (field_mapping.company) {
    console.warn('[sends-import-contacts] field_mapping.company is deprecated and ignored. Use company_struct instead.');
  }

  // Helper: resolve score_matrix_id for a given CSV row
  async function resolveScoreMatrixId(row: Record<string, string>): Promise<string | null> {
    if (!score_cat || Object.keys(score_cat).length === 0) return null;

    const categorySelections: Record<string, string[]> = {};
    for (const [categoryId, csvHeader] of Object.entries(score_cat)) {
      const csvValue = row[csvHeader]?.trim();
      if (!csvValue) continue;
      const mapKey = `score_cat:${categoryId}`;
      const itemId = value_maps?.[mapKey]?.[csvValue];
      if (!itemId) continue;
      categorySelections[categoryId] = [itemId];
    }

    if (Object.keys(categorySelections).length === 0) return null;

    const { data: match } = await supabase
      .from('score_matrix')
      .select('id')
      .contains('category_selections', categorySelections)
      .limit(1)
      .maybeSingle();

    return match ? (match.id as string) : null;
  }

  // Extract Q-field values from a row — returns all entries (null for empty)
  function extractQFieldValues(row: Record<string, string>): Record<string, string | null> {
    if (!q_field || Object.keys(q_field).length === 0) return {};
    const result: Record<string, string | null> = {};
    for (const [qKey, csvHeader] of Object.entries(q_field)) {
      const v = row[csvHeader]?.trim();
      result[qKey] = v && v.length > 0 ? v : null;
    }
    return result;
  }

  // Extract company struct values from a row (only non-empty values)
  function extractCompanyStructValues(row: Record<string, string>): Record<string, string> {
    if (!company_struct || Object.keys(company_struct).length === 0) return {};
    const result: Record<string, string> = {};
    for (const [compKey, csvHeader] of Object.entries(company_struct)) {
      const v = row[csvHeader]?.trim();
      if (v) result[compKey] = v;
    }
    return result;
  }

  // Resolve or create a company and return its ID
  async function resolveCompanyId(companyValues: Record<string, string>): Promise<string | null> {
    const tradeName = companyValues.trade_name;
    const legalName = companyValues.legal_name;
    const taxId     = companyValues.tax_id;

    const hasAnyValue = tradeName || legalName || taxId ||
      companyValues.address || companyValues.website ||
      companyValues.email || companyValues.phone;

    if (!hasAnyValue) return null;

    let existingId: string | null = null;

    // Dedup by tax_id first
    if (taxId) {
      const { data: byTaxId } = await supabase
        .from('clients_companies')
        .select('id')
        .eq('tax_id', taxId)
        .limit(1)
        .maybeSingle();
      if (byTaxId) existingId = byTaxId.id as string;
    }

    // Dedup by trade_name (normalized) if no tax_id match
    if (!existingId && tradeName) {
      const normalized = normalizeCompanyName(tradeName);
      const { data: byName } = await supabase
        .from('clients_companies')
        .select('id, trade_name')
        .ilike('trade_name', normalized)
        .limit(5);

      if (byName && byName.length > 0) {
        const match = (byName as Array<{ id: string; trade_name: string }>).find(
          (c) => normalizeCompanyName(c.trade_name) === normalized,
        );
        if (match) existingId = match.id;
      }
    }

    if (existingId) return existingId;

    // Insert new company — trade_name is NOT NULL, fallback chain
    const effectiveTradeName = tradeName || legalName || 'Empresa sem nome';
    const insertPayload: Record<string, string> = { trade_name: effectiveTradeName };
    if (legalName)               insertPayload.legal_name = legalName;
    if (taxId)                   insertPayload.tax_id = taxId;
    if (companyValues.address)   insertPayload.address = companyValues.address;
    if (companyValues.website)   insertPayload.website = companyValues.website;
    if (companyValues.email)     insertPayload.email = companyValues.email;
    if (companyValues.phone)     insertPayload.phone = companyValues.phone;

    const { data: newCompany, error: companyError } = await supabase
      .from('clients_companies')
      .insert(insertPayload)
      .select('id')
      .single();

    if (companyError || !newCompany) return null;
    return newCompany.id as string;
  }

  // Link person to company via clients_people_companies
  async function linkPersonToCompany(peopleId: string, companyId: string): Promise<void> {
    // Check if any association already exists for this person (to set is_primary correctly)
    const { data: existing } = await supabase
      .from('clients_people_companies')
      .select('id')
      .eq('people_id', peopleId)
      .limit(1)
      .maybeSingle();

    const isPrimary = !existing;

    await supabase
      .from('clients_people_companies')
      .upsert(
        { people_id: peopleId, company_id: companyId, is_primary: isPrimary },
        { onConflict: 'people_id,company_id', ignoreDuplicates: true },
      );
  }

  // Map of field_key → field_definition_id for pessoa fields
  const personFieldDefs: Record<string, string> = {};
  if (crm_extra && Object.keys(crm_extra).length > 0) {
    const { data: defs } = await supabase
      .from('lead_field_definitions')
      .select('id, key')
      .eq('entity_type', 'pessoa')
      .in('key', Object.keys(crm_extra));
    for (const def of defs ?? []) {
      personFieldDefs[(def as { id: string; key: string }).key] = (def as { id: string; key: string }).id;
    }
  }

  // Map of field_key → field_definition_id for empresa fields
  const empresaFieldDefs: Record<string, string> = {};
  if (empresa_extra && Object.keys(empresa_extra).length > 0) {
    const { data: defs } = await supabase
      .from('lead_field_definitions')
      .select('id, key')
      .eq('entity_type', 'empresa')
      .in('key', Object.keys(empresa_extra));
    for (const def of defs ?? []) {
      empresaFieldDefs[(def as { id: string; key: string }).key] = (def as { id: string; key: string }).id;
    }
  }

  // Map of field_key → field_definition_id for lead-level fields (pipeline-scoped)
  // Supports entity_type = 'negocio' (legacy) and 'lead' (current ORA convention)
  const negocioFieldDefs: Record<string, string> = {};
  if (create_leads && lead_extra && Object.keys(lead_extra).length > 0 && pipeline_id) {
    const { data: defs } = await supabase
      .from('lead_field_definitions')
      .select('id, key')
      .in('entity_type', ['negocio', 'lead'])
      .eq('pipeline_id', pipeline_id)
      .in('key', Object.keys(lead_extra));
    for (const def of defs ?? []) {
      negocioFieldDefs[(def as { id: string; key: string }).key] = (def as { id: string; key: string }).id;
    }
  }

  // ── FIX-SENDS-IMPORT-04: Bulk processing ─────────────────────────────────
  // Replaces N+1 per-row dedup+insert pattern with batch-level bulk operations.
  // Key phases per batch: bulk dedup → bulk INSERT new persons → bulk lead ops.
  // Per-person ops (q_fields, empresa_extra, score_matrix) kept as N+1 but with
  // in-memory caches to deduplicate repeated DB lookups.

  // BATCH_SIZE increased to 500 (was 100) — bulk ops amortize overhead across more rows.
  // MAX_OR_CLAUSES: PostgREST builds URL query strings; keep OR clause count below URL limit.
  const BATCH_SIZE = 500;
  const MAX_OR_CLAUSES = 300; // safe limit: 300 ilike/eq clauses per query

  // In-memory caches for repeated lookups within the same function invocation
  const scoreMatrixCache = new Map<string, string | null>(); // cacheKey → matrixId
  const companyCache = new Map<string, string | null>();     // taxId or normalizedName → companyId

  // Cached score_matrix resolver — avoids 1 DB query per row when the same score combo repeats
  async function resolveScoreMatrixIdCached(row: Record<string, string>): Promise<string | null> {
    if (!score_cat || Object.keys(score_cat).length === 0) return null;
    const categorySelections: Record<string, string[]> = {};
    for (const [categoryId, csvHeader] of Object.entries(score_cat)) {
      const csvValue = row[csvHeader]?.trim();
      if (!csvValue) continue;
      const mapKey = `score_cat:${categoryId}`;
      const itemId = value_maps?.[mapKey]?.[csvValue];
      if (!itemId) continue;
      categorySelections[categoryId] = [itemId];
    }
    if (Object.keys(categorySelections).length === 0) return null;
    const cacheKey = JSON.stringify(categorySelections);
    if (scoreMatrixCache.has(cacheKey)) return scoreMatrixCache.get(cacheKey)!;
    const { data: match } = await supabase
      .from('score_matrix').select('id')
      .contains('category_selections', categorySelections).limit(1).maybeSingle();
    const result = match ? (match.id as string) : null;
    scoreMatrixCache.set(cacheKey, result);
    return result;
  }

  // Cached company resolver — avoids repeated tax_id / trade_name lookups for same company
  async function resolveCompanyIdCached(companyValues: Record<string, string>): Promise<string | null> {
    const taxId = companyValues.tax_id;
    const tradeName = companyValues.trade_name;
    const legalName = companyValues.legal_name;
    const cacheKey = taxId || (tradeName ? normalizeCompanyName(tradeName) : null) || (legalName ? normalizeCompanyName(legalName) : null);
    if (!cacheKey) return resolveCompanyId(companyValues);
    if (companyCache.has(cacheKey)) return companyCache.get(cacheKey)!;
    const result = await resolveCompanyId(companyValues);
    companyCache.set(cacheKey, result);
    return result;
  }

  // Timeout guard — mark session as 'failed' if we approach the 150s function limit
  const TIMEOUT_MS = 130_000; // 130s safety margin before 150s hard limit
  const importStartTime = Date.now();
  let timedOut = false;

  const peopleIds: string[] = [];
  const contacts: Array<{ people_id: string; whatsapp: string | null; email: string | null }> = [];
  let newPeople = 0;
  let existingPeople = 0;
  let failedRows = 0;

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    // AC5: Check elapsed time before processing each batch
    if (Date.now() - importStartTime > TIMEOUT_MS) {
      timedOut = true;
      console.warn('[sends-import-contacts] approaching timeout — stopping early, session marked failed');
      break;
    }

    const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

    // ── Phase 0: Pre-process rows (normalize + validate, no DB) ───────────────
    type RowMeta = {
      raw:              Record<string, string>;
      personName:       string;
      normalizedPhone:  string;    // '' if no phone
      phoneSuffix:      string;    // last 11 digits, '' if no phone
      rawEmail:         string;    // '' if no email
      qFieldValues:     Record<string, string | null>;
      companyValues:    Record<string, string>;
    };

    const validRows: RowMeta[] = [];
    for (const row of batch) {
      try {
        const rawName     = row[field_mapping.name]?.trim() ?? '';
        const rawWhatsapp = field_mapping.whatsapp ? row[field_mapping.whatsapp]?.trim() ?? '' : '';
        const rawEmail    = field_mapping.email    ? row[field_mapping.email]?.trim() ?? ''    : '';
        const normalizedPhone = rawWhatsapp ? normalizePhone(rawWhatsapp) : '';
        const personName  = rawName || normalizedPhone || rawEmail;

        if (!personName) { failedRows++; continue; }
        if (normalizedPhone && !/^\d{6,15}$/.test(normalizedPhone)) { failedRows++; continue; }

        validRows.push({
          raw: row,
          personName,
          normalizedPhone,
          phoneSuffix: normalizedPhone ? normalizedPhone.slice(-11) : '',
          rawEmail,
          qFieldValues:  extractQFieldValues(row),
          companyValues: extractCompanyStructValues(row),
        });
      } catch (rowErr) {
        failedRows++;
        console.error('[sends-import-contacts] phase0 row error:', rowErr);
      }
    }

    if (validRows.length === 0) continue;

    // ── Phase 1: Bulk dedup ────────────────────────────────────────────────────
    // Replace 2N individual queries with 1-2 queries per batch.
    // Build OR clauses: whatsapp.ilike.%{suffix}, phone.ilike.%{suffix}, email.eq.{email}
    const uniqueSuffixes = [...new Set(validRows.filter(r => r.phoneSuffix).map(r => r.phoneSuffix))];
    const uniqueEmails   = [...new Set(validRows.filter(r => r.rawEmail).map(r => r.rawEmail.toLowerCase()))];

    const allOrParts: string[] = [
      ...uniqueSuffixes.flatMap(s => [`whatsapp.ilike.%${s}`, `phone.ilike.%${s}`]),
      ...uniqueEmails.map(e => `email.eq.${e}`),
    ];

    type ExistingPersonRow = { id: string; whatsapp: string | null; phone: string | null; email: string | null };
    const dedupedPersons: ExistingPersonRow[] = [];

    for (let i = 0; i < allOrParts.length; i += MAX_OR_CLAUSES) {
      const chunk = allOrParts.slice(i, i + MAX_OR_CLAUSES);
      const { data: found } = await supabase
        .from('clients_people')
        .select('id, whatsapp, phone, email')
        .or(chunk.join(','));
      if (found) dedupedPersons.push(...(found as ExistingPersonRow[]));
    }

    // Build lookup maps: phone suffix → personId, email → personId
    const phoneSuffixToId = new Map<string, string>();
    const emailToId       = new Map<string, string>();
    for (const p of dedupedPersons) {
      if (p.whatsapp) phoneSuffixToId.set(p.whatsapp.slice(-11), p.id);
      if (p.phone)    phoneSuffixToId.set(p.phone.slice(-11), p.id);
      if (p.email)    emailToId.set(p.email.toLowerCase(), p.id);
    }

    // ── Phase 2: Classify rows as existing or new ──────────────────────────────
    type ClassifiedRow = RowMeta & { existingPersonId: string | null };
    const classified: ClassifiedRow[] = validRows.map(r => {
      let existingPersonId: string | null = null;
      if (r.phoneSuffix) existingPersonId = phoneSuffixToId.get(r.phoneSuffix) ?? null;
      if (!existingPersonId && r.rawEmail) existingPersonId = emailToId.get(r.rawEmail.toLowerCase()) ?? null;
      return { ...r, existingPersonId };
    });

    const existingRows = classified.filter(r => r.existingPersonId !== null) as (ClassifiedRow & { existingPersonId: string })[];
    const newRows      = classified.filter(r => r.existingPersonId === null);

    existingPeople += existingRows.length;

    // Record existing persons in output collections
    for (const r of existingRows) {
      peopleIds.push(r.existingPersonId);
      contacts.push({ people_id: r.existingPersonId, whatsapp: r.normalizedPhone || null, email: r.rawEmail || null });
    }

    // ── Phase 3: Bulk INSERT new persons ──────────────────────────────────────
    // 1 query replaces N individual INSERTs.
    type InsertedPerson = { id: string; whatsapp: string | null; email: string | null };
    let insertedPersons: InsertedPerson[] = [];

    if (newRows.length > 0) {
      const insertPayloads = newRows.map(r => ({
        name:       r.personName,
        whatsapp:   r.normalizedPhone || null,
        email:      r.rawEmail || null,
        status:     'active',
        ai_enabled: true,
        ...r.qFieldValues,
      }));

      const { data: inserted } = await supabase
        .from('clients_people')
        .insert(insertPayloads)
        .select('id, whatsapp, email');
      insertedPersons = (inserted as InsertedPerson[]) ?? [];
    }

    // Map inserted persons back to rows — match by whatsapp suffix, then email
    // (PostgreSQL returns RETURNING rows in insertion order, but we match explicitly for safety)
    const newInsertedSuffixToId = new Map<string, string>();
    const newInsertedEmailToId  = new Map<string, string>();
    for (const p of insertedPersons) {
      if (p.whatsapp) newInsertedSuffixToId.set(p.whatsapp.slice(-11), p.id);
      if (p.email)    newInsertedEmailToId.set(p.email.toLowerCase(), p.id);
    }

    type NewRowWithId = ClassifiedRow & { newPersonId: string };
    const resolvedNewRows: NewRowWithId[] = [];
    for (const r of newRows) {
      let newPersonId: string | undefined;
      if (r.phoneSuffix) newPersonId = newInsertedSuffixToId.get(r.phoneSuffix);
      if (!newPersonId && r.rawEmail) newPersonId = newInsertedEmailToId.get(r.rawEmail.toLowerCase());
      if (!newPersonId) { failedRows++; continue; }
      newPeople++;
      peopleIds.push(newPersonId);
      contacts.push({ people_id: newPersonId, whatsapp: r.normalizedPhone || null, email: r.rawEmail || null });
      resolvedNewRows.push({ ...r, newPersonId });
    }

    // ── Phase 4: Per-person field ops ─────────────────────────────────────────

    // 4a. crm_extra — collect all upsert rows for the batch, then 1 bulk upsert
    if (crm_extra && Object.keys(crm_extra).length > 0) {
      const crmExtraRows: Array<{ entity_id: string; entity_type: string; field_definition_id: string; value_text: string }> = [];
      for (const r of existingRows) {
        for (const [field_key, header_csv] of Object.entries(crm_extra)) {
          const value = r.raw[header_csv]?.trim();
          const defId = personFieldDefs[field_key];
          if (!value || !defId) continue;
          crmExtraRows.push({ entity_id: r.existingPersonId, entity_type: 'pessoa', field_definition_id: defId, value_text: value });
        }
      }
      for (const r of resolvedNewRows) {
        for (const [field_key, header_csv] of Object.entries(crm_extra)) {
          const value = r.raw[header_csv]?.trim();
          const defId = personFieldDefs[field_key];
          if (!value || !defId) continue;
          crmExtraRows.push({ entity_id: r.newPersonId, entity_type: 'pessoa', field_definition_id: defId, value_text: value });
        }
      }
      if (crmExtraRows.length > 0) {
        await supabase.from('lead_field_values')
          .upsert(crmExtraRows, { onConflict: 'entity_type,entity_id,field_definition_id' });
      }
    }

    // 4b. q_field UPDATE for existing persons (per-person, N+1 — can't bulk UPDATE with different values)
    for (const r of existingRows) {
      try {
        const qUpdates: Record<string, string> = {};
        for (const [qKey, v] of Object.entries(r.qFieldValues)) {
          if (v) qUpdates[qKey] = v;
        }
        if (Object.keys(qUpdates).length > 0) {
          await supabase.from('clients_people').update(qUpdates).eq('id', r.existingPersonId);
        }
      } catch (e) { console.error('[sends-import-contacts] q_field update error:', e); }
    }

    // 4c. score_matrix_id (cached) + company link (cached) — per-person but with dedup
    type PersonWithScore = { personId: string; row: RowMeta };
    const allPersonsForEnrich: PersonWithScore[] = [
      ...existingRows.map(r => ({ personId: r.existingPersonId, row: r as RowMeta })),
      ...resolvedNewRows.map(r => ({ personId: r.newPersonId, row: r as RowMeta })),
    ];

    for (const { personId, row: r } of allPersonsForEnrich) {
      try {
        // score_matrix_id (uses cache — repeated combos skip DB)
        const resolvedScore = await resolveScoreMatrixIdCached(r.raw);
        if (resolvedScore) {
          await supabase.from('clients_people').update({ score_matrix_id: resolvedScore }).eq('id', personId);
        }

        // company + empresa_extra (uses cache — repeated companies skip DB)
        if (Object.keys(r.companyValues).length > 0) {
          const companyId = await resolveCompanyIdCached(r.companyValues);
          if (companyId) {
            await linkPersonToCompany(personId, companyId);
            if (empresa_extra) {
              const empresaRows: Array<{ entity_id: string; entity_type: string; field_definition_id: string; value_text: string }> = [];
              for (const [field_key, header_csv] of Object.entries(empresa_extra)) {
                const value = r.raw[header_csv]?.trim();
                const defId = empresaFieldDefs[field_key];
                if (!value || !defId) continue;
                empresaRows.push({ entity_id: companyId, entity_type: 'empresa', field_definition_id: defId, value_text: value });
              }
              if (empresaRows.length > 0) {
                await supabase.from('lead_field_values')
                  .upsert(empresaRows, { onConflict: 'entity_type,entity_id,field_definition_id' });
              }
            }
          }
        }
      } catch (e) { console.error('[sends-import-contacts] enrich error for person:', personId, e); }
    }

    // ── Phase 5: Lead ops — bulk check + bulk INSERT ────────────────────────
    // Replaces 3N individual queries with 2 queries per batch.
    if (create_leads && pipeline_id && stage_id) {
      const allPersonIds = [
        ...existingRows.map(r => r.existingPersonId),
        ...resolvedNewRows.map(r => r.newPersonId),
      ];

      if (allPersonIds.length > 0) {
        // Bulk check: which persons already have a lead in this pipeline?
        const { data: existingLeadsData } = await supabase
          .from('leads')
          .select('people_id')
          .in('people_id', allPersonIds)
          .eq('leads_pipelines_id', pipeline_id);
        const personIdsWithLead = new Set(
          (existingLeadsData ?? []).map((l: { people_id: string }) => l.people_id),
        );

        // Build a row map to look up raw row by personId
        const personIdToRow = new Map<string, RowMeta>([
          ...existingRows.map(r    => [r.existingPersonId, r as RowMeta] as [string, RowMeta]),
          ...resolvedNewRows.map(r => [r.newPersonId,       r as RowMeta] as [string, RowMeta]),
        ]);

        // Build lead INSERT payloads for persons that don't have a lead yet
        const leadInsertPayloads: Array<Record<string, unknown>> = [];
        const leadInsertPersonIds: string[] = []; // parallel array to match returned leads

        for (const personId of allPersonIds) {
          if (personIdsWithLead.has(personId)) continue;
          const r = personIdToRow.get(personId);
          if (!r) continue;

          const rowLeadControl = field_mapping.lead_control
            ? r.raw[field_mapping.lead_control]?.trim() || null : null;
          const effectiveControl = rowLeadControl || lead_control || '1';

          const leadColValues: Record<string, string> = {};
          if (lead_cols) {
            for (const [colKey, csvHeader] of Object.entries(lead_cols)) {
              const v = r.raw[csvHeader]?.trim();
              if (v) leadColValues[colKey] = v;
            }
          }

          leadInsertPayloads.push({
            people_id:          personId,
            leads_pipelines_id: pipeline_id,
            leads_stages_id:    stage_id,
            status:             'in_progress',
            control:            effectiveControl,
            ...(assign_user_id  ? { user_id:        assign_user_id } : {}),
            ...(assign_team_id  ? { teams_id:       assign_team_id } : {}),
            ...(score_matrix_id ? { score_matrix_id }               : {}),
            ...(origem_lista    ? { origem_lista }                  : {}),
            ...leadColValues,
          });
          leadInsertPersonIds.push(personId);
        }

        // Bulk INSERT all leads — 1 query replaces N individual INSERTs
        if (leadInsertPayloads.length > 0) {
          const { data: insertedLeads } = await supabase
            .from('leads')
            .insert(leadInsertPayloads)
            .select('id, people_id');

          if (insertedLeads && insertedLeads.length > 0) {
            // 5a. Bulk lead_extra upserts — 1 upsert for all lead-extra rows in this batch
            if (lead_extra && Object.keys(lead_extra).length > 0) {
              const leadExtraRows: Array<{
                entity_id: string; entity_type: string; lead_id: string;
                field_definition_id: string; value_text: string;
              }> = [];
              for (const lead of insertedLeads as Array<{ id: string; people_id: string }>) {
                const r = personIdToRow.get(lead.people_id);
                if (!r) continue;
                for (const [field_key, header_csv] of Object.entries(lead_extra)) {
                  const value = r.raw[header_csv]?.trim();
                  const defId = negocioFieldDefs[field_key];
                  if (!value || !defId) continue;
                  leadExtraRows.push({
                    entity_id:           lead.id,
                    entity_type:         'negocio',
                    lead_id:             lead.id,
                    field_definition_id: defId,
                    value_text:          value,
                  });
                }
              }
              if (leadExtraRows.length > 0) {
                await supabase.from('lead_field_values')
                  .upsert(leadExtraRows, { onConflict: 'entity_type,entity_id,field_definition_id' });
              }
            }

            // 5b. score_matrix_id on leads (per-lead, uses cache — usually 0-1 DB queries)
            for (const lead of insertedLeads as Array<{ id: string; people_id: string }>) {
              const r = personIdToRow.get(lead.people_id);
              if (!r) continue;
              try {
                const resolvedScore = await resolveScoreMatrixIdCached(r.raw);
                if (resolvedScore) {
                  await supabase.from('leads').update({ score_matrix_id: resolvedScore }).eq('id', lead.id);
                }
              } catch (e) { console.error('[sends-import-contacts] lead score update error:', e); }
            }
          }
        }
      }
    }

    // AC4: Update session progress after each batch (not just at end)
    await supabase
      .from('sends_import_sessions')
      .update({
        processed:       Math.min(batchStart + BATCH_SIZE, rows.length),
        new_people:      newPeople,
        existing_people: existingPeople,
        failed_rows:     failedRows,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // ── Insert sends_contacts when send_id is provided ────────────────────────

  if (send_id && contacts.length > 0) {
    const CONTACTS_BATCH = 500;
    for (let i = 0; i < contacts.length; i += CONTACTS_BATCH) {
      const cbatch = contacts.slice(i, i + CONTACTS_BATCH).map((c) => ({
        send_id,
        people_id: c.people_id,
        whatsapp:  c.whatsapp ?? '',
        status:    'pending',
      }));
      await supabase.from('sends_contacts').insert(cbatch);
    }
  }

  // ── Finalize session — AC5: mark as 'failed' if we timed out ─────────────

  await supabase
    .from('sends_import_sessions')
    .update({
      status:          timedOut ? 'failed' : 'done',
      processed:       timedOut ? Math.min(peopleIds.length + failedRows, rows.length) : rows.length,
      new_people:      newPeople,
      existing_people: existingPeople,
      failed_rows:     failedRows,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', sessionId);

  const output: ImportContactsOutput = {
    session_id:      sessionId,
    new_people:      newPeople,
    existing_people: existingPeople,
    failed_rows:     failedRows,
    total:           rows.length,
    people_ids:      peopleIds,
    contacts,
  };

  return new Response(
    JSON.stringify(output),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
