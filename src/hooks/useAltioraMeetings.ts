/**
 * ALTIORA-13: Hook para reuniões Altiora R1/R2/R3
 *
 * Consulta meetings com altiora_tipo definido para um lead específico.
 * Suporta criação, reagendamento e cancelamento com integração Google Calendar.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// `meeting_collaborators` (ALTIORA-26/27) ainda não está nos tipos gerados do
// Supabase — mesmo padrão de cast usado em NovoReferralModal.tsx.
const sbUntyped = supabase as unknown as SupabaseClient;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AltioraMeetingType = 'R1' | 'R2' | 'R3';

/**
 * Convidado externo de uma reunião — e-mail livre, sem linha em settings_users.
 * Entra só em attendees[] do evento; não é co-host e não assina o convite.
 * Ver migration 20260813180000_create_meeting_guests.sql.
 */
export interface MeetingGuest {
  id: string;
  meeting_id: string;
  email: string;
  name?: string | null;
  added_by?: string | null;
  created_at: string;
}

/** ALTIORA-27: colaborador adicional de uma reunião (co-host/observer). */
export interface MeetingCollaborator {
  id: string;
  meeting_id: string;
  user_id: string;
  role: 'co_host' | 'observer';
  added_by?: string | null;
  created_at: string;
  settings_users?: { id: string; name: string; email?: string } | null;
}

export interface AltioraMeeting {
  id: string;
  /** Component-facing alias for leads_id */
  lead_id: string;
  /** Component-facing alias for users_id */
  user_id?: string | null;
  /** ISO datetime — from altiora_data_hora, fallback to start_time (both timestamptz) */
  start_time: string;
  /** ISO datetime — timestamptz */
  end_time: string;
  status: string;
  notes?: string | null;
  location?: string | null;
  /** Component-facing alias for google_meet_link */
  meeting_link?: string | null;
  google_event_id?: string | null;
  altiora_tipo?: AltioraMeetingType | null;
  altiora_duracao_minutos?: number | null;
  altiora_data_hora?: string | null;
  altiora_compareceu?: boolean | null;
  altiora_resultado?: string | null;
  created_at: string;
  settings_users?: { id: string; name: string; email?: string } | null;
}

export interface CreateAltioraMeetingParams {
  leadId: string;
  peopleId?: string | null;
  /**
   * Organizador da reunião (salvo em `meetings.users_id`, dono do token OAuth
   * do evento no Google Calendar). Para Closer comum é sempre o Closer do
   * lead (comportamento atual). Para Super Admin, pode ser qualquer
   * `settings_users` ativo escolhido livremente no modal (ALTIORA-27).
   */
  closerId: string;
  tipo: AltioraMeetingType;
  startTime: string; // ISO
  endTime: string;   // ISO
  duracaoMinutos: number;
  notes?: string;
  meetingLink?: string; // fallback manual
  clientEmail?: string; // para convite
  /** ALTIORA-27: colaboradores adicionais (co-hosts) — settings_users.id[]. */
  collaboratorIds?: string[];
  /**
   * Convidados externos por e-mail (estilo Google Meet). Só entram em
   * attendees[] do evento — não são co-hosts nem assinam o convite.
   */
  guests?: MeetingGuestInput[];
}

/** E-mail obrigatório; nome é opcional (o fluxo padrão captura só o e-mail). */
export interface MeetingGuestInput {
  email: string;
  name?: string | null;
}

export interface UpdateAltioraMeetingParams {
  meetingId: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  duracaoMinutos: number;
  notes?: string;
  /**
   * ALTIORA-27: lista completa de colaboradores desejada após o
   * reagendamento — o hook calcula o diff (insere novos, remove ausentes).
   * `undefined` = não mexer nos colaboradores existentes.
   */
  collaboratorIds?: string[];
  /**
   * Lista completa de convidados externos desejada após o reagendamento — o
   * hook calcula o diff por e-mail (case-insensitive). `undefined` = não mexer.
   */
  guests?: MeetingGuestInput[];
}

// ── Hook: listar reuniões Altiora de um lead ──────────────────────────────────

export const useAltioraMeetings = (leadId: string) => {
  return useQuery<AltioraMeeting[]>({
    queryKey: ['altiora-meetings', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          id, leads_id, users_id, date, start_time, end_time, status, notes,
          location, google_meet_link, google_event_id,
          altiora_tipo, altiora_duracao_minutos, altiora_data_hora,
          altiora_compareceu, altiora_resultado, created_at,
          settings_users ( id, name, email )
        `)
        .eq('leads_id', leadId)
        .not('altiora_tipo', 'is', null)
        .order('altiora_data_hora', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Map DB column names to component-facing interface
      // start_time/end_time já são timestamptz (ISO completo) — sem concatenar com date
      return (data ?? []).map(r => ({
        ...r,
        lead_id: r.leads_id,
        user_id: r.users_id,
        start_time: r.altiora_data_hora ?? r.start_time ?? '',
        end_time: r.end_time ?? '',
        meeting_link: r.google_meet_link,
      })) as unknown as AltioraMeeting[];
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });
};

// ── Hook: listar colaboradores de uma reunião (ALTIORA-27) ───────────────────

/**
 * Colaboradores de VÁRIAS reuniões de uma vez, indexados por meeting_id.
 * Para listagens (ex.: tabela de Reuniões) — usar `useMeetingCollaborators`
 * por linha dispararia um request por reunião.
 */
export const useMeetingCollaboratorsByMeetings = (meetingIds: string[]) => {
  // Chave estável: sem ordenar, remontar a lista na mesma ordem diferente
  // refaria a query sem necessidade.
  const idsKey = [...meetingIds].sort().join(',');

  return useQuery<Record<string, MeetingCollaborator[]>>({
    queryKey: ['meeting-collaborators-batch', idsKey],
    queryFn: async () => {
      if (meetingIds.length === 0) return {};
      const { data, error } = await sbUntyped
        .from('meeting_collaborators')
        .select('id, meeting_id, user_id, role, added_by, created_at, settings_users ( id, name, email )')
        .in('meeting_id', meetingIds);

      if (error) throw new Error((error as { message: string }).message);

      const byMeeting: Record<string, MeetingCollaborator[]> = {};
      for (const row of (data ?? []) as unknown as MeetingCollaborator[]) {
        (byMeeting[row.meeting_id] ??= []).push(row);
      }
      return byMeeting;
    },
    enabled: meetingIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
};

export const useMeetingCollaborators = (meetingId?: string | null) => {
  return useQuery<MeetingCollaborator[]>({
    queryKey: ['meeting-collaborators', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];
      const { data, error } = await sbUntyped
        .from('meeting_collaborators')
        .select('id, meeting_id, user_id, role, added_by, created_at, settings_users ( id, name, email )')
        .eq('meeting_id', meetingId);

      if (error) throw new Error((error as { message: string }).message);
      return (data ?? []) as unknown as MeetingCollaborator[];
    },
    enabled: !!meetingId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useMeetingGuests = (meetingId?: string | null) => {
  return useQuery<MeetingGuest[]>({
    queryKey: ['meeting-guests', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];
      const { data, error } = await sbUntyped
        .from('meeting_guests')
        .select('id, meeting_id, email, name, added_by, created_at')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });

      if (error) throw new Error((error as { message: string }).message);
      return (data ?? []) as unknown as MeetingGuest[];
    },
    enabled: !!meetingId,
    staleTime: 2 * 60 * 1000,
  });
};

// ── Helper: convidados externos ──────────────────────────────────────────────

/** Chave de comparação/dedup de convidado: e-mail normalizado. */
const guestKey = (email: string) => email.trim().toLowerCase();

/**
 * Normaliza a lista vinda do modal: apara, remove vazios e deduplica por
 * e-mail case-insensitive (o índice único do banco faria isso doer em vez de
 * silenciar). Mantém a primeira ocorrência — é a que o usuário digitou antes.
 */
function normalizeGuests(guests: MeetingGuestInput[]): MeetingGuestInput[] {
  const seen = new Set<string>();
  const out: MeetingGuestInput[] = [];
  for (const g of guests) {
    const email = (g.email ?? '').trim();
    if (!email) continue;
    const key = guestKey(email);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: g.name?.trim() || null });
  }
  return out;
}

async function insertMeetingGuests(
  meetingId: string,
  guests: MeetingGuestInput[],
  addedBy?: string | null,
): Promise<void> {
  const rows = normalizeGuests(guests).map(g => ({
    meeting_id: meetingId,
    email: g.email,
    name: g.name ?? null,
    added_by: addedBy ?? null,
  }));
  if (!rows.length) return;
  const { error } = await sbUntyped.from('meeting_guests').insert(rows);
  if (error) throw new Error((error as { message: string }).message);
}

// ── Helper: persistir colaboradores adicionais (insert em lote) ──────────────

async function insertMeetingCollaborators(
  meetingId: string,
  userIds: string[],
  addedBy?: string | null,
): Promise<void> {
  if (!userIds.length) return;
  const rows = userIds.map(user_id => ({
    meeting_id: meetingId,
    user_id,
    role: 'co_host' as const,
    added_by: addedBy ?? null,
  }));
  const { error } = await sbUntyped.from('meeting_collaborators').insert(rows);
  if (error) throw new Error((error as { message: string }).message);
}

// ── Hook: criar reunião Altiora ────────────────────────────────────────────────

export const useCreateAltioraMeeting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateAltioraMeetingParams) => {
      // 1. Inserir meeting com campos Altiora
      // DB meetings: leads_id, users_id, date (date, derivado de start_time),
      // start_time/end_time (timestamptz — ISO completo, não HH:MM:SS)
      const startIso = params.startTime;
      const endIso   = params.endTime;
      const dateStr  = startIso.includes('T') ? startIso.split('T')[0] : startIso;

      const { data: meeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          leads_id:              params.leadId,
          users_id:              params.closerId,
          date:                  dateStr,
          start_time:            startIso,
          end_time:              endIso,
          notes:                 params.notes ?? null,
          google_meet_link:      params.meetingLink ?? null,
          status:                'agendado',
          altiora_tipo:          params.tipo,
          altiora_duracao_minutos: params.duracaoMinutos,
          altiora_data_hora:     startIso,
          altiora_created_by:    params.closerId,
        })
        .select('id')
        .single();

      if (insertError || !meeting) {
        throw new Error(insertError?.message ?? 'Erro ao criar reunião');
      }

      const meetingId = meeting.id;

      // 1.1 Persistir colaboradores adicionais (ALTIORA-27) — antes do sync
      // de calendário, para que ALTIORA-28 já encontre a lista completa.
      if (params.collaboratorIds?.length) {
        await insertMeetingCollaborators(meetingId, params.collaboratorIds, params.closerId);
      }

      // 1.2 Convidados externos — também antes do sync, pelo mesmo motivo:
      // a edge function monta attendees[] lendo do banco.
      if (params.guests?.length) {
        await insertMeetingGuests(meetingId, params.guests, params.closerId);
      }

      // 2. Sync Google Calendar (async, não bloqueia)
      const gcalResult = await supabase.functions.invoke('google-cal-upsert-event', {
        body: { meeting_id: meetingId, action: 'create' },
      });

      let meetLink: string | null = params.meetingLink ?? null;
      if (!gcalResult.error && gcalResult.data?.meet_link) {
        meetLink = gcalResult.data.meet_link;
      }

      // 3. Registrar interação
      await supabase.from('altiora_lead_interactions').insert({
        lead_id:     params.leadId,
        type:        'meeting_scheduled',
        description: `${params.tipo} agendada para ${new Date(params.startTime).toLocaleDateString('pt-BR')}`,
        payload:     {
          meeting_id:  meetingId,
          tipo:        params.tipo,
          start_time:  params.startTime,
          closer_id:   params.closerId,
          meet_link:   meetLink,
          gcal_synced: !gcalResult.error && !gcalResult.data?.skipped,
        },
      });

      return {
        meetingId,
        meetLink,
        gcalSynced: !gcalResult.error && !gcalResult.data?.skipped,
        gcalSkipped: gcalResult.data?.skipped ?? false,
        gcalSkipReason: gcalResult.data?.reason ?? null,
      };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-meetings', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-collaborators', result.meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting-guests', result.meetingId] });

      if (result.gcalSynced) {
        toast.success(`${variables.tipo} agendada com Google Meet criado`);
      } else if (result.gcalSkipped) {
        const skipMessages: Record<string, string> = {
          no_calendar_connection: `${variables.tipo} agendada — Closer sem Google Calendar conectado. Configure em Integrações.`,
          token_refresh_failed:   `${variables.tipo} agendada — credencial Google expirada. Reconecte.`,
          create_failed:          `${variables.tipo} agendada — Google Calendar rejeitou o evento.`,
        };
        const msg = (result.gcalSkipReason && skipMessages[result.gcalSkipReason])
          ?? `${variables.tipo} agendada (sem sync com Google Calendar)`;
        toast.warning(msg);
      } else {
        toast.success(`${variables.tipo} agendada com sucesso`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao agendar reunião: ${error.message}`);
    },
  });
};

// ── Hook: reagendar reunião Altiora ───────────────────────────────────────────

export const useUpdateAltioraMeeting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateAltioraMeetingParams & { leadId: string; tipo: AltioraMeetingType }) => {
      // 1. Atualizar meeting — start_time/end_time são timestamptz (ISO completo)
      const startIso = params.startTime;
      const endIso   = params.endTime;
      const dateStr  = startIso.includes('T') ? startIso.split('T')[0] : startIso;

      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          date:                    dateStr,
          start_time:              startIso,
          end_time:                endIso,
          notes:                   params.notes ?? null,
          altiora_duracao_minutos: params.duracaoMinutos,
          altiora_data_hora:       startIso,
        })
        .eq('id', params.meetingId);

      if (updateError) throw new Error(updateError.message);

      // 1.1 Diff de colaboradores (ALTIORA-27) — insere os novos, remove os
      // ausentes. Trocar o organizador (`users_id`) fica fora de escopo —
      // ver AC5 da ALTIORA-27 / ADR-ALTIORA-01.
      if (params.collaboratorIds !== undefined) {
        const { data: existing, error: existingError } = await sbUntyped
          .from('meeting_collaborators')
          .select('id, user_id')
          .eq('meeting_id', params.meetingId);

        if (existingError) throw new Error((existingError as { message: string }).message);

        const existingRows = (existing ?? []) as unknown as Array<{ id: string; user_id: string }>;
        const existingUserIds = existingRows.map(r => r.user_id);
        const desiredIds = params.collaboratorIds;

        const toAdd = desiredIds.filter(id => !existingUserIds.includes(id));
        const toRemove = existingRows.filter(r => !desiredIds.includes(r.user_id));

        if (toAdd.length) {
          await insertMeetingCollaborators(params.meetingId, toAdd);
        }
        if (toRemove.length) {
          const { error: deleteError } = await sbUntyped
            .from('meeting_collaborators')
            .delete()
            .in('id', toRemove.map(r => r.id));
          if (deleteError) throw new Error((deleteError as { message: string }).message);
        }
      }

      // 1.2 Diff de convidados externos — mesma lógica, comparando por e-mail
      // normalizado em vez de user_id.
      if (params.guests !== undefined) {
        const { data: existing, error: existingError } = await sbUntyped
          .from('meeting_guests')
          .select('id, email')
          .eq('meeting_id', params.meetingId);

        if (existingError) throw new Error((existingError as { message: string }).message);

        const existingRows = (existing ?? []) as unknown as Array<{ id: string; email: string }>;
        const existingKeys = new Set(existingRows.map(r => guestKey(r.email)));
        const desired = normalizeGuests(params.guests);
        const desiredKeys = new Set(desired.map(g => guestKey(g.email)));

        const toAdd = desired.filter(g => !existingKeys.has(guestKey(g.email)));
        const toRemove = existingRows.filter(r => !desiredKeys.has(guestKey(r.email)));

        if (toAdd.length) {
          await insertMeetingGuests(params.meetingId, toAdd);
        }
        if (toRemove.length) {
          const { error: deleteError } = await sbUntyped
            .from('meeting_guests')
            .delete()
            .in('id', toRemove.map(r => r.id));
          if (deleteError) throw new Error((deleteError as { message: string }).message);
        }
      }

      // 2. Sync Google Calendar (PATCH do evento existente)
      const gcalResult = await supabase.functions.invoke('google-cal-upsert-event', {
        body: { meeting_id: params.meetingId, action: 'update' },
      });

      // 3. Registrar interação
      await supabase.from('altiora_lead_interactions').insert({
        lead_id:     params.leadId,
        type:        'meeting_rescheduled',
        description: `${params.tipo} reagendada para ${new Date(params.startTime).toLocaleDateString('pt-BR')}`,
        payload:     {
          meeting_id: params.meetingId,
          tipo:       params.tipo,
          start_time: params.startTime,
          gcal_synced: !gcalResult.error && !gcalResult.data?.skipped,
        },
      });

      return { meetingId: params.meetingId };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-meetings', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-collaborators', variables.meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting-guests', variables.meetingId] });
      toast.success(`${variables.tipo} reagendada com sucesso`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reagendar: ${error.message}`);
    },
  });
};

// ── Hook: cancelar reunião Altiora ────────────────────────────────────────────

export const useCancelAltioraMeeting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meetingId, leadId, tipo }: { meetingId: string; leadId: string; tipo: AltioraMeetingType }) => {
      // 1. Atualizar status para cancelada
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'cancelada' })
        .eq('id', meetingId);

      if (error) throw new Error(error.message);

      // 2. Deletar evento do Google Calendar
      await supabase.functions.invoke('google-cal-upsert-event', {
        body: { meeting_id: meetingId, action: 'delete' },
      });

      // 3. Registrar interação
      await supabase.from('altiora_lead_interactions').insert({
        lead_id:     leadId,
        type:        'meeting_cancelled',
        description: `${tipo} cancelada`,
        payload:     { meeting_id: meetingId, tipo },
      });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-meetings', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });
      toast.success('Reunião cancelada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });
};

// ── Hook: registrar resultado de reunião (ALTIORA-14) ─────────────────────────

export type ResultadoMeetingStatus = 'realizada' | 'noshow' | 'cancelada';

export interface ResultadoMeetingParams {
  meetingId: string;
  leadId: string;
  tipo: AltioraMeetingType;
  actorId: string;
  status: ResultadoMeetingStatus;
  resultado?: string;
  /** Para no-show: motivo */
  motivoNoShow?: string;
}

export const useRegistrarResultadoMeeting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ResultadoMeetingParams) => {
      const { meetingId, leadId, tipo, actorId, status, resultado, motivoNoShow } = params;

      const compareceu = status === 'realizada';
      const dbStatus   = status === 'realizada' ? 'realizada'
                       : status === 'noshow'    ? 'cancelada'
                       : 'cancelada';

      // 1. Atualizar meeting
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          status:             dbStatus,
          altiora_compareceu: compareceu,
          altiora_resultado:  resultado ?? null,
        })
        .eq('id', meetingId);

      if (updateError) throw new Error(updateError.message);

      // 2. Registrar interação
      const interacaoType = status === 'noshow' ? 'meeting_noshow' : 'meeting_completed';
      const description =
        status === 'realizada'
          ? `${tipo} realizada — cliente compareceu${resultado ? `: ${resultado.slice(0, 80)}` : ''}`
          : status === 'noshow'
          ? `${tipo} — no-show${motivoNoShow ? ` (${motivoNoShow})` : ''}`
          : `${tipo} cancelada`;

      const { error: interacaoError } = await supabase
        .from('altiora_lead_interactions')
        .insert({
          lead_id:     leadId,
          actor_id:    actorId,
          type:        interacaoType,
          description,
          payload: {
            meeting_id:      meetingId,
            tipo,
            compareceu,
            resultado:       resultado ?? null,
            motivo_noshow:   motivoNoShow ?? null,
          },
        });

      if (interacaoError) throw new Error(interacaoError.message);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-meetings', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-simple'] });

      const label = variables.status === 'realizada' ? 'Reunião registrada como realizada!'
                  : variables.status === 'noshow'    ? 'No-show registrado'
                  : 'Reunião cancelada';
      toast.success(label);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar resultado: ${error.message}`);
    },
  });
};

// ── Hook: verificar conflito de agenda ────────────────────────────────────────

export const useCheckAltioraConflict = () => {
  return useMutation({
    mutationFn: async ({
      userId,
      startTime,
      endTime,
      excludeMeetingId,
    }: {
      userId: string;
      startTime: string;
      endTime: string;
      excludeMeetingId?: string;
    }): Promise<{ hasConflict: boolean; conflictingSlots: Array<{ start: string; end: string }> }> => {
      // Verificar conflito no banco local primeiro (meetings do CRM)
      let query = supabase
        .from('meetings')
        .select('id, altiora_data_hora, date, start_time, end_time, altiora_tipo')
        .eq('users_id', userId)
        .neq('status', 'cancelada')
        .neq('status', 'cancelado')
        .lt('altiora_data_hora', endTime)
        .not('altiora_data_hora', 'is', null);

      if (excludeMeetingId) {
        query = query.neq('id', excludeMeetingId);
      }

      const { data: conflicts } = await query;
      // Filter client-side for end overlap — end_time is timestamptz, comparable to the ISO startTime directly
      const filtered = (conflicts ?? []).filter(c => !c.end_time || c.end_time > startTime);
      const conflictingSlots = filtered.map(c => ({
        start: c.altiora_data_hora ?? c.start_time ?? '',
        end:   c.end_time ?? '',
      }));

      return {
        hasConflict: conflictingSlots.length > 0,
        conflictingSlots,
      };
    },
  });
};
