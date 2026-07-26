/**
 * ALTIORA-17: Hook para dados de resultado da R2 (UC26).
 * ALTIORA-18: Hook para dados de resultado da R3 (UC27).
 *
 * Usa as tabelas `altiora_r2_data` e `altiora_r3_data`
 * (migration 20260725210000) com padrão idêntico ao altiora_r1_data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// sbUntyped para tabelas não geradas e campos next_action_*
const sbUntyped = supabase as unknown as SupabaseClient;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResultadoR2 {
  produto_apresentado?: string;   // 'previdencia' | 'seguro_vida' | 'investimentos' | 'protecao_patrimonial' | 'combo'
  objecoes?: string;
  nivel_interesse?: string;       // 'alto' | 'medio' | 'baixo' | 'sem_interesse'
  resultado_geral?: string;
}

export interface ResultadoR3 {
  estrutura_confirmada?: string;  // 'previdencia' | 'seguro_vida' | 'investimentos' | 'combo' | 'pendente'
  valor_estimado?: number;
  compareceu?: boolean;
  resultado_geral?: string;
  decisao_cliente?: string;       // 'avançar' | 'nao_avançar' | 'continuar'
}

interface R2Row {
  lead_id: string;
  resultado: ResultadoR2;
  data_r3_prevista: string | null;
  created_at: string;
  updated_at: string;
}

interface R3Row {
  lead_id: string;
  resultado: ResultadoR3;
  decisao_cliente: string | null;
  created_at: string;
  updated_at: string;
}

// ── R2 Hooks ──────────────────────────────────────────────────────────────────

export const useR2Data = (leadId: string | undefined) => {
  return useQuery<R2Row | null>({
    queryKey: ['altiora-r2-data', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await sbUntyped
        .from('altiora_r2_data')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as R2Row | null;
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });
};

export interface SaveR2Payload {
  leadId: string;
  actorId: string;
  resultado: ResultadoR2;
  dataR3Prevista?: string;
}

export const useSaveR2Data = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveR2Payload) => {
      const { leadId, actorId, resultado, dataR3Prevista } = payload;

      const { error } = await sbUntyped
        .from('altiora_r2_data')
        .upsert(
          {
            lead_id:          leadId,
            resultado:        resultado,
            data_r3_prevista: dataR3Prevista ?? null,
            updated_by:       actorId,
          },
          { onConflict: 'lead_id', ignoreDuplicates: false },
        );

      if (error) throw error;

      // Salvar data R3 em next_action_due_at se informada
      if (dataR3Prevista) {
        await sbUntyped.from('leads').update({
          next_action_type:        'Reunião',
          next_action_description: 'R3 prevista',
          next_action_due_at:      new Date(dataR3Prevista).toISOString(),
        }).eq('id', leadId);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-r2-data', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      toast.success('Resultado da R2 salvo!');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar R2';
      toast.error(msg);
    },
  });
};

// ── R3 Hooks ──────────────────────────────────────────────────────────────────

export const useR3Data = (leadId: string | undefined) => {
  return useQuery<R3Row | null>({
    queryKey: ['altiora-r3-data', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await sbUntyped
        .from('altiora_r3_data')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as R3Row | null;
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });
};

export interface SaveR3Payload {
  leadId: string;
  actorId: string;
  resultado: ResultadoR3;
  decisaoCliente?: string;
}

export const useSaveR3Data = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveR3Payload) => {
      const { leadId, actorId, resultado, decisaoCliente } = payload;

      const { error } = await sbUntyped
        .from('altiora_r3_data')
        .upsert(
          {
            lead_id:         leadId,
            resultado:       resultado,
            decisao_cliente: decisaoCliente ?? null,
            updated_by:      actorId,
          },
          { onConflict: 'lead_id', ignoreDuplicates: false },
        );

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-r3-data', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar R3';
      toast.error(msg);
    },
  });
};
