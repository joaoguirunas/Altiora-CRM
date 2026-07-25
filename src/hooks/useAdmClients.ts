/**
 * useAdmClients — ADM control plane hooks (REL-02)
 *
 * In standalone deployment, supabase === control plane (same project).
 * All mutations require super_admin = true (enforced by RLS on adm_* tables).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { type Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdmClient = Database['public']['Tables']['adm_clients']['Row'];
export type AdmSyncJob = Database['public']['Tables']['adm_sync_jobs']['Row'];
export type AdmSyncLog = Database['public']['Tables']['adm_sync_logs']['Row'];
export type AdmRelease = Database['public']['Tables']['adm_releases']['Row'];
export type AdmClientVersion = Database['public']['Tables']['adm_client_versions']['Row'];
export type AdmAuditLog = Database['public']['Tables']['adm_audit_log']['Row'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fire-and-forget audit log insert. Never throws. */
export async function insertAuditLog(params: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_name?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('adm_audit_log').insert({
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      entity_name: params.entity_name ?? null,
      details: params.details ?? {},
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? 'unknown',
    });
  } catch {
    // Intentional: audit log failures are silent
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List all ADM clients, ordered by name. staleTime: 60s */
export function useAdmClients() {
  return useQuery({
    queryKey: ['adm-clients'],
    queryFn: async (): Promise<AdmClient[]> => {
      const { data, error } = await supabase
        .from('adm_clients')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** Sync jobs, optionally filtered by clientId. staleTime: 15s, refetch 8s */
export function useAdmSyncJobs(clientId?: string) {
  return useQuery({
    queryKey: ['adm-sync-jobs', clientId ?? 'all'],
    queryFn: async (): Promise<(AdmSyncJob & { client_name?: string | null })[]> => {
      let q = supabase
        .from('adm_sync_jobs')
        .select('*, adm_clients!inner(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        client_name: (row.adm_clients as { name: string } | null)?.name ?? null,
      }));
    },
    staleTime: 15_000,
    refetchInterval: 8_000,
  });
}

/** Logs for a specific job. staleTime: 0, refetch 3s */
export function useAdmSyncLogs(jobId?: string) {
  return useQuery({
    queryKey: ['adm-sync-logs', jobId ?? 'none'],
    queryFn: async (): Promise<AdmSyncLog[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('adm_sync_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!jobId,
    staleTime: 0,
    refetchInterval: jobId ? 3_000 : false,
  });
}

/** Audit log with optional filters. */
export function useAdmAuditLog(filters?: {
  action?: string;
  entity_type?: string;
  page?: number;
}) {
  const page = filters?.page ?? 0;
  const pageSize = 30;
  return useQuery({
    queryKey: ['adm-audit-log', filters?.action, filters?.entity_type, page],
    queryFn: async (): Promise<AdmAuditLog[]> => {
      let q = supabase
        .from('adm_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (filters?.action) q = q.eq('action', filters.action);
      if (filters?.entity_type) q = q.eq('entity_type', filters.entity_type);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/** Client version history ordered by applied_at DESC (limit 20). */
export function useAdmClientVersions(clientId: string) {
  return useQuery({
    queryKey: ['adm-client-versions', clientId],
    queryFn: async (): Promise<AdmClientVersion[]> => {
      const { data, error } = await supabase
        .from('adm_client_versions')
        .select('*')
        .eq('client_id', clientId)
        .order('applied_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateAdmClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['adm_clients']['Insert']) => {
      const { data, error } = await supabase
        .from('adm_clients')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      await insertAuditLog({
        action: 'client.created',
        entity_type: 'adm_clients',
        entity_id: data.id,
        entity_name: data.name,
        details: { slug: data.slug },
      });
      return data as AdmClient;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adm-clients'] });
      toast.success('Cliente criado com sucesso');
    },
    onError: (err: Error) => toast.error('Erro ao criar cliente: ' + err.message),
  });
}

export function useUpdateAdmClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data: update }: {
      id: string;
      data: Database['public']['Tables']['adm_clients']['Update'];
    }) => {
      const { data, error } = await supabase
        .from('adm_clients')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await insertAuditLog({
        action: 'client.updated',
        entity_type: 'adm_clients',
        entity_id: id,
        entity_name: data.name,
      });
      return data as AdmClient;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adm-clients'] });
    },
    onError: (err: Error) => toast.error('Erro ao atualizar cliente: ' + err.message),
  });
}

export function useDeleteAdmClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('adm_clients').delete().eq('id', id);
      if (error) throw error;
      await insertAuditLog({
        action: 'client.deleted',
        entity_type: 'adm_clients',
        entity_id: id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adm-clients'] });
      toast.success('Cliente removido');
    },
    onError: (err: Error) => toast.error('Erro ao remover cliente: ' + err.message),
  });
}

export function useSyncClientNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('adm-sync-client', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      return data as { success: boolean; applied: number; failed: number; job_id?: string };
    },
    onSuccess: (_, clientId) => {
      qc.invalidateQueries({ queryKey: ['adm-clients'] });
      qc.invalidateQueries({ queryKey: ['adm-sync-jobs', clientId] });
    },
    onError: (err: Error) => {
      if (err.message.includes('409') || err.message.toLowerCase().includes('em andamento')) {
        toast.warning('Já existe um sync em andamento para este cliente');
      } else {
        toast.error('Erro ao iniciar sync: ' + err.message);
      }
    },
  });
}

export function useCheckHealth() {
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('adm-health-check', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      return data as {
        status: 'healthy' | 'degraded' | 'down';
        db_version?: string;
        system_version?: string;
        error?: string;
      };
    },
  });
}

// ─── REL-02: Release update hooks ────────────────────────────────────────────

/** AC6: trigger update for a single client — insert sync job + invoke edge fn */
export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      targetVersion,
    }: {
      clientId: string;
      targetVersion: string;
    }): Promise<{ jobId: string }> => {
      // 1. INSERT sync job as pending
      const { data: job, error: jobErr } = await supabase
        .from('adm_sync_jobs')
        .insert({
          client_id: clientId,
          status: 'pending',
          type: 'version_update',
          triggered_by: 'ui',
        })
        .select()
        .single();
      if (jobErr) throw jobErr;

      // 2. Invoke adm-sync-client with target_version
      const { error: fnErr } = await supabase.functions.invoke('adm-sync-client', {
        body: { client_id: clientId, target_version: targetVersion },
      });
      if (fnErr) {
        // Mark job as failed if fn invoke fails
        await supabase.from('adm_sync_jobs').update({
          status: 'failed',
          error_message: fnErr.message,
          completed_at: new Date().toISOString(),
        }).eq('id', job.id);
        throw fnErr;
      }

      // 3. Audit log
      const { data: clientRow } = await supabase
        .from('adm_clients')
        .select('name, current_version')
        .eq('id', clientId)
        .single();
      await insertAuditLog({
        action: 'client.updated_to_release',
        entity_type: 'adm_clients',
        entity_id: clientId,
        entity_name: clientRow?.name ?? clientId,
        details: {
          from_version: clientRow?.current_version ?? null,
          to_version: targetVersion,
          sync_job_id: job.id,
        },
      });

      return { jobId: job.id };
    },
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: ['adm-clients'] });
      qc.invalidateQueries({ queryKey: ['adm-sync-jobs', clientId] });
    },
    onError: (err: Error) => toast.error('Erro ao atualizar cliente: ' + err.message),
  });
}

const MAX_PARALLEL_UPDATES = 5;

/** AC6: bulk update — fan-out with max 5 concurrent */
export function useBulkUpdateClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientIds,
      targetVersion,
    }: {
      clientIds: string[];
      targetVersion: string;
    }): Promise<{ results: Array<{ clientId: string; jobId?: string; error?: string }> }> => {
      const results: Array<{ clientId: string; jobId?: string; error?: string }> = [];

      // Process in batches of MAX_PARALLEL_UPDATES
      for (let i = 0; i < clientIds.length; i += MAX_PARALLEL_UPDATES) {
        const batch = clientIds.slice(i, i + MAX_PARALLEL_UPDATES);
        const batchResults = await Promise.allSettled(
          batch.map(async (clientId) => {
            const { data: job, error: jobErr } = await supabase
              .from('adm_sync_jobs')
              .insert({
                client_id: clientId,
                status: 'pending',
                type: 'version_update',
                triggered_by: 'ui_bulk',
              })
              .select()
              .single();
            if (jobErr) throw jobErr;

            const { error: fnErr } = await supabase.functions.invoke('adm-sync-client', {
              body: { client_id: clientId, target_version: targetVersion },
            });
            if (fnErr) {
              await supabase.from('adm_sync_jobs').update({
                status: 'failed',
                error_message: fnErr.message,
                completed_at: new Date().toISOString(),
              }).eq('id', job.id);
              throw fnErr;
            }

            return { clientId, jobId: job.id };
          })
        );

        for (let j = 0; j < batch.length; j++) {
          const r = batchResults[j];
          if (r.status === 'fulfilled') {
            results.push(r.value);
          } else {
            results.push({ clientId: batch[j], error: (r.reason as Error).message });
          }
        }
      }

      await insertAuditLog({
        action: 'client.bulk_update',
        entity_type: 'adm_clients',
        details: {
          target_version: targetVersion,
          client_count: clientIds.length,
          success_count: results.filter(r => !r.error).length,
          fail_count: results.filter(r => !!r.error).length,
        },
      });

      return { results };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adm-clients'] });
      qc.invalidateQueries({ queryKey: ['adm-sync-jobs'] });
    },
    onError: (err: Error) => toast.error('Erro no bulk update: ' + err.message),
  });
}
