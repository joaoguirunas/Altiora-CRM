import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMessageCountByLead = (leadIds: string[]) => {
  return useQuery({
    queryKey: ['message-count-by-lead', leadIds],
    queryFn: async () => {
      if (!leadIds.length) return {};
      
      const counts: Record<string, number> = {};
      
      // Batch query
      const { data, error } = await supabase
        .from('messages')
        .select('leads_id')
        .in('leads_id', leadIds);

      if (error) throw error;

      (data || []).forEach((msg: { leads_id: string }) => {
        counts[msg.leads_id] = (counts[msg.leads_id] || 0) + 1;
      });
      
      return counts;
    },
    enabled: leadIds.length > 0,
    staleTime: 30000,
  });
};
