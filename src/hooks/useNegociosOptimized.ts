import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useMemo, useEffect } from 'react';

// kiwify_lead_products is not yet in the generated Supabase types; access the
// leads query through an untyped view so the nested course join type-checks.
const sbUntyped = supabase as unknown as SupabaseClient;

export interface NegocioOptimized {
  id: string;
  title?: string;
  value?: number;
  status?: string;
  leads_stages_id: string;
  leads_pipelines_id: string;
  people_id?: string;
  company_id?: string;
  user_id?: string;
  teams_id?: string;
  created_at: string;
  updated_at?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // Campos Altiora (ALTIORA-03/09) — nullable; só preenchidos no pipeline Altiora
  /** Closer responsável pelo referral (FK settings_users) */
  altiora_closer_id?: string | null;
  /** Timestamp da última interação registrada no lead */
  last_interaction_at?: string | null;
  /**
   * Origem do referral Altiora: 'avenue_email' | 'manual' | 'outros'
   * (ALTIORA-09 AC1, migration 20260725120000)
   */
  altiora_origem?: string | null;
  // TODO ALTIORA-03: adicionar stage_entered_at quando migration for aplicada
  // TODO ALTIORA-03: adicionar next_action_type, next_action_description, next_action_due_at quando migration for aplicada
  pessoa?: {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    score_matrix?: { name: string; score_number: number } | null;
  } | null;
  empresa?: null;
}

interface NegocioFilters {
  stageId?: string;
  status?: string;
  user_id?: string;
  teams_id?: string;
  dataInicio?: string;
  dataFim?: string;
  searchFilter?: string;
  scoreMatrixId?: string;
  utm_campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_term?: string;
  utm_content?: string;
  motivoFilter?: string | null;
  /**
   * Filtro por Closer Altiora — filtra por `altiora_closer_id` (ALTIORA-10 AC1).
   * Apenas utilizado no pipeline Altiora.
   */
  closerIdFilter?: string;
  /**
   * Filtro por origem do referral Altiora — filtra por `altiora_origem` (ALTIORA-09 AC1).
   * Valores válidos: 'avenue_email' | 'manual' | 'outros'
   */
  origemFilter?: string;
}

export const useNegociosPipeline = (pipelineId: string, filters?: NegocioFilters) => {
  const queryClient = useQueryClient();

  // Realtime: invalidate whenever any lead is inserted/updated in this pipeline
  useEffect(() => {
    if (!pipelineId) return;
    let isMounted = true;
    const channel = supabase
      .channel(`leads-pipeline-${pipelineId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `leads_pipelines_id=eq.${pipelineId}` },
        () => {
          if (isMounted) {
            queryClient.invalidateQueries({ queryKey: ['negocios-pipeline', pipelineId], type: 'active' });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[useNegociosPipeline] Realtime subscription error for pipeline', pipelineId);
        }
      });
    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [pipelineId, queryClient]);

  return useQuery({
    queryKey: ['negocios-pipeline', pipelineId, filters],
    queryFn: async () => {
      if (!pipelineId) return [];
      
      let query = sbUntyped
        .from('leads')
        .select(`
          *,
          pessoa:clients_people(id, name, email, whatsapp, score_matrix:score_matrix(name, score_number))
        `)
        .eq('leads_pipelines_id', pipelineId);

      const statusDbMap: Record<string, string> = {
        perdido: 'lost',
        ganho: 'won',
        'em-andamento': 'in_progress',
      };

      if (filters?.stageId) query = query.eq('leads_stages_id', filters.stageId);
      if (filters?.status === 'sem-perdidos') query = query.neq('status', 'lost');
      else if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', statusDbMap[filters.status] ?? filters.status);
      }
      if (filters?.motivoFilter) query = query.eq('leads_loss_reasons_id', filters.motivoFilter);
      if (filters?.user_id) query = query.eq('users_id', filters.user_id);
      if (filters?.teams_id) query = query.or(`teams_id.eq.${filters.teams_id},teams_id.is.null`);
      if (filters?.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters?.dataFim) query = query.lte('created_at', filters.dataFim);
      if (filters?.utm_campaign) query = query.eq('utm_campaign', filters.utm_campaign);
      if (filters?.utm_source) query = query.eq('utm_source', filters.utm_source);
      if (filters?.utm_medium) query = query.eq('utm_medium', filters.utm_medium);
      if (filters?.utm_term) query = query.eq('utm_term', filters.utm_term);
      if (filters?.utm_content) query = query.eq('utm_content', filters.utm_content);
      if (filters?.searchFilter) {
        query = query.or(
          `title.ilike.%${filters.searchFilter}%,` +
          `clients_people.name.ilike.%${filters.searchFilter}%,` +
          `clients_people.email.ilike.%${filters.searchFilter}%,` +
          `clients_people.whatsapp.ilike.%${filters.searchFilter}%`
        );
      }
      // AC1 (ALTIORA-10): filtro por Closer responsável via altiora_closer_id
      if (filters?.closerIdFilter) query = query.eq('altiora_closer_id', filters.closerIdFilter);
      // AC1 (ALTIORA-09): filtro por origem do referral via altiora_origem
      if (filters?.origemFilter) query = query.eq('altiora_origem', filters.origemFilter);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((d: any) => ({
        ...d,
        leads_stages_id: d.leads_stages_id,
        leads_pipelines_id: d.leads_pipelines_id,
        pessoa: d.pessoa,
        empresa: d.empresa,
      })) as NegocioOptimized[];
    },
    enabled: !!pipelineId,
  });
};

export const useNegociosByStage = (
  pipelineId: string,
  stageIds: string[],
  filters?: Omit<NegocioFilters, 'stageId'>
) => {
  const { data: allNegocios = [], isLoading } = useNegociosPipeline(pipelineId, filters);

  const negociosByStage = useMemo(() => {
    const grouped: Record<string, NegocioOptimized[]> = {};
    stageIds.forEach(id => { grouped[id] = []; });
    allNegocios.forEach(n => {
      if (n.leads_stages_id && grouped[n.leads_stages_id]) {
        grouped[n.leads_stages_id].push(n);
      } else if (stageIds.length > 0) {
        // Fallback: leads without valid stage go to the first stage column
        grouped[stageIds[0]].push(n);
      }
    });
    return grouped;
  }, [allNegocios, stageIds]);

  const totalByStage = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(negociosByStage).forEach(([stageId, negocios]) => {
      totals[stageId] = negocios.reduce((sum, n) => sum + (n.value || 0), 0);
    });
    return totals;
  }, [negociosByStage]);

  return { negociosByStage, totalByStage, isLoading };
};
