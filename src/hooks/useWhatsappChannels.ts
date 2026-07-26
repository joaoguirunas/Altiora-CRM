import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsappChannel {
  id: string;
  label: string;
  phone_number_id: string;
  waba_id?: string | null;
  is_default: boolean;
  active: boolean;
}

export const useWhatsappChannels = () => {
  return useQuery({
    queryKey: ['whatsapp-channels', 'active'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('settings_whatsapp_channels')
        .select('id, label, phone_number_id, waba_id, is_default, active')
        .eq('active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return (data ?? []) as WhatsappChannel[];
    },
  });
};
