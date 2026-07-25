/**
 * ALTIORA-21: Hook para linha do tempo paginada do referral.
 *
 * useAltioraTimeline — busca eventos de `altiora_lead_interactions` em ordem
 *                      cronológica reversa com suporte a "Ver mais" (offset).
 *
 * Todos os tipos de evento relevantes (mudança de etapa, contato, reunião,
 * atribuição de Closer, encerramento, reabertura, campos críticos) são
 * registrados em `altiora_lead_interactions` pelos outros hooks Altiora.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Constants ─────────────────────────────────────────────────────────────────

export const TIMELINE_PAGE_SIZE = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineActor {
  id: string;
  name: string;
}

export interface TimelineEvent {
  id: string;
  lead_id: string;
  type: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
  actor: TimelineActor | null;
}

export interface UseAltioraTimelineResult {
  events: TimelineEvent[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Carrega os eventos da linha do tempo de um referral com paginação.
 *
 * @param leadId  UUID do lead
 * @param limit   Quantos eventos carregar (incrementa ao clicar "Ver mais")
 */
export const useAltioraTimeline = (
  leadId: string,
  limit: number = TIMELINE_PAGE_SIZE,
): UseAltioraTimelineResult => {
  const { data, isLoading, isError } = useQuery<TimelineEvent[]>({
    queryKey: ['altiora-timeline', leadId, limit],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('altiora_lead_interactions')
        .select(`
          id,
          lead_id,
          type,
          description,
          payload,
          actor_id,
          created_at,
          actor:settings_users!actor_id ( id, name )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        // Fetch one extra to detect if there are more pages
        .range(0, limit);

      if (error) throw error;
      return (rows ?? []) as TimelineEvent[];
    },
    enabled: !!leadId,
    staleTime: 30_000,
  });

  const events = data ?? [];

  // If we got exactly `limit + 1` rows, there are more — but we requested
  // range(0, limit) which returns limit+1 items. Slice to limit for display.
  const hasMore = events.length > limit;
  const displayEvents = hasMore ? events.slice(0, limit) : events;

  return { events: displayEvents, isLoading, isError, hasMore };
};
