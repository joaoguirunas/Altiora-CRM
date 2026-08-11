import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { MeetingRecord } from '@/hooks/useMeetingRecords';

// `meetings.title` ainda não está nos types gerados (ver mesmo padrão em useAltioraMeetings.ts)
const sbUntyped = supabase as unknown as SupabaseClient;

export type AltioraTipo = 'R1' | 'R2' | 'R3';

export interface ElephanMeeting {
  id: string;
  altiora_tipo: AltioraTipo;
  title: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  altiora_duracao_minutos: number | null;
}

export interface ElephanTipoData {
  meeting: ElephanMeeting;
  records: MeetingRecord[];
}

export type ElephanReuniaoData = Partial<Record<AltioraTipo, ElephanTipoData>>;

/** Reuniões vindas da Elephan.ai (source='elephan') vinculadas a este lead, agrupadas por R1/R2/R3. */
export const useElephanReuniao = (leadId: string) =>
  useQuery({
    queryKey: ['elephan-reuniao', leadId],
    queryFn: async (): Promise<ElephanReuniaoData> => {
      const { data: meetings, error: meetingsError } = await sbUntyped
        .from('meetings')
        .select('id, altiora_tipo, title, date, start_time, end_time, altiora_duracao_minutos')
        .eq('leads_id', leadId)
        .eq('source', 'elephan')
        .not('altiora_tipo', 'is', null)
        .order('start_time', { ascending: true });

      if (meetingsError) throw meetingsError;
      const meetingRows = (meetings ?? []) as unknown as ElephanMeeting[];
      if (meetingRows.length === 0) return {};

      const meetingIds = meetingRows.map(m => m.id);
      const { data: records, error: recordsError } = await supabase
        .from('meeting_records')
        .select('*')
        .in('meeting_id', meetingIds)
        .eq('source', 'elephan');

      if (recordsError) throw recordsError;

      const result: ElephanReuniaoData = {};
      for (const meeting of meetingRows) {
        const tipo = meeting.altiora_tipo;
        if (!tipo) continue;
        result[tipo] = {
          meeting,
          records: (records || []).filter(r => r.meeting_id === meeting.id) as MeetingRecord[],
        };
      }
      return result;
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
