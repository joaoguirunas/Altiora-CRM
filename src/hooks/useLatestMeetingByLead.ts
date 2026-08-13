import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { nomeReuniaoCurto } from '@/constants/altioraReunioes';

// Rótulo curto para o chip "Reunião" do card de pipeline.
const MEETING_TYPE_SHORT_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  demo: 'Demo',
  closing: 'Fecho',
  consulting: 'Consultoria',
  mentoring: 'Mentoria',
  qbr: 'QBR',
  followup: 'Follow-up',
  other: 'Reunião',
};

export interface LeadMeetingInfo {
  label: string;
  isPast: boolean;
}

function resolveLabel(altioraTipo: string | null, meetingType: string | null): string {
  // Chip estreito no card do pipeline: forma curta do nome do convite
  // ("Discovery"), não o código interno R1/R2/R3.
  if (altioraTipo) return nomeReuniaoCurto(altioraTipo);
  if (meetingType) return MEETING_TYPE_SHORT_LABELS[meetingType] || 'Reunião';
  return 'Reunião';
}

function resolveStartIso(m: { altiora_data_hora: string | null; date: string | null; start_time: string | null }): string {
  if (m.altiora_data_hora) return m.altiora_data_hora;
  if (m.date) return `${m.date}T${m.start_time ?? '00:00:00'}`;
  return m.start_time ?? '';
}

/**
 * Retorna, por lead_id, a reunião mais relevante: a próxima agendada
 * (mais próxima no futuro) ou, na ausência de agendamentos futuros, a
 * última realizada. Usada no card de pipeline (linha "Reunião").
 */
export const useLatestMeetingByLead = (leadIds: string[]) => {
  return useQuery({
    queryKey: ['latest-meeting-by-lead', leadIds],
    queryFn: async () => {
      if (!leadIds.length) return {};

      const { data, error } = await supabase
        .from('meetings')
        .select('leads_id, altiora_tipo, meeting_type, status, altiora_data_hora, date, start_time')
        .in('leads_id', leadIds)
        .not('status', 'in', '("cancelled","cancelado")');

      if (error) throw error;

      const now = Date.now();
      const bestByLead: Record<string, { startMs: number; label: string; isPast: boolean }> = {};

      (data || []).forEach((m) => {
        if (!m.leads_id) return;
        const startIso = resolveStartIso(m);
        const startMs = startIso ? new Date(startIso).getTime() : NaN;
        if (Number.isNaN(startMs)) return;

        const isPast = startMs < now;
        const label = resolveLabel(m.altiora_tipo, m.meeting_type);
        const current = bestByLead[m.leads_id];

        if (!current) {
          bestByLead[m.leads_id] = { startMs, label, isPast };
          return;
        }

        // Preferência: futuro mais próximo > passado mais recente.
        const currentIsFuture = !current.isPast;
        const candidateIsFuture = !isPast;

        if (candidateIsFuture && currentIsFuture) {
          if (startMs < current.startMs) bestByLead[m.leads_id] = { startMs, label, isPast };
        } else if (candidateIsFuture && !currentIsFuture) {
          bestByLead[m.leads_id] = { startMs, label, isPast };
        } else if (!candidateIsFuture && !currentIsFuture) {
          if (startMs > current.startMs) bestByLead[m.leads_id] = { startMs, label, isPast };
        }
      });

      const result: Record<string, LeadMeetingInfo> = {};
      Object.entries(bestByLead).forEach(([leadId, info]) => {
        result[leadId] = { label: info.label, isPast: info.isPast };
      });
      return result;
    },
    enabled: leadIds.length > 0,
    staleTime: 30000,
  });
};
