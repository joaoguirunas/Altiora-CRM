/**
 * ALTIORA-05 / ALTIORA-07 — Email Referral Inbound
 *
 * POST /altiora-email-referral-inbound
 *
 * Recebe webhook de e-mail inbound (SendGrid Inbound Parse, Mailgun Routes, etc.)
 * e processa o handoff da Avenue/Matheus para o pipeline Altiora.
 *
 * Flow:
 *  1. Validar remetente contra ALTIORA_ALLOWED_SENDERS (env)
 *  2. Verificar deduplicação via Message-ID → altiora_email_queue
 *  3. Extrair dados do cliente (nome, e-mail, telefone) do subject/body
 *  4. Detectar Closer nos campos To/CC (ALTIORA-07 — AC1)
 *  5. Criar lead em `leads` (pipeline Altiora, etapa "Novo referral")
 *  6. Registrar em `altiora_email_queue`
 *  7. Registrar interação em `altiora_lead_interactions`
 *  8. Notificar Gestor Comercial via `altiora_notifications`
 *  9. Se Closer detectado: atribuir + notificar Closer
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (obrigatórias)
 *   ALTIORA_ALLOWED_SENDERS — lista separada por vírgula de domínios/e-mails permitidos
 *                              ex: "avenue.com,matheus@parceiro.com"
 *                              DEFAULT: "avenue.com"
 *   ALTIORA_PIPELINE_ID     — UUID do pipeline (default: a1000000-0000-0000-0000-000000000001)
 *   ALTIORA_STAGE_ID_NOVO   — UUID da etapa "Novo referral" (default: a1000000-0000-0000-0001-000000000001)
 *   ALTIORA_STAGE_ID_ENCAMINHADO — UUID da etapa "Encaminhado ao comercial"
 *                                   (default: a1000000-0000-0000-0001-000000000002)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALTIORA_PIPELINE_ID_DEFAULT   = 'a1000000-0000-0000-0000-000000000001';
const ALTIORA_STAGE_NOVO_DEFAULT    = 'a1000000-0000-0000-0001-000000000001';
const ALTIORA_STAGE_ENC_DEFAULT     = 'a1000000-0000-0000-0001-000000000002';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailPayload {
  /** Header Message-ID — chave de deduplicação */
  messageId: string;
  from: string;
  fromName?: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
}

interface ExtractedClient {
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface ProcessResult {
  ok: boolean;
  action: 'created' | 'pending_validation' | 'rejected' | 'duplicate';
  lead_id?: string;
  closer_id?: string;
  reason?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normaliza endereço de e-mail: extrai apenas o e-mail de "Nome <email>" ou "email"
 */
function normalizeEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

/**
 * Extrai nome do remetente de "Nome <email>" ou apenas retorna o e-mail
 */
function extractSenderName(raw: string): string {
  const match = raw.match(/^([^<]+)<[^>]+>/);
  return match ? match[1].trim() : raw.trim();
}

/**
 * Verifica se o remetente é autorizado.
 * allowedSenders: lista de domínios (ex: "avenue.com") ou e-mails exatos.
 */
function isSenderAllowed(fromEmail: string, allowedSenders: string[]): boolean {
  const email = fromEmail.toLowerCase();
  return allowedSenders.some(allowed => {
    const a = allowed.trim().toLowerCase();
    // domínio: "avenue.com" → match qualquer @avenue.com
    if (!a.includes('@')) return email.endsWith(`@${a}`);
    // e-mail exato
    return email === a;
  });
}

/**
 * Extrai dados do cliente do subject e/ou body do e-mail.
 *
 * Estratégia:
 *  1. Subject pode conter o nome: "Referral: João Silva | 11999999999"
 *  2. Body pode ter padrões como "Nome: ...", "E-mail: ...", "Telefone: ..."
 *  3. Fallback: tenta extrair e-mail e telefone via regex do body
 */
function extractClientData(subject: string, body: string): ExtractedClient {
  const result: ExtractedClient = { name: null, email: null, phone: null };
  const text = `${subject}\n${body}`;

  // Nome: padrões "Nome: X", "Cliente: X", "Referral: X", "Indicado: X"
  const namePatterns = [
    /(?:nome|cliente|referral|indicado|lead)[:\s]+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)/im,
    /Referral:\s*([^\n|]+?)(?:\s*\||\n|$)/im,
  ];
  for (const pattern of namePatterns) {
    const m = text.match(pattern);
    if (m?.[1]) { result.name = m[1].trim(); break; }
  }

  // E-mail: padrões "E-mail: x@y.com" ou regex genérica
  const emailPatterns = [
    /(?:e-?mail|email)[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/im,
    /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/,
  ];
  for (const pattern of emailPatterns) {
    const m = text.match(pattern);
    if (m?.[1]) { result.email = m[1].trim().toLowerCase(); break; }
  }

  // Telefone: padrões "Telefone: X", "Tel: X", ou número BR no body
  const phonePatterns = [
    /(?:telefone|tel|fone|celular|whatsapp)[:\s]+([0-9()\s\-+]{8,20})/im,
    /\b(\+?55\s*(?:\d{2})\s*\d{4,5}[\s\-]?\d{4})\b/,
    /\b(\(?\d{2}\)?\s*\d{4,5}[\s\-]?\d{4})\b/,
  ];
  for (const pattern of phonePatterns) {
    const m = text.match(pattern);
    if (m?.[1]) {
      result.phone = m[1].replace(/\s+/g, '').replace(/[().\-]/g, '').trim();
      break;
    }
  }

  return result;
}

/**
 * Parse do payload de e-mail.
 * Suporta formatos SendGrid Inbound Parse (multipart/form-data) e JSON direto.
 */
async function parseEmailPayload(req: Request): Promise<EmailPayload | null> {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    // Formato JSON genérico ou Mailgun JSON
    const raw = await req.json();
    return {
      messageId: raw['Message-Id'] ?? raw['message_id'] ?? raw['messageId'] ?? `fallback-${Date.now()}`,
      from: raw['from'] ?? raw['sender'] ?? '',
      fromName: raw['from_name'] ?? '',
      to: toStringArray(raw['to'] ?? raw['To'] ?? []),
      cc: toStringArray(raw['cc'] ?? raw['Cc'] ?? []),
      subject: raw['subject'] ?? raw['Subject'] ?? '',
      body: raw['body-plain'] ?? raw['body'] ?? raw['text'] ?? '',
      bodyHtml: raw['body-html'] ?? raw['html'] ?? undefined,
    };
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    // SendGrid Inbound Parse / Mailgun form post
    const form = await req.formData();
    const get = (key: string) => form.get(key)?.toString() ?? '';
    return {
      messageId: get('headers').match(/Message-ID:\s*<?([^>\s]+)>?/i)?.[1] ?? `fallback-${Date.now()}`,
      from: get('from'),
      fromName: extractSenderName(get('from')),
      to: get('to').split(',').map(s => s.trim()).filter(Boolean),
      cc: get('cc').split(',').map(s => s.trim()).filter(Boolean),
      subject: get('subject'),
      body: get('text') || get('body-plain') || '',
      bodyHtml: get('html') || undefined,
    };
  }

  // Fallback: tenta JSON
  try {
    const raw = await req.json();
    return {
      messageId: raw['message_id'] ?? `fallback-${Date.now()}`,
      from: raw['from'] ?? '',
      fromName: '',
      to: toStringArray(raw['to'] ?? []),
      cc: toStringArray(raw['cc'] ?? []),
      subject: raw['subject'] ?? '',
      body: raw['body'] ?? '',
    };
  } catch { return null; }
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const allowedRaw     = Deno.env.get('ALTIORA_ALLOWED_SENDERS') ?? 'avenue.com';
  const pipelineId     = Deno.env.get('ALTIORA_PIPELINE_ID') ?? ALTIORA_PIPELINE_ID_DEFAULT;
  const stageNovo      = Deno.env.get('ALTIORA_STAGE_ID_NOVO') ?? ALTIORA_STAGE_NOVO_DEFAULT;
  const stageEnc       = Deno.env.get('ALTIORA_STAGE_ID_ENCAMINHADO') ?? ALTIORA_STAGE_ENC_DEFAULT;

  const allowedSenders = allowedRaw.split(',').map(s => s.trim()).filter(Boolean);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Parse e-mail ────────────────────────────────────────────────────────────
  let email: EmailPayload | null;
  try {
    email = await parseEmailPayload(req);
  } catch (err) {
    console.error('altiora-email-referral-inbound: parse error:', (err as Error).message);
    return json({ ok: false, error: 'Bad Request — não foi possível parsear o payload' }, 400);
  }
  if (!email) {
    return json({ ok: false, error: 'Bad Request — payload de e-mail inválido' }, 400);
  }

  console.log(`altiora-email-referral-inbound: message_id=${email.messageId} from=${email.from} subject=${email.subject}`);

  const fromEmail = normalizeEmail(email.from);
  const fromName  = extractSenderName(email.from) || email.fromName || '';

  // ── AC3: Remetente não autorizado → 403 + log rejected ─────────────────────
  if (!isSenderAllowed(fromEmail, allowedSenders)) {
    console.warn(`altiora-email-referral-inbound: sender not allowed: ${fromEmail}`);
    await supabase.from('altiora_email_queue').upsert({
      message_id: email.messageId,
      status: 'rejected',
      from_email: fromEmail,
      from_name: fromName,
      recipients: [...email.to, ...email.cc],
      subject: email.subject,
      body_preview: email.body.substring(0, 500),
      reason: `Remetente não autorizado: ${fromEmail}`,
    }, { onConflict: 'message_id', ignoreDuplicates: true });
    return json({ ok: false, error: 'Forbidden', code: 'SENDER_NOT_ALLOWED' }, 403);
  }

  // ── AC4: Deduplicação por Message-ID ────────────────────────────────────────
  const { data: existing } = await supabase
    .from('altiora_email_queue')
    .select('id, lead_id, status')
    .eq('message_id', email.messageId)
    .maybeSingle();

  if (existing) {
    console.log(`altiora-email-referral-inbound: duplicate message_id=${email.messageId}, status=${existing.status}`);
    return json({ ok: true, action: 'duplicate', lead_id: existing.lead_id });
  }

  // ── ALTIORA-07 AC1: Detectar Closer nos destinatários (To + CC) ────────────
  const allRecipientEmails = [...email.to, ...email.cc]
    .map(normalizeEmail)
    .filter(e => e && e !== fromEmail);

  let detectedCloserId: string | null = null;
  let detectedCloserName: string | null = null;

  if (allRecipientEmails.length > 0) {
    const { data: closerUsers } = await supabase
      .from('settings_users')
      .select('id, name, email')
      .eq('user_type', 'closer')
      .eq('ativo', true)
      .is('deleted_at', null) as unknown as {
        data: Array<{ id: string; name: string; email: string }> | null;
      };

    if (closerUsers && closerUsers.length > 0) {
      const matchedClosers = closerUsers.filter(u =>
        allRecipientEmails.includes((u.email ?? '').toLowerCase())
      );

      // AC4: múltiplos Closers → sem atribuição automática
      if (matchedClosers.length === 1) {
        detectedCloserId   = matchedClosers[0].id;
        detectedCloserName = matchedClosers[0].name;
      } else if (matchedClosers.length > 1) {
        console.log(`altiora-email-referral-inbound: múltiplos Closers detectados (${matchedClosers.map(c => c.email).join(', ')}) — sem atribuição automática`);
      }
    }
  }

  // ── Extrair dados do cliente ─────────────────────────────────────────────────
  const client = extractClientData(email.subject, email.body);
  const hasMinimumData = !!(client.name || client.email || client.phone);

  // ── Buscar Gestor Comercial para notificação ─────────────────────────────────
  const { data: gestorUsers } = await supabase
    .from('settings_users')
    .select('id, name')
    .eq('user_type', 'gestor_comercial')
    .eq('ativo', true)
    .is('deleted_at', null) as unknown as {
      data: Array<{ id: string; name: string }> | null;
    };

  // ── AC1 / AC2: Criar lead ────────────────────────────────────────────────────
  const leadTitle = client.name
    ? `Referral Avenue — ${client.name}`
    : `Referral Avenue — ${email.subject.substring(0, 60)}`;

  const leadStatus  = hasMinimumData ? 'in_progress' : 'pending_validation';
  const targetStage = detectedCloserId ? stageEnc : stageNovo;

  // Upsert person se houver e-mail ou nome do cliente
  let peopleId: string | null = null;
  if (client.email || client.name) {
    try {
      const personData: Record<string, unknown> = { status: 'active' };
      if (client.name)  personData.name      = client.name;
      if (client.email) personData.email     = client.email;
      if (client.phone) personData.whatsapp  = client.phone;

      if (client.email) {
        // Tentar encontrar pessoa existente por e-mail
        const { data: existingPerson } = await supabase
          .from('clients_people')
          .select('id')
          .eq('email', client.email)
          .maybeSingle();

        if (existingPerson) {
          peopleId = existingPerson.id;
        } else {
          const { data: newPerson } = await supabase
            .from('clients_people')
            .insert(personData)
            .select('id')
            .single();
          if (newPerson) peopleId = newPerson.id;
        }
      } else if (client.name) {
        const { data: newPerson } = await supabase
          .from('clients_people')
          .insert(personData)
          .select('id')
          .single();
        if (newPerson) peopleId = newPerson.id;
      }
    } catch (err) {
      console.error('altiora-email-referral-inbound: person upsert error (non-fatal):', (err as Error).message);
    }
  }

  // Criar lead
  const leadInsert: Record<string, unknown> = {
    title:                  leadTitle,
    leads_pipelines_id:     pipelineId,
    leads_stages_id:        targetStage,
    status:                 leadStatus,
    altiora_origem:         'avenue_email',
    altiora_email_handoff_id: email.messageId,
    altiora_data_handoff:   new Date().toISOString(),
  };

  if (peopleId) leadInsert.people_id = peopleId;

  // AC1/ALTIORA-07: Closer detectado automaticamente
  if (detectedCloserId) {
    leadInsert.altiora_closer_id          = detectedCloserId;
    leadInsert.altiora_origem_atribuicao  = 'email_auto';
    leadInsert.altiora_data_atribuicao    = new Date().toISOString();
  }

  const { data: newLead, error: leadError } = await supabase
    .from('leads')
    .insert(leadInsert)
    .select('id')
    .single();

  if (leadError || !newLead) {
    console.error('altiora-email-referral-inbound: lead INSERT error:', leadError?.message);
    // Registrar na fila como pendente mas não bloquear
    await supabase.from('altiora_email_queue').insert({
      message_id:   email.messageId,
      status:       'pending_validation',
      from_email:   fromEmail,
      from_name:    fromName,
      recipients:   [...email.to, ...email.cc],
      subject:      email.subject,
      body_preview: email.body.substring(0, 1000),
      client_name:  client.name,
      client_email: client.email,
      client_phone: client.phone,
      reason:       `Erro ao criar lead: ${leadError?.message ?? 'desconhecido'}`,
    });
    return json({ ok: false, error: 'Internal error — lead não criado' }, 500);
  }

  const leadId = newLead.id;

  // ── Registrar na fila ────────────────────────────────────────────────────────
  const queueStatus = hasMinimumData ? 'processed' : 'pending_validation';
  await supabase.from('altiora_email_queue').insert({
    message_id:   email.messageId,
    status:       queueStatus,
    from_email:   fromEmail,
    from_name:    fromName,
    recipients:   [...email.to, ...email.cc],
    subject:      email.subject,
    body_preview: email.body.substring(0, 1000),
    client_name:  client.name,
    client_email: client.email,
    client_phone: client.phone,
    lead_id:      leadId,
    reason:       hasMinimumData ? null : 'Dados mínimos ausentes (nome do cliente ou contato)',
  });

  // ── Registrar interação ──────────────────────────────────────────────────────
  await supabase.from('altiora_lead_interactions').insert({
    lead_id:     leadId,
    type:        'email_received',
    description: `E-mail de handoff recebido de ${fromName || fromEmail}`,
    payload:     {
      from_email:   fromEmail,
      subject:      email.subject,
      message_id:   email.messageId,
      has_data:     hasMinimumData,
    },
  });

  // Interação de atribuição automática (se Closer detectado)
  if (detectedCloserId) {
    await supabase.from('altiora_lead_interactions').insert({
      lead_id:     leadId,
      type:        'closer_assigned',
      description: `Closer atribuído automaticamente por e-mail: ${detectedCloserName}`,
      payload:     {
        closer_id:   detectedCloserId,
        closer_name: detectedCloserName,
        origem:      'email_auto',
      },
    });
  }

  // ── AC5: Notificar Gestor Comercial ──────────────────────────────────────────
  if (gestorUsers && gestorUsers.length > 0) {
    const notifData = gestorUsers.map(g => ({
      user_id: g.id,
      type:    hasMinimumData ? 'new_referral' : 'pending_validation',
      title:   hasMinimumData
        ? 'Novo referral recebido'
        : 'Referral com dados pendentes',
      message: hasMinimumData
        ? `Novo referral da Avenue: ${client.name ?? 'Nome não identificado'}. Origem: e-mail de handoff.`
        : `E-mail de handoff recebido mas dados mínimos não identificados. Acesse o pipeline para completar.`,
      payload: {
        lead_id:      leadId,
        lead_title:   leadTitle,
        from_email:   fromEmail,
        closer_id:    detectedCloserId,
        closer_name:  detectedCloserName,
      },
    }));
    await supabase.from('altiora_notifications').insert(notifData);
  }

  // ── ALTIORA-07 AC3: Notificar Closer atribuído ───────────────────────────────
  if (detectedCloserId) {
    await supabase.from('altiora_notifications').insert({
      user_id: detectedCloserId,
      type:    'closer_assigned',
      title:   'Novo referral atribuído a você',
      message: `Novo referral atribuído a você: ${client.name ?? leadTitle}`,
      payload: {
        lead_id:    leadId,
        lead_title: leadTitle,
        from_email: fromEmail,
      },
    });
  }

  const result: ProcessResult = {
    ok:         true,
    action:     queueStatus === 'pending_validation' ? 'pending_validation' : 'created',
    lead_id:    leadId,
    ...(detectedCloserId ? { closer_id: detectedCloserId } : {}),
  };

  console.log(`altiora-email-referral-inbound: lead criado=${leadId} action=${result.action} closer=${detectedCloserId ?? 'none'}`);
  return json(result);
});

// ── Helpers de resposta ───────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
