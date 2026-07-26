/**
 * useClientDrift / useAllClientsDrift — REL-03 AC8
 *
 * Queries `adm_client_drift` (not in generated types → @ts-expect-error pattern).
 * adm_client_drift migration: supabase/migrations_adm/20260725300000_adm_client_drift.sql
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
 * Returns all drift records for a specific client (all statuses, newest first).
 * Primary use: DriftModal (AC6 — Gamma) — shows open + repaired history.
 *
 * queryKey: ['adm-client-drift', clientId]
 * staleTime: 30s
 */
export function useClientDrift(clientId: string) {
  return useQuery({
    queryKey: ['adm-client-drift', clientId],
    queryFn: async (): Promise<ClientDrift[]> => {
      // @ts-expect-error — adm_client_drift not yet in generated types (REL-03 AC1 pending apply)
      const { data, error } = await supabase
        .from('adm_client_drift')
        .select('*')
        .eq('client_id', clientId)
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return ((data as unknown as Array<Record<string, unknown>>) ?? []).map(row => ({
        id:               String(row['id']),
        client_id:        String(row['client_id']),
        detected_at:      String(row['detected_at']),
        expected_hash:    String(row['expected_hash']),
        actual_hash:      String(row['actual_hash']),
        expected_release: String(row['expected_release']),
        diff_summary:     row['diff_summary'] != null ? String(row['diff_summary']) : null,
        status:           row['status'] as DriftStatus,
        repaired_at:      row['repaired_at'] != null ? String(row['repaired_at']) : null,
        repaired_by:      row['repaired_by'] != null ? String(row['repaired_by']) : null,
        created_at:       String(row['created_at']),
      }));
    },
    enabled: Boolean(clientId),
    staleTime: 30_000,
  });
}

// ─── useAllClientsDrift ───────────────────────────────────────────────────────

export interface AllDriftSummary {
  /**
   * List of client_ids that have at least one 'detected' (unresolved) drift record.
   * Used by DriftBadge to check `clientsWithDrift.includes(clientId)` without
   * issuing a per-row query.
   */
  clientsWithDrift: string[];
  /** = clientsWithDrift.length */
  count: number;
}

/**
 * Returns the list of client_ids with unresolved drift (status='detected').
 * One shared query for all DriftBadge instances — efficient for table rows.
 *
 * queryKey: ['adm-clients-drift-all']
 * staleTime: 60s | refetchInterval: 5min
 */
export function useAllClientsDrift() {
  return useQuery({
    queryKey: ['adm-clients-drift-all'],
    queryFn: async (): Promise<AllDriftSummary> => {
      // @ts-expect-error — adm_client_drift not yet in generated types (REL-03 AC1 pending apply)
      const { data, error } = await supabase
        .from('adm_client_drift')
        .select('client_id')
        .eq('status', 'detected');

      if (error) throw error;

      const rows = ((data as unknown as Array<{ client_id: string }>) ?? []);
      // DISTINCT in JS — Supabase JS v2 doesn't support SELECT DISTINCT natively
      const clientsWithDrift = [...new Set(rows.map(r => r.client_id))];

      return { clientsWithDrift, count: clientsWithDrift.length };
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
