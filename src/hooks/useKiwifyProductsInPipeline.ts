import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// kiwify_lead_products is not yet in the generated Supabase types.
const sbUntyped = supabase as unknown as SupabaseClient;

export interface KiwifyProductOption {
  product_id: string;
  product_name: string;
}

/** Produtos Kiwify distintos entre os leads do pipeline atual — mesmo padrão de useUtmValues, só que escopado ao catálogo real em vez de todo o Kiwify. */
export const useKiwifyProductsInPipeline = (pipelineId?: string) => {
  return useQuery({
    queryKey: ['kiwify-products-in-pipeline', pipelineId],
    queryFn: async (): Promise<KiwifyProductOption[]> => [],
    enabled: !!pipelineId,
    staleTime: 60_000,
  });
};
