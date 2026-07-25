/**
 * useClientDrift / useAllClientsDrift — REL-03 AC8
 *
 * Queries `adm_client_drift` (not in generated types → sbUntyped pattern).
 *
 * TODO(alpha): replace stub implementation with full version once
 *   adm-drift-check edge fn (AC2) is live and types are regenerated.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbUntyped = supabase as unknown as SupabaseClient<any>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DriftStatus = 'detected' | 'repaired' | 'acknowledged_persistent';

export interface ClientDrift {
  id: string;
  client_id: string;
  detected_at: string;
  expected_hash: string;
  actual_hash: string;
  expected_release: string;
  diff_summary: string | null;
  status: DriftStatus;
  repaired_at: string | null;
  repaired_by: string | null;
  created_at: string;
}

// ─── useClientDrift ───────────────────────────────────────────────────────────

/**
 * Returns all drift records for a specific client (any status).
 * Primary use: DriftModal content.
 */
export function useClientDrift(clientId: string) {
  return useQuery({
    queryKey: ['adm-client-drift', clientId],
    queryFn: async (): Promise<ClientDrift[]> => {
      const { data, error } = await sbUntyped
        .from('adm_client_drift')
        .select('*')
        .eq('client_id', clientId)
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id:               String(row.id),
        client_id:        String(row.client_id),
        detected_at:      String(row.detected_at),
        expected_hash:    String(row.expected_hash),
        actual_hash:      String(row.actual_hash),
        expected_release: String(row.expected_release),
        diff_summary:     row.diff_summary ? String(row.diff_summary) : null,
        status:           row.status as DriftStatus,
        repaired_at:      row.repaired_at ? String(row.repaired_at) : null,
        repaired_by:      row.repaired_by ? String(row.repaired_by) : null,
        created_at:       String(row.created_at),
      }));
    },
    enabled: Boolean(clientId),
    staleTime: 30_000,
  });
}

// ─── useAllClientsDrift ───────────────────────────────────────────────────────

export interface AllDriftSummary {
  /** Number of clients with at least one 'detected' drift record */
  clientsWithDrift: number;
  /** Total 'detected' drift records across all clients */
  totalDetected: number;
}

/**
 * Returns aggregated drift summary for the Adm.tsx stats card.
 * Counts distinct clients that have status='detected' drift.
 */
export function useAllClientsDrift() {
  return useQuery({
    queryKey: ['adm-all-clients-drift'],
    queryFn: async (): Promise<AllDriftSummary> => {
      const { data, error } = await sbUntyped
        .from('adm_client_drift')
        .select('client_id')
        .eq('status', 'detected');

      if (error) throw error;

      const rows = (data ?? []) as Array<{ client_id: string }>;
      const uniqueClients = new Set(rows.map(r => r.client_id));

      return {
        clientsWithDrift: uniqueClients.size,
        totalDetected:    rows.length,
      };
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // refresh every 5 min
  });
}
