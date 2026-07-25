/**
 * ALTIORA-15: Hook para dados de diagnóstico da R1 (UC24).
 *
 * Usa a tabela `altiora_r1_data` (migration 20260725140000) que armazena
 * os campos do playbook em `diagnostico` (JSONB) e a data prevista da R2.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

// sbUntyped para campos next_action_* que não estão nos tipos gerados
const sbUntyped = supabase as unknown as SupabaseClient;

// ── Types ─────────────────────────────────────────────────────────────────────

type R1DataRow = Database['public']['Tables']['altiora_r1_data']['Row'];

/** Campos do playbook de diagnóstico R1 */
export interface DiagnosticoR1 {
  situacao_patrimonial?: string;       // 'acima_300k' | '150k_300k' | 'abaixo_150k'
  renda_mensal_estimada?: number;
  perfil_risco?: string;               // 'conservador' | 'moderado' | 'arrojado'
  produtos_interesse?: string[];
  objecoes?: string;
  score_interesse?: number;            // 1-5
  observacoes?: string;
}

export interface R1DataPayload {
  leadId: string;
  actorId: string;
  diagnostico: DiagnosticoR1;
  /** ISO date — data prevista da R2; salva em leads.next_action_due_at */
  dataR2Prevista?: string;
}

// ── Hook: ler dados R1 ────────────────────────────────────────────────────────

export const useR1Data = (leadId: string | undefined) => {
  return useQuery<R1DataRow | null>({
    queryKey: ['altiora-r1-data', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('altiora_r1_data')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });
};

// ── Hook: salvar/atualizar dados R1 ──────────────────────────────────────────

export const useSaveR1Data = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: R1DataPayload) => {
      const { leadId, actorId, diagnostico, dataR2Prevista } = payload;

      // 1. Upsert em altiora_r1_data
      const { error: r1Error } = await supabase
        .from('altiora_r1_data')
        .upsert(
          {
            lead_id:          leadId,
            diagnostico:      diagnostico as Record<string, unknown>,
            data_r2_prevista: dataR2Prevista ?? null,
            updated_by:       actorId,
          },
          { onConflict: 'lead_id', ignoreDuplicates: false },
        );

      if (r1Error) throw r1Error;

      // 2. Se data_r2_prevista informada, salvar em leads.next_action_due_at
      if (dataR2Prevista) {
        const { error: leadError } = await sbUntyped
          .from('leads')
          .update({
            next_action_type:        'Reunião',
            next_action_description: 'R2 prevista',
            next_action_due_at:      new Date(dataR2Prevista).toISOString(),
          })
          .eq('id', leadId);

        if (leadError) throw leadError;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-r1-data', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      toast.success('Diagnóstico R1 salvo!');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar diagnóstico R1';
      toast.error(msg);
    },
  });
};
