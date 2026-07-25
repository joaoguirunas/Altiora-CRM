/**
 * useRepairDrift — REL-03 AC8
 *
 * Mutation that invokes edge function `adm-drift-repair` (AC7 — dev-beta).
 * Invalidates drift queries on success so DriftBadge + DriftModal update automatically.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepairDriftParams {
  /** ID of the specific adm_client_drift row to repair */
  driftId: string;
  /** ADM client UUID — used to invalidate the per-client drift query */
  clientId: string;
}

// ─── Mutation ────────────────────────────────────────────────────────────────

/**
 * Calls `adm-drift-repair` edge function (AC7).
 * Body: `{ client_id, drift_id }`.
 * On success: invalidates ['adm-client-drift', clientId] + ['adm-clients-drift-all'].
 */
export function useRepairDrift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, driftId }: RepairDriftParams): Promise<void> => {
      const { error } = await supabase.functions.invoke('adm-drift-repair', {
        body: { client_id: clientId, drift_id: driftId },
      });
      if (error) throw error;
    },
    onSuccess: (_data, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['adm-client-drift', clientId] });
      qc.invalidateQueries({ queryKey: ['adm-clients-drift-all'] });
      toast.success('Drift reparado com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(`Falha ao reparar drift: ${err.message}`);
    },
  });
}
