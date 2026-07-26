/**
 * useFupProgramados — FUP-AUTO-01 UI-1
 *
 * Queries the `fup_programados` table (FUP-AUTO-01) for the global view
 * in the Followups page "Programado" tab.
 *
 * fup_programados is not in generated types → uses sbUntyped pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbUntyped = supabase as unknown as SupabaseClient<any>;

export type FupStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled';
export type FupTipo = 'etapa_crm' | 'agendamento' | 'programado';

export interface FupProgramado {
  id: string;
  lead_id: string;
  people_id: string | null;
  person_name: string | null;
  agent_id: string | null;
  tipo: FupTipo;
  etapa_id: string | null;
  template_id: string | null;
  mensagem: string | null;
  agendamento_titulo: string | null;
  motivo: string | null;
  scheduled_at: string;
  fired_at: string | null;
  status: FupStatus;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

const QK = 'fup-programados';

export function useFupProgramados(status?: FupStatus | 'all') {
  return useQuery({
    queryKey: [QK, status ?? 'all'],
    queryFn: async (): Promise<FupProgramado[]> => {
      let q = sbUntyped
        .from('fup_programados')
        .select(`
          id, lead_id, people_id, agent_id, tipo,
          etapa_id, template_id, mensagem, agendamento_titulo, motivo,
          scheduled_at, fired_at, status, error_message, retry_count, created_at,
          person:clients_people!people_id (name)
        `)
        .is('deleted_at', null)
        .order('scheduled_at', { ascending: true });

      if (status && status !== 'all') {
        q = q.eq('status', status);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id:                 String(row.id),
        lead_id:            String(row.lead_id),
        people_id:          row.people_id ? String(row.people_id) : null,
        person_name:        (row.person as { name?: string } | null)?.name ?? null,
        agent_id:           row.agent_id ? String(row.agent_id) : null,
        tipo:               (row.tipo as FupTipo),
        etapa_id:           row.etapa_id ? String(row.etapa_id) : null,
        template_id:        row.template_id ? String(row.template_id) : null,
        mensagem:           row.mensagem ? String(row.mensagem) : null,
        agendamento_titulo: row.agendamento_titulo ? String(row.agendamento_titulo) : null,
        motivo:             row.motivo ? String(row.motivo) : null,
        scheduled_at:       String(row.scheduled_at),
        fired_at:           row.fired_at ? String(row.fired_at) : null,
        status:             (row.status as FupStatus),
        error_message:      row.error_message ? String(row.error_message) : null,
        retry_count:        Number(row.retry_count ?? 0),
        created_at:         String(row.created_at),
      }));
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── Create FUP via RPC agendar_fup() ─────────────────────────────────────────

export interface CreateFupParams {
  lead_id: string;
  tipo: FupTipo;
  scheduled_at: string; // ISO string
  etapa_id?: string | null;
  template_id?: string | null;
  mensagem?: string | null;
  agendamento_titulo?: string | null;
  motivo?: string | null;
  agent_id?: string | null;
}

export function useCreateFupProgramado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: CreateFupParams): Promise<string> => {
      // agendar_fup() not yet in generated types — use sbUntyped + rpc
      const { data, error } = await sbUntyped.rpc('agendar_fup', {
        p_lead_id:             params.lead_id,
        p_tipo:                params.tipo,
        p_scheduled_at:        params.scheduled_at,
        p_etapa_id:            params.etapa_id ?? null,
        p_template_id:         params.template_id ?? null,
        p_mensagem:            params.mensagem ?? null,
        p_agendamento_titulo:  params.agendamento_titulo ?? null,
        p_motivo:              params.motivo ?? null,
        p_agent_id:            params.agent_id ?? null,
      });
      if (error) throw error;
      return String(data); // returns uuid
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success('FUP programado criado com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar FUP: ${err.message}`);
    },
  });
}

export function useCancelFupProgramado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await sbUntyped
        .from('fup_programados')
        .update({
          status:       'cancelled',
          deleted_at:   new Date().toISOString(),
          cancelado_em: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success('FUP programado cancelado.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });
}
