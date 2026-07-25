/**
 * useAltioraFinvity — Hook para leitura e persistência da Análise Finvity
 *
 * Tabela: altiora_finvity_analise
 * Migration: 20260725150000_altiora_finvity.sql
 *
 * Caso de uso: UC25 — Registrar Análise do Finvity (ALTIORA-16)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// altiora_finvity_analise não está nos tipos gerados (migration 20260725150000_altiora_finvity.sql)
const sbUntyped = supabase as unknown as SupabaseClient;

// ── Types ────────────────────────────────────────────────────────────────────

export interface FinvityAnalise {
  id: string;
  lead_id: string;
  finvity_link: string | null;
  finvity_arquivo_url: string | null;
  dores: string[];
  necessidades: string[];
  produtos_sugeridos: string[];
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinvityAnaliseInput {
  lead_id: string;
  finvity_link?: string | null;
  finvity_arquivo_url?: string | null;
  dores?: string[];
  necessidades?: string[];
  produtos_sugeridos?: string[];
  notas?: string | null;
}

// ── Query key factory ────────────────────────────────────────────────────────

const finvityKey = (leadId: string) => ['altiora-finvity', leadId] as const;

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Lê a análise Finvity de um referral.
 * Retorna null quando ainda não foi registrada.
 */
export const useFinvityAnalise = (leadId: string | undefined) => {
  return useQuery({
    queryKey: finvityKey(leadId ?? ''),
    queryFn: async (): Promise<FinvityAnalise | null> => {
      if (!leadId) return null;
      const { data, error } = await sbUntyped
        .from('altiora_finvity_analise')
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

/**
 * Salva (upsert) a análise Finvity.
 * A constraint UNIQUE(lead_id) garante que só existe 1 análise ativa por referral.
 */
export const useSaveFinvityAnalise = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FinvityAnaliseInput): Promise<FinvityAnalise> => {
      const { lead_id, ...rest } = input;

      const { data, error } = await sbUntyped
        .from('altiora_finvity_analise')
        .upsert(
          { lead_id, ...rest },
          { onConflict: 'lead_id', ignoreDuplicates: false }
        )
        .select()
        .single();

      if (error) throw error;
      return data as FinvityAnalise;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: finvityKey(data.lead_id) });
      toast.success('Análise Finvity salva!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar análise Finvity: ' + error.message);
    },
  });
};

/**
 * Upload de arquivo PDF para o bucket referral-docs/{lead_id}/finvity/
 * Retorna a URL pública do arquivo armazenado.
 *
 * AC5: bucket 'referral-docs' — criar política no Supabase Dashboard se não existir.
 */
export const useUploadFinvityArquivo = () => {
  return useMutation({
    mutationFn: async ({
      file,
      leadId,
    }: {
      file: File;
      leadId: string;
    }): Promise<string> => {
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB (AC1)
      if (file.size > MAX_SIZE) {
        throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB.`);
      }

      if (file.type !== 'application/pdf') {
        throw new Error('Apenas arquivos PDF são aceitos para o relatório Finvity.');
      }

      const path = `${leadId}/finvity/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('referral-docs')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('referral-docs')
        .getPublicUrl(path);

      return urlData.publicUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
