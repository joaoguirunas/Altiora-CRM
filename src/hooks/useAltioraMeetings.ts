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
  lead_id: string;
  user_id?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  title?: string | null;
  notes?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  google_event_id?: string | null;
  /** Altiora-specific */
  altiora_tipo?: AltioraMeetingType | null;
  altiora_duracao_minutos?: number | null;
  altiora_data_hora?: string | null;
  altiora_compareceu?: boolean | null;
  altiora_resultado?: string | null;
  created_at: string;
  /** Joins */
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
          id, lead_id, user_id, start_time, end_time, status, title, notes,
          location, meeting_link, google_event_id,
          altiora_tipo, altiora_duracao_minutos, altiora_data_hora,
          altiora_compareceu, altiora_resultado, created_at,
          settings_users ( id, name, email )
        `)
        .eq('lead_id', leadId)
        .not('altiora_tipo', 'is', null)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data ?? []) as AltioraMeeting[];
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
      const { data: meeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          lead_id:               params.leadId,
          people_id:             params.peopleId ?? null,
          user_id:               params.closerId,
          title:                 `${params.tipo} — Altiora`,
          start_time:            params.startTime,
          end_time:              params.endTime,
          notes:                 params.notes ?? null,
          meeting_link:          params.meetingLink ?? null,
          status:                'agendado',
          altiora_tipo:          params.tipo,
          altiora_duracao_minutos: params.duracaoMinutos,
          altiora_data_hora:     params.startTime,
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
      // 1. Atualizar meeting
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          start_time:              params.startTime,
          end_time:                params.endTime,
          notes:                   params.notes ?? null,
          altiora_duracao_minutos: params.duracaoMinutos,
          altiora_data_hora:       params.startTime,
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
        .select('id, start_time, end_time, title, altiora_tipo')
        .eq('user_id', userId)
        .neq('status', 'cancelada')
        .neq('status', 'cancelado')
        .lt('start_time', endTime)
        .gt('end_time', startTime);

      if (excludeMeetingId) {
        query = query.neq('id', excludeMeetingId);
      }

      const { data: conflicts } = await query;
      const conflictingSlots = (conflicts ?? []).map(c => ({ start: c.start_time, end: c.end_time }));

      return {
        hasConflict: conflictingSlots.length > 0,
        conflictingSlots,
      };
    },
  });
};
