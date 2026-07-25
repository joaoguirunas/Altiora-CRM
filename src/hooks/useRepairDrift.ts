/**
 * useRepairDrift — REL-03 AC8
 *
 * Mutation to trigger drift repair for a specific drift record.
 *
 * TODO(alpha/beta): once `adm-drift-repair` edge fn (AC7) is deployed,
 *   replace the direct UPDATE with an edge function call:
 *   await supabase.functions.invoke('adm-drift-repair', { body: { drift_id } })
 *
 * For now: marks the drift record as 'repaired' directly (stub for UI wiring).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbUntyped = supabase as unknown as SupabaseClient<any>;

export interface RepairDriftParams {
  driftId: string;
  clientId: string;
}

/**
 * Calls adm-drift-repair edge fn (AC7 — TODO) or falls back to direct UPDATE.
 * Invalidates drift queries on success.
 */
export function useRepairDrift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ driftId }: RepairDriftParams): Promise<void> => {
      // TODO(beta-AC7): replace with edge fn call when adm-drift-repair is live:
      // const { error } = await supabase.functions.invoke('adm-drift-repair', {
      //   body: { drift_id: driftId },
      // });

      // Stub: mark as repaired directly via service-role-compatible update
      const { error } = await sbUntyped
        .from('adm_client_drift')
        .update({
          status:      'repaired',
          repaired_at: new Date().toISOString(),
        })
        .eq('id', driftId)
        .eq('status', 'detected');

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['adm-client-drift', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['adm-all-clients-drift'] });
      toast.success('Drift reparado com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(`Falha ao reparar drift: ${err.message}`);
    },
  });
}
