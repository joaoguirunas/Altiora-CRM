/**
 * ALTIORA-13: Hook para reuniões Altiora R1/R2/R3
 *
 * Consulta meetings com altiora_tipo definido para um lead específico.
 * Suporta criação, reagendamento e cancelamento com integração Google Calendar.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AltioraMeetingType = 'R1' | 'R2' | 'R3';

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
  closerId: string;
  tipo: AltioraMeetingType;
  startTime: string; // ISO
  endTime: string;   // ISO
  duracaoMinutos: number;
  notes?: string;
  meetingLink?: string; // fallback manual
  clientEmail?: string; // para convite
}

export interface UpdateAltioraMeetingParams {
  meetingId: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  duracaoMinutos: number;
  notes?: string;
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
