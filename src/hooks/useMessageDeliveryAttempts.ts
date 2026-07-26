/**
 * useMessageDeliveryAttempts — FIX-SENDS-FIRST-MSG-01 AC13
 *
 * Lazy fetch: query is disabled until `enabled` is true (user expands the message).
 * message_delivery_attempts is not yet in generated types (pending migration apply).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types (manual — migration not yet regenerated) ───────────────────────────

export type DeliveryAttemptStatus = 'pending' | 'sent' | 'failed' | 'timeout';

export interface MessageDeliveryAttempt {
  id: number;
  message_id: number;
  attempt_no: number;
  channel: string;
  provider: string | null;
  started_at: string;
  finished_at: string | null;
  status: DeliveryAttemptStatus;
  request_body: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  http_status: number | null;
  wamid: string | null;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches delivery attempts for a single message.
 *
 * @param messageId — `messages.id` (bigint → number in TypeScript)
 * @param enabled   — pass `true` only when the user expands the delivery log UI
 */
export function useMessageDeliveryAttempts(messageId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['message-delivery-attempts', messageId ?? 0],
    queryFn: async (): Promise<MessageDeliveryAttempt[]> => {
      if (!messageId) return [];
      // @ts-expect-error — message_delivery_attempts not yet in generated types (pending migration apply FIX-SENDS-FIRST-MSG-01)
      const { data, error } = await supabase
        .from('message_delivery_attempts')
        .select('*')
        .eq('message_id', messageId)
        .order('attempt_no', { ascending: true });
      if (error) throw error;
      return (data as unknown as MessageDeliveryAttempt[]) ?? [];
    },
    enabled: !!messageId && enabled,
    // AC13: never pre-fetch on list load — staleTime 0 + refetch only on enable
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: false,
  });
}
