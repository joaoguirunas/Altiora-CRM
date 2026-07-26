import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MyBookingRuleSet {
  id: string;
  name: string;
  url_id: number | null;
  is_active: boolean;
  owner_user_id: string;
}

export const useMyBookingRuleSet = () => {
  const { user } = useAuth();
  const profileId = user?.profile?.id;

  const query = useQuery({
    queryKey: ['my-booking-rule-set', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      // owner_user_id is added by migration 20260726100000 — cast to bypass stale types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('booking_rule_sets')
        .select('id, name, url_id, is_active, owner_user_id')
        .eq('owner_user_id', profileId!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MyBookingRuleSet | null;
    },
    staleTime: 60_000,
  });

  return {
    ruleSet: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};
