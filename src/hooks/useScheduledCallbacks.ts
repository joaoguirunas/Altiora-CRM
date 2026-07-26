/**
 * useScheduledCallbacks — FUP-AUTO-01
 *
 * Queries ai_scheduled_callbacks joined with clients_people to power the
 * "Programado" tab in the Followups page.
 *
 * ai_scheduled_callbacks is not in generated types → uses sbUntyped pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbUntyped = supabase as unknown as SupabaseClient<any>;

export type CallbackStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'skipped';

export interface ScheduledCallback {
  id: string;
  lead_id: string;
  people_id: string;
  person_name: string | null;
  agent_id: string | null;
  scheduled_for: string;
  mode: 'direct' | 'agent';
  reason: string;
  channel: string;
  status: CallbackStatus;
  message_text: string | null;
  whatsapp_template_name: string | null;
  fired_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  error_message: string | null;
  created_at: string;
}

const QK = 'scheduled-callbacks';

export function useScheduledCallbacks(status?: CallbackStatus | 'all') {
  return useQuery({
    queryKey: [QK, status ?? 'all'],
    queryFn: async (): Promise<ScheduledCallback[]> => {
      let q = sbUntyped
        .from('ai_scheduled_callbacks')
        .select(`
          id, lead_id, people_id, agent_id,
          scheduled_for, mode, reason, channel, status,
          message_text, whatsapp_template_name,
          fired_at, cancelled_at, cancel_reason, error_message,
          created_at,
          person:clients_people!people_id (name)
        `)
        .order('scheduled_for', { ascending: true });

      if (status && status !== 'all') {
        q = q.eq('status', status);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        lead_id: String(row.lead_id),
        people_id: String(row.people_id),
        person_name: (row.person as { name?: string } | null)?.name ?? null,
        agent_id: row.agent_id ? String(row.agent_id) : null,
        scheduled_for: String(row.scheduled_for),
        mode: (row.mode as 'direct' | 'agent'),
        reason: String(row.reason ?? ''),
        channel: String(row.channel ?? 'whatsapp'),
        status: (row.status as CallbackStatus),
        message_text: row.message_text ? String(row.message_text) : null,
        whatsapp_template_name: row.whatsapp_template_name ? String(row.whatsapp_template_name) : null,
        fired_at: row.fired_at ? String(row.fired_at) : null,
        cancelled_at: row.cancelled_at ? String(row.cancelled_at) : null,
        cancel_reason: row.cancel_reason ? String(row.cancel_reason) : null,
        error_message: row.error_message ? String(row.error_message) : null,
        created_at: String(row.created_at),
      }));
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // refetch every minute — callbacks fire over time
  });
}

export function useCancelScheduledCallback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await sbUntyped
        .from('ai_scheduled_callbacks')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason ?? 'Cancelado manualmente pelo usuário',
        })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success('Retorno programado cancelado.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });
}
