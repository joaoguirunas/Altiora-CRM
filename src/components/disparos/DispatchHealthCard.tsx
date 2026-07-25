/**
 * DispatchHealthCard — OBS-DISPATCH-HEALTH-01 AC4+AC5
 * 3-LED observability card: cron health + canal health + queue health.
 *
 * Modes:
 * - Global (no sendId): reads v_dispatch_health view only — 3 cron LEDs.
 * - Per-send (with sendId): reads get_send_health RPC + view for full picture.
 */
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  useDispatchHealthView,
  useSendHealth,
  deriveCronLed,
  deriveChannelLed,
  deriveQueueLed,
  type LedStatus,
} from '@/hooks/useDispatchHealth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── LED widget ───────────────────────────────────────────────────────────────

const LED_CONFIG: Record<LedStatus, { color: string; Icon: React.ElementType; ringColor: string }> = {
  ok:      { color: 'bg-emerald-500', Icon: CheckCircle2,   ringColor: 'ring-emerald-500/30' },
  warn:    { color: 'bg-amber-500',   Icon: AlertTriangle,  ringColor: 'ring-amber-500/30' },
  error:   { color: 'bg-red-500',     Icon: XCircle,        ringColor: 'ring-red-500/30' },
  unknown: { color: 'bg-muted-foreground/40', Icon: HelpCircle, ringColor: 'ring-border' },
};

interface LedProps {
  status: LedStatus;
  label: string;
  detail: string;
}

function Led({ status, label, detail }: LedProps) {
  const cfg = LED_CONFIG[status];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-default">
            <span className={cn('w-2 h-2 rounded-full shrink-0 ring-2', cfg.color, cfg.ringColor)} />
            <span className="text-xs text-foreground/80">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-xs">
          {detail}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Overall status summary ───────────────────────────────────────────────────

const STATUS_RANK: Record<LedStatus, number> = { error: 3, warn: 2, ok: 1, unknown: 0 };

function overallStatus(statuses: LedStatus[]): LedStatus {
  return statuses.reduce<LedStatus>((worst, s) =>
    STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst
  , 'ok');
}

// ─── Error breakdown ─────────────────────────────────────────────────────────

function ErrorBreakdown({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Erros por motivo
      </p>
      {entries.map(([reason, count]) => (
        <div key={reason} className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground truncate">{reason}</span>
          <Badge variant="outline" className="text-[10px] rounded-[4px] shrink-0 bg-red-500/10 text-red-600 border-red-500/20">
            {count}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DispatchHealthCardProps {
  /** When provided: calls get_send_health(sendId) for per-send detail */
  sendId?: string;
  /** Only show card for running/paused sends to avoid noise */
  sendStatus?: string;
}

export function DispatchHealthCard({ sendId, sendStatus }: DispatchHealthCardProps) {
  const [expanded, setExpanded] = React.useState(false);

  // Only poll when send is active
  const healthEnabled = !sendStatus || ['running', 'paused'].includes(sendStatus);

  const { data: viewRows = [], isFetching: viewFetching, refetch: refetchView } = useDispatchHealthView();
  const { data: sendHealth, isFetching: healthFetching, refetch: refetchSendHealth } = useSendHealth(sendId, healthEnabled);

  const cronLed   = deriveCronLed(viewRows, sendHealth ?? null);
  const chanLed   = deriveChannelLed(sendHealth ?? null);
  const queueLed  = deriveQueueLed(viewRows, sendHealth ?? null);

  const leds = [cronLed, chanLed, queueLed];
  const overall = overallStatus(leds.map(l => l.status));
  const overall_cfg = LED_CONFIG[overall];

  const isFetching = viewFetching || healthFetching;
  const errorCounts = sendHealth?.error_count_by_reason ?? {};

  const handleRefresh = () => {
    refetchView();
    if (sendId) refetchSendHealth();
  };

  // Global mode: only show cron LED (no per-send data)
  const isGlobal = !sendId;

  // Hide entirely if no view data and no send-level data
  if (!viewRows.length && !sendHealth) {
    // Insufficient permissions or data not loaded — render minimally
    return (
      <Card className="p-3 border border-border bg-card rounded-[2px]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/30 ring-2 ring-border shrink-0" />
          <p className="text-xs text-muted-foreground">
            {isFetching ? 'Carregando saúde do disparo...' : 'Saúde indisponível (permissão limitada)'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'border bg-card rounded-[2px] overflow-hidden transition-all',
      overall === 'error' && 'border-red-500/30',
      overall === 'warn'  && 'border-amber-500/30',
      overall === 'ok'    && 'border-border',
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.025]"
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
      >
        {/* Overall LED */}
        <span className={cn(
          'w-2.5 h-2.5 rounded-full shrink-0 ring-2',
          overall_cfg.color,
          overall_cfg.ringColor,
        )} />
        <p className="text-xs font-semibold text-foreground mr-auto">
          Saúde do disparo
        </p>

        {/* LED summary row */}
        <div className="flex items-center gap-4">
          <Led {...cronLed} />
          {!isGlobal && <Led {...chanLed} />}
          <Led {...queueLed} />
        </div>

        {/* Refresh + expand */}
        <Button
          variant="ghost"
          size="sm"
          className="h-[22px] w-[22px] p-0 text-muted-foreground"
          onClick={e => { e.stopPropagation(); handleRefresh(); }}
        >
          <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
        </Button>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 border-t border-border space-y-3">
          {/* Cron detail table */}
          {viewRows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                Status pg_cron
              </p>
              <div className="space-y-1">
                {viewRows.map(row => {
                  const rowStatus: LedStatus = !row.cron_active ? 'error'
                    : row.failures_30min > 0 ? 'warn'
                    : 'ok';
                  const cfg = LED_CONFIG[rowStatus];
                  return (
                    <div key={row.jobname} className="flex items-center gap-2 text-xs">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.color)} />
                      <span className="font-mono text-muted-foreground">{row.jobname}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground/70">{row.runs_5min} runs/5min</span>
                      {row.failures_30min > 0 && (
                        <Badge variant="outline" className="text-[9px] rounded-[2px] px-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                          {row.failures_30min} falha(s)
                        </Badge>
                      )}
                      {row.last_run_at && (
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {format(new Date(row.last_run_at), 'HH:mm:ss', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Queue metrics */}
              {viewRows.some(r => r.pending_5min > 0 || r.error_30min > 0 || r.expired_24h > 0 || r.running_stuck > 0) && (
                <div className="flex gap-4 pt-1">
                  {viewRows.reduce((acc, r) => acc + r.pending_5min, 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Pendentes &gt;5min: <span className="text-amber-500 font-medium">{viewRows.reduce((a, r) => a + r.pending_5min, 0)}</span>
                    </span>
                  )}
                  {viewRows.reduce((acc, r) => acc + r.expired_24h, 0) > 0 && (
                    <span className="text-xs text-red-500 font-medium">
                      Expiradas &gt;24h: {viewRows.reduce((a, r) => a + r.expired_24h, 0)}
                    </span>
                  )}
                  {viewRows.reduce((acc, r) => acc + r.running_stuck, 0) > 0 && (
                    <span className="text-xs text-red-500 font-medium">
                      Travados: {viewRows.reduce((a, r) => a + r.running_stuck, 0)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Per-send detail */}
          {sendHealth && !isGlobal && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Este disparo
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token canal</span>
                  <span className={sendHealth.channel_status.has_token ? 'text-emerald-500' : 'text-red-500'}>
                    {sendHealth.channel_status.has_token ? '✓ presente' : '✗ ausente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Canal ativo</span>
                  <span className={sendHealth.channel_status.active ? 'text-emerald-500' : 'text-red-500'}>
                    {sendHealth.channel_status.active ? '✓ sim' : '✗ não'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">meta_template_name</span>
                  <span className={sendHealth.template_status.meta_template_name_present ? 'text-emerald-500' : 'text-amber-500'}>
                    {sendHealth.template_status.meta_template_name_present ? '✓ presente' : '✗ ausente'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Template status</span>
                  <span className={sendHealth.template_status.meta_template_status?.toLowerCase() === 'approved' ? 'text-emerald-500' : 'text-amber-500'}>
                    {sendHealth.template_status.meta_template_status ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pendentes</span>
                  <span className="text-foreground">{sendHealth.pending_count}</span>
                </div>
              </div>

              <ErrorBreakdown counts={errorCounts} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
