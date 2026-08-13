/**
 * Schedule PRO™ — Google Calendar Event Upsert
 *
 * POST /google-cal-upsert-event
 * Body: { meeting_id: string, action: 'create' | 'update' | 'delete' }
 *
 * Creates/updates/deletes the corresponding event in the consultant's Google Calendar(s).
 *
 * MULTI-CAL: a consultant may have several google connections. We sync the meeting
 * to EVERY google connection with sync_booking=true.
 *   - The PRIMARY connection (oldest row) owns meetings.google_event_id / meeting_link,
 *     so create/update/delete are authoritative against it.
 *   - Secondary connections are best-effort: events are created/patched there too, but
 *     their event ids are not persisted (the meetings table tracks a single id). On
 *     update without a stored secondary id we recreate; on delete we cannot target the
 *     secondary copy and skip it. Acceptable until a per-connection event map exists.
 *
 * INVARIANT (MULTI-CAL): each connection is a row keyed by `id`. Token refresh MUST
 * filter `.eq('id', row.id)` — never `.eq('user_id', x)` (would clobber sibling rows).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildAltioraInvite, isAltioraMeetingType } from '../_shared/altiora-invite-template.ts';
import { bearerToken, isServiceRoleToken } from '../_shared/service-role-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // === AUTH ===
    const authHeader = req.headers.get('Authorization');
    const token = bearerToken(authHeader);
    if (!token) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }

    // Aceita as duas gerações de chave service-role (sb_secret_… vinda de outra
    // edge function, e JWT legado vindo do pg_cron). Ver _shared/service-role-auth.ts.
    if (!isServiceRoleToken(token)) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return json({ success: false, error: 'Invalid token' }, 401);
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === OAuth credentials: settings (CFG-05) → bi_settings fallback → env ===
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('google_client_id, google_client_secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let clientId = settingsRow?.google_client_id ?? '';
    let clientSecret = settingsRow?.google_client_secret ?? '';
    if (!clientId || !clientSecret) {
      const { data: biRow } = await supabase
        .from('bi_settings')
        .select('google_client_id, google_client_secret')
        .limit(1)
        .maybeSingle();
      clientId = clientId || (biRow?.google_client_id ?? Deno.env.get('GOOGLE_CLIENT_ID') ?? '');
      clientSecret = clientSecret || (biRow?.google_client_secret ?? Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '');
    }
    if (!clientId || !clientSecret) {
      console.warn('[GCal] No OAuth credentials found in settings, bi_settings or env vars — sync will fail on token refresh');
    }

    // === PARSE BODY ===
    const body = await req.json();
    const { meeting_id, action } = body as { meeting_id: string; action: 'create' | 'update' | 'delete' };

    if (!meeting_id || !action) {
      return json({ success: false, error: 'Missing meeting_id or action' }, 400);
    }

    // === Fetch meeting ===
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id, start_time, end_time, location, notes, meeting_link, status, title, google_event_id,
        altiora_tipo,
        users_id, people_id,
        leads (
          id, title,
          clients_people ( id, name, email )
        ),
        clients_people ( id, name, email )
      `)
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting) {
      console.warn('Meeting not found:', meeting_id);
      return json({ success: true, skipped: true, reason: 'meeting_not_found' });
    }

    const consultorId = meeting.users_id;
    if (!consultorId) {
      return json({ success: true, skipped: true, reason: 'no_consultant' });
    }

    // === Fetch additional collaborators (ALTIORA-28/29) ===
    // meeting_collaborators nunca substitui o organizador (meeting.users_id,
    // dono do token OAuth) — são convidados extra em attendees[], nunca donos
    // alternativos do evento. Falha aqui não pode bloquear create/update do
    // evento (graceful degradation, mesmo padrão do resto desta function).
    let collaboratorRows: Array<{ user_id: string }> = [];
    try {
      const { data: collabData, error: collabError } = await supabase
        .from('meeting_collaborators')
        .select('user_id')
        .eq('meeting_id', meeting_id);
      if (collabError) {
        console.warn('[GCal] Failed to fetch meeting_collaborators:', collabError.message);
      } else {
        collaboratorRows = collabData ?? [];
      }
    } catch (err) {
      console.warn('[GCal] Unexpected error fetching meeting_collaborators:', String(err));
    }

    let collaboratorUsers: Array<{ id: string; nome: string | null; email: string | null }> = [];
    if (collaboratorRows.length > 0) {
      const { data: collabUsersData, error: collabUsersError } = await supabase
        .from('settings_users')
        .select('id, nome, email')
        .in('id', collaboratorRows.map((c) => c.user_id));
      if (collabUsersError) {
        console.warn('[GCal] Failed to resolve collaborator settings_users:', collabUsersError.message);
      } else {
        collaboratorUsers = collabUsersData ?? [];
      }
    }

    // Colaboradores sem e-mail válido não bloqueiam o evento — apenas são
    // ignorados no attendees[] (AC2 da ALTIORA-28), com warning para debug.
    const collaboratorAttendees: Array<{ email: string }> = [];
    for (const cu of collaboratorUsers) {
      const email = (cu.email ?? '').trim();
      if (!email) {
        console.warn(`[GCal] Collaborator ${cu.id} has no valid email in settings_users — skipping attendee`);
        continue;
      }
      collaboratorAttendees.push({ email });
    }

    // === Fetch convidados externos (meeting_guests) ===
    // E-mails digitados à mão no modal, estilo "Adicionar convidados" do Meet.
    // Diferente de meeting_collaborators: entram só em attendees[], NÃO na
    // assinatura do convite (não são co-hosts). Mesma degradação graciosa —
    // falhar aqui não pode impedir o evento de ser criado.
    const guestAttendees: Array<{ email: string }> = [];
    try {
      const { data: guestData, error: guestError } = await supabase
        .from('meeting_guests')
        .select('email')
        .eq('meeting_id', meeting_id);
      if (guestError) {
        console.warn('[GCal] Failed to fetch meeting_guests:', guestError.message);
      } else {
        for (const g of guestData ?? []) {
          const email = (g.email ?? '').trim();
          if (email) guestAttendees.push({ email });
        }
      }
    } catch (err) {
      console.warn('[GCal] Unexpected error fetching meeting_guests:', String(err));
    }

    // Colaboradores e convidados compartilham o mesmo attendees[]; a ordem
    // (colaboradores antes) só afeta a listagem no evento.
    const extraAttendees: Array<{ email: string }> = [...collaboratorAttendees, ...guestAttendees];

    // === Fetch ALL google connections for consultant that sync bookings ===
    // Ordered by created_at so the oldest row is the PRIMARY (owns meetings.google_event_id).
    const { data: connections } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', consultorId)
      .eq('is_active', true)
      .eq('provider', 'google')
      .eq('sync_booking', true)
      .order('created_at', { ascending: true });

    if (!connections || connections.length === 0) {
      return json({ success: true, skipped: true, reason: 'no_calendar_connection' });
    }

    // === Build event payload (shared across calendars) ===
    // Try lead → person chain first, then direct people_id (manual meetings)
    const personViaLead = (meeting.leads as any)?.clients_people;
    const personDirect = (meeting as any).clients_people;
    const clientName = personViaLead?.name ?? personDirect?.name ?? 'Cliente';
    const clientEmail = personViaLead?.email ?? personDirect?.email ?? null;

    // Sufixo [ref:<meeting_id>] no título do evento — ferramentas de gravação de call
    // (ex: Elephan.ai) que capturam o título do evento do Google Calendar como
    // metadado da transcrição permitem casar a call de volta a esta reunião sem
    // depender de e-mail do consultor ou de janela de tempo (ver elephan-inbound).
    const refSuffix = ` [ref:${meeting_id}]`;

    // Reuniões do fluxo Altiora (altiora_tipo = R1/R2/R3) usam os templates de
    // convite do playbook comercial; as demais mantêm o texto genérico legado.
    let summary = `Reunião — ${clientName}`;
    let description = meeting.notes
      ? `${meeting.notes}\n\nAgendado via app.`
      : 'Agendado via app.';

    if (isAltioraMeetingType(meeting.altiora_tipo)) {
      const { data: consultor } = await supabase
        .from('settings_users')
        .select('nome, whatsapp')
        .eq('id', consultorId)
        .maybeSingle();

      const durationMinutes = meeting.start_time && meeting.end_time
        ? (new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / 60_000
        : null;

      const invite = buildAltioraInvite({
        tipo: meeting.altiora_tipo,
        clientName,
        provider: 'Google Meet',
        durationMinutes,
        consultorNome: consultor?.nome,
        consultorTelefone: consultor?.whatsapp,
        notes: meeting.notes,
        colaboradores: collaboratorUsers.map((cu) => ({ nome: cu.nome })),
      });
      summary = invite.title;
      description = invite.description;
    }

    const eventPayload: Record<string, unknown> = {
      summary: `${summary}${refSuffix}`,
      description,
      start: { dateTime: meeting.start_time, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: meeting.end_time, timeZone: 'America/Sao_Paulo' },
    };
    if (meeting.location) {
      eventPayload.location = meeting.location;
    }
    if (meeting.meeting_link) {
      eventPayload.description = `${eventPayload.description}\n\nLink: ${meeting.meeting_link}`;
    }

    // Refresh the access token for a single connection row, persisting by `id`.
    // Returns the usable access token, or null if refresh failed.
    async function tokenFor(connection: any): Promise<string | null> {
      let accessToken = connection.google_access_token;
      const expiresAt = connection.google_token_expires_at
        ? new Date(connection.google_token_expires_at)
        : null;
      const isExpired = !expiresAt || expiresAt.getTime() - Date.now() < 60_000;
      if (!isExpired) return accessToken;
      if (!clientId || !clientSecret) return accessToken;

      const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: connection.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.access_token) {
        accessToken = refreshData.access_token;
        const newExpiry = refreshData.expires_in
          ? new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
          : null;
        await supabase
          .from('user_calendar_connections')
          .update({ google_access_token: accessToken, google_token_expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        return accessToken;
      }
      console.error('[GCal] Token refresh failed:', JSON.stringify(refreshData));
      console.error('[GCal] Check bi_settings: client_id and client_secret must match the Google Cloud OAuth credential.');
      return null;
    }

    // Create an event with a Google Meet link; returns { google_event_id, meet_link } or null.
    async function createEvent(
      accessToken: string,
      baseUrl: string,
      attendees: Array<{ email: string }>,
    ): Promise<{ google_event_id: string; meet_link: string | null } | null> {
      const payloadWithConference = {
        ...eventPayload,
        attendees,
        conferenceData: {
          createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
        },
      };
      const createRes = await fetch(`${baseUrl}?conferenceDataVersion=1&sendUpdates=all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithConference),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        console.warn('Create event failed:', createRes.status, createData?.error?.message);
        return null;
      }
      const meetLink: string | null =
        createData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ?? null;
      return { google_event_id: createData.id, meet_link: meetLink };
    }

    const primary = connections[0];
    const secondaries = connections.slice(1);

    // === DELETE ===
    if (action === 'delete') {
      const googleEventId = meeting.google_event_id;
      if (!googleEventId) {
        return json({ success: true, skipped: true, reason: 'no_google_event_id' });
      }
      // Only the primary connection's event id is tracked; delete there.
      // Secondary copies cannot be targeted without a per-connection event map.
      const accessToken = await tokenFor(primary);
      let deleted = false;
      if (accessToken) {
        const calendarId = primary.google_calendar_id || 'primary';
        const baseUrl = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events`;
        // sendUpdates=all → Google e-mails every attendee that the event was cancelled.
        const deleteRes = await fetch(`${baseUrl}/${googleEventId}?sendUpdates=all`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!deleteRes.ok && deleteRes.status !== 404) {
          console.warn('Delete event failed:', deleteRes.status);
        } else {
          deleted = true;
        }
      }
      // Clear the tracked event id so a future reactivation (status back to
      // 'agendado') recreates the event instead of patching a deleted one.
      if (deleted) {
        await supabase.from('meetings').update({ google_event_id: null }).eq('id', meeting_id);
      }
      return json({ success: true, action: 'deleted' });
    }

    // === CREATE ===
    if (action === 'create') {
      // Primary: authoritative — persists google_event_id + meeting_link.
      const primaryToken = await tokenFor(primary);
      if (!primaryToken) {
        return json({ success: true, skipped: true, reason: 'token_refresh_failed' });
      }
      const primaryCalId = primary.google_calendar_id || 'primary';
      const primaryBase = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(primaryCalId)}/events`;
      const primaryAttendees: Array<{ email: string }> = [{ email: primary.google_email }];
      if (clientEmail) primaryAttendees.push({ email: clientEmail });
      // Colaboradores adicionais (ALTIORA-28) e convidados externos — convidados
      // extra, nunca donos do evento. Dedup por e-mail para não repetir
      // organizador/cliente caso um deles coincida (ex: alguém digita à mão o
      // e-mail do próprio cliente).
      const seenAttendeeEmails = new Set(primaryAttendees.map((a) => a.email.toLowerCase()));
      for (const ca of extraAttendees) {
        const key = ca.email.toLowerCase();
        if (seenAttendeeEmails.has(key)) continue;
        seenAttendeeEmails.add(key);
        primaryAttendees.push(ca);
      }

      const created = await createEvent(primaryToken, primaryBase, primaryAttendees);
      if (!created) {
        return json({ success: true, skipped: true, reason: 'create_failed' });
      }
      await supabase
        .from('meetings')
        .update({
          google_event_id: created.google_event_id,
          ...(created.meet_link ? { meeting_link: created.meet_link } : {}),
        })
        .eq('id', meeting_id);

      // Secondaries: best-effort, event ids not tracked.
      let secondaryCount = 0;
      for (const conn of secondaries) {
        const tok = await tokenFor(conn);
        if (!tok) continue;
        const calId = conn.google_calendar_id || 'primary';
        const base = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(calId)}/events`;
        const att: Array<{ email: string }> = [{ email: conn.google_email }];
        if (clientEmail) att.push({ email: clientEmail });
        const r = await createEvent(tok, base, att);
        if (r) secondaryCount++;
      }

      console.log(`✅ google-cal-upsert-event: created ${created.google_event_id} for meeting ${meeting_id} (primary + ${secondaryCount}/${secondaries.length} secondary)`);
      return json({ success: true, action: 'created', google_event_id: created.google_event_id, meet_link: created.meet_link, secondary_synced: secondaryCount });
    }

    // === UPDATE ===
    if (action === 'update') {
      const primaryToken = await tokenFor(primary);
      if (!primaryToken) {
        return json({ success: true, skipped: true, reason: 'token_refresh_failed' });
      }
      const primaryCalId = primary.google_calendar_id || 'primary';
      const primaryBase = `${CALENDAR_EVENTS_URL}/${encodeURIComponent(primaryCalId)}/events`;
      const primaryAttendees: Array<{ email: string }> = [{ email: primary.google_email }];
      if (clientEmail) primaryAttendees.push({ email: clientEmail });
      // Colaboradores adicionais (ALTIORA-28) e convidados externos — convidados
      // extra, nunca donos do evento. Dedup por e-mail para não repetir
      // organizador/cliente caso um deles coincida (ex: alguém digita à mão o
      // e-mail do próprio cliente).
      const seenAttendeeEmails = new Set(primaryAttendees.map((a) => a.email.toLowerCase()));
      for (const ca of extraAttendees) {
        const key = ca.email.toLowerCase();
        if (seenAttendeeEmails.has(key)) continue;
        seenAttendeeEmails.add(key);
        primaryAttendees.push(ca);
      }

      const googleEventId = meeting.google_event_id;
      if (!googleEventId) {
        // No tracked event yet — create on the primary.
        const created = await createEvent(primaryToken, primaryBase, primaryAttendees);
        if (!created) {
          return json({ success: true, skipped: true, reason: 'create_on_update_failed' });
        }
        await supabase
          .from('meetings')
          .update({
            google_event_id: created.google_event_id,
            ...(created.meet_link ? { meeting_link: created.meet_link } : {}),
          })
          .eq('id', meeting_id);
        return json({ success: true, action: 'created_on_update', google_event_id: created.google_event_id, meet_link: created.meet_link });
      }

      const patchRes = await fetch(`${primaryBase}/${googleEventId}?sendUpdates=all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${primaryToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventPayload, attendees: primaryAttendees }),
      });
      if (!patchRes.ok) {
        console.warn('Patch event failed:', patchRes.status);
        return json({ success: true, skipped: true, reason: 'patch_failed' });
      }
      console.log(`✅ google-cal-upsert-event: updated ${googleEventId} for meeting ${meeting_id} (primary; ${secondaries.length} secondary not tracked)`);
      return json({ success: true, action: 'updated', google_event_id: googleEventId });
    }

    return json({ success: false, error: 'Unknown action' }, 400);

  } catch (err) {
    console.error('Unexpected error:', err);
    // Graceful — don't fail the caller
    return json({ success: true, skipped: true, reason: String(err) });
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
