/**
 * useDispatchHealth — OBS-DISPATCH-HEALTH-01 AC4
 * Consumes v_dispatch_health view and get_send_health() RPC.
 *
 * NOTE: v_dispatch_health is not yet in generated types (migration pending apply).
 * Types are defined manually based on the migration spec.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types (manual — migration not yet regenerated) ───────────────────────────

export interface DispatchHealthRow {
  jobname: string;
  schedule: string;
  cron_active: boolean;
  runs_5min: number;
  failures_30min: number;
  last_run_at: string | null;
  pending_5min: number;
  error_30min: number;
  expired_24h: number;
  running_stuck: number;
}

export interface SendHealthResult {
  pg_cron_alive: boolean;
  last_dispatch_at: string | null;
  channel_status: {
    has_token: boolean;
    is_default: boolean;
    active: boolean;
  };
  template_status: {
    meta_template_name_present: boolean;
    meta_template_status: string | null;
  };
  pending_count: number;
  error_count_by_reason: Record<string, number>;
}

// ─── Global cron health (v_dispatch_health) ───────────────────────────────────

/**
 * useDispatchHealthView — reads global cron/queue health.
 * Polls every 30s while the component is mounted.
 * Returns empty array (not error) when user has no access (RLS).
 */
export function useDispatchHealthView() {
  return useQuery({
    queryKey: ['v-dispatch-health'],
    queryFn: async (): Promise<DispatchHealthRow[]> => {
      // @ts-expect-error — v_dispatch_health not yet in generated types (pending migration apply OBS-DISPATCH-HEALTH-01)
      const { data, error } = await supabase.from('v_dispatch_health').select('*');
      if (error) {
        // If 42501 (no permission) — return empty array (low-privilege user)
        if (error.code === '42501' || error.code === 'PGRST301') return [];
        throw error;
      }
      return (data as unknown as DispatchHealthRow[]) ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
}

// ─── Per-send health (get_send_health RPC) ────────────────────────────────────

/**
 * useSendHealth — calls get_send_health(send_id) RPC.
 * Only active when sendId is provided and send is in running/paused state.
 */
export function useSendHealth(sendId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['send-health', sendId ?? 'none'],
    queryFn: async (): Promise<SendHealthResult | null> => {
      if (!sendId) return null;
      // @ts-expect-error — get_send_health not yet in generated types (pending migration apply OBS-DISPATCH-HEALTH-01)
      const { data, error } = await supabase.rpc('get_send_health', { send_id: sendId });
      if (error) {
        if (error.code === '42501' || error.code === 'PGRST301') return null;
        throw error;
      }
      return (data as unknown as SendHealthResult) ?? null;
    },
    enabled: !!sendId && enabled,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  });
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

export type LedStatus = 'ok' | 'warn' | 'error' | 'unknown';

export interface CronLed {
  status: LedStatus;
  label: string;
  detail: string;
}

export interface ChannelLed {
  status: LedStatus;
  label: string;
  detail: string;
}

export interface QueueLed {
  status: LedStatus;
  label: string;
  detail: string;
}

/** Derive cron LED from view rows + send health */
export function deriveCronLed(
  rows: DispatchHealthRow[],
  health: SendHealthResult | null
): CronLed {
  const dispatchRow = rows.find(r => r.jobname === 'sends-dispatch-batch');

  if (!dispatchRow && !health) {
    return { status: 'unknown', label: 'Cron', detail: 'Sem dados (permissão limitada)' };
  }

  const alive = health?.pg_cron_alive ?? (dispatchRow?.cron_active && (dispatchRow?.runs_5min ?? 0) > 0);

  if (!alive) {
    const failures = dispatchRow?.failures_30min ?? 0;
    return {
      status: 'error',
      label: 'Cron parado',
      detail: failures > 0 ? `${failures} falha(s) em 30 min` : 'Sem execuções nos últimos 5 min',
    };
  }

  const failures = dispatchRow?.failures_30min ?? 0;
  if (failures > 0) {
    return {
      status: 'warn',
      label: 'Cron com falhas',
      detail: `${failures} falha(s) em 30 min — rodando com erros`,
    };
  }

  const lastRun = health?.last_dispatch_at ?? dispatchRow?.last_run_at;
  return {
    status: 'ok',
    label: 'Cron ativo',
    detail: lastRun ? `Última execução: ${new Date(lastRun).toLocaleTimeString('pt-BR')}` : 'Ativo',
  };
}

/** Derive channel LED from send health */
export function deriveChannelLed(health: SendHealthResult | null): ChannelLed {
  if (!health) return { status: 'unknown', label: 'Canal', detail: 'Sem dados por disparo' };

  const { has_token, active } = health.channel_status;

  if (!has_token) {
    return { status: 'error', label: 'Canal sem token', detail: 'access_token ausente no canal WhatsApp' };
  }
  if (!active) {
    return { status: 'error', label: 'Canal inativo', detail: 'Canal desativado nas configurações' };
  }

  const { meta_template_name_present, meta_template_status } = health.template_status;
  if (!meta_template_name_present) {
    return { status: 'warn', label: 'Template sem meta_name', detail: 'Template não publicado na Meta' };
  }
  if (meta_template_status?.toLowerCase() !== 'approved') {
    return { status: 'warn', label: 'Template não aprovado', detail: `Status: ${meta_template_status ?? 'desconhecido'}` };
  }

  return { status: 'ok', label: 'Canal OK', detail: 'Token válido + template aprovado' };
}

/** Derive queue LED from view + send health */
export function deriveQueueLed(
  rows: DispatchHealthRow[],
  health: SendHealthResult | null
): QueueLed {
  const dispatchRow = rows.find(r => r.jobname === 'sends-dispatch-batch');

  const pending = health?.pending_count ?? dispatchRow?.pending_5min ?? 0;
  const errors30 = dispatchRow?.error_30min ?? 0;
  const expired = dispatchRow?.expired_24h ?? 0;
  const stuck = dispatchRow?.running_stuck ?? 0;

  const totalErrors = Object.values(health?.error_count_by_reason ?? {}).reduce((s, v) => s + v, 0);

  if (stuck > 0) {
    return { status: 'error', label: 'Disparo travado', detail: `${stuck} disparo(s) em 'running' sem progresso >1h` };
  }
  if (expired > 0) {
    return { status: 'error', label: 'Msgs expiradas', detail: `${expired} mensagem(s) pending >24h` };
  }
  if (errors30 > 5 || totalErrors > 5) {
    const total = Math.max(errors30, totalErrors);
    return { status: 'warn', label: 'Erros na fila', detail: `${total} erro(s) em 30 min` };
  }
  if (pending > 20) {
    return { status: 'warn', label: 'Fila crescendo', detail: `${pending} msgs pendentes >5 min` };
  }

  return { status: 'ok', label: 'Fila limpa', detail: pending > 0 ? `${pending} pendente(s) — normal` : 'Sem pendências' };
}
