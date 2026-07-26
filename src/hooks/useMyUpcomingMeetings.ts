import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UpcomingMeetingLead {
  id: string;
  people_id: string;
}

export interface UpcomingMeeting {
  id: string;
  /** DB: leads_id */
  leads_id: string | null;
  /** DB: altiora_data_hora — full ISO datetime for Altiora meetings */
  altiora_data_hora: string | null;
  /** DB: start_time — time string (HH:mm:ss) when altiora_data_hora is absent */
  start_time: string;
  /** DB: end_time — time string (HH:mm:ss) */
  end_time: string;
  /** DB: date — date string (YYYY-MM-DD) */
  date: string;
  status: string | null;
  meeting_type: string | null;
  /** Resolved ISO start datetime for display */
  startIso: string;
}

export const useMyUpcomingMeetings = () => {
  const { user } = useAuth();
  const profileId = user?.profile?.id;

  const query = useQuery({
    queryKey: ['my-upcoming-meetings', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const now = new Date().toISOString();

      // meetings table uses users_id for the assigned closer
      const { data, error } = await supabase
        .from('meetings')
        .select('id, leads_id, altiora_data_hora, start_time, end_time, date, status, meeting_type')
        .eq('users_id', profileId!)
        .neq('status', 'cancelled')
        .neq('status', 'cancelado')
        .gte('altiora_data_hora', now)
        .order('altiora_data_hora', { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;

      return (data ?? []).map((m) => ({
        ...m,
        // Resolve a display-ready ISO datetime
        startIso:
          m.altiora_data_hora ??
          (m.date ? `${m.date}T${m.start_time ?? '00:00:00'}` : m.start_time ?? ''),
      })) as UpcomingMeeting[];
    },
    staleTime: 60_000,
  });

  return {
    meetings: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};
