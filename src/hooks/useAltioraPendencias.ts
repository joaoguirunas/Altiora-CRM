/**
 * ALTIORA-25 UC15: Hook para alertas de referrals parados.
 *
 * Retorna 3 categorias de pendências:
 *   1. semCloser    — closer_id IS NULL e não terminal
 *   2. semAcao      — next_action_due_at IS NULL e não terminal
 *   3. parados      — updated_at < NOW() - INTERVAL 'N days' e não terminal
 *
 * AC3: polling de 30s via refetchInterval.
 * AC5: N dias padrão = 3 (configurável — TODO: Settings page).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

const sbUntyped = supabase as unknown as SupabaseClient;

// ── Constants ─────────────────────────────────────────────────────────────────

const ALTIORA_PIPELINE_ID = 'a1000000-0000-0000-0000-000000000001';
const DIAS_PARADO_DEFAULT  = 3; // AC5: TODO — carregar de settings

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendenciaReferral {
  id:             string;
  leads_stages_id: string;
  status:          string;
  value:           number | null;
  updated_at:      string;
  altiora_closer_id: string | null;
  next_action_due_at: string | null;
  pessoa?: { id: string; name?: string; nome?: string; } | null;
  stage?: { nome?: string; name?: string; } | null;
  closer?: { id: string; name?: string; } | null;
}

export interface PendenciasData {
  semCloser:  PendenciaReferral[];
  semAcao:    PendenciaReferral[];
  parados:    PendenciaReferral[];
  totalCount: number;
}

// ── Query ─────────────────────────────────────────────────────────────────────

const fetchPendencias = async (): Promise<PendenciasData> => {
  // Calcula data limite para "parados"
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - DIAS_PARADO_DEFAULT);

  // Base query: apenas in_progress do pipeline Altiora
  const { data, error } = await sbUntyped
    .from('leads')
    .select(`
      id, leads_stages_id, status, value, updated_at,
      altiora_closer_id, next_action_due_at,
      pessoa:people_id(id, name, nome),
      stage:leads_stages_id(nome, name),
      closer:altiora_closer_id(id, name)
    `)
    .eq('leads_pipelines_id', ALTIORA_PIPELINE_ID)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: true })
    .limit(200);

  if (error) throw error;

  const referrals = (data as PendenciaReferral[]) ?? [];

  const semCloser = referrals.filter(r => !r.altiora_closer_id);
  const semAcao   = referrals.filter(r => r.altiora_closer_id && !r.next_action_due_at);
  const parados   = referrals.filter(r =>
    r.altiora_closer_id &&
    r.next_action_due_at &&
    new Date(r.updated_at) < limitDate
  );

  return {
    semCloser,
    semAcao,
    parados,
    totalCount: semCloser.length + semAcao.length + parados.length,
  };
};

export const useAltioraPendencias = (enabled = true) => {
  return useQuery<PendenciasData>({
    queryKey: ['altiora-pendencias'],
    queryFn: fetchPendencias,
    enabled,
    staleTime: 30 * 1000,       // AC3: 30s polling
    refetchInterval: 30 * 1000, // AC3
    refetchIntervalInBackground: false,
    initialData: { semCloser: [], semAcao: [], parados: [], totalCount: 0 },
  });
};

/** Hook simplificado para o badge de count (AC4) */
export const useAltioraPendenciasCount = (enabled = true) => {
  const { data } = useAltioraPendencias(enabled);
  return data?.totalCount ?? 0;
};

export { DIAS_PARADO_DEFAULT };
