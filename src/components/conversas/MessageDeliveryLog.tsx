/**
 * MessageDeliveryLog — FIX-SENDS-FIRST-MSG-01 AC11-AC13
 *
 * AC11: Expandable delivery log per outgoing WhatsApp message.
 *       Shows attempt_no, status, wamid, http_status, error_message,
 *       accordion for raw request_body / response_body.
 *
 * AC12: Elegant fallback for old messages with no delivery_attempts rows.
 *
 * AC13: Lazy fetch — TanStack Query disabled until user clicks "Ver log".
 *       Does NOT fire on message list render.
 */
import * as React from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMessageDeliveryAttempts, type DeliveryAttemptStatus } from '@/hooks/useMessageDeliveryAttempts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Deploy date for AC12 fallback ───────────────────────────────────────────

/**
 * Cutoff: date when message_delivery_attempts migration was deployed.
 * Messages created before this date will never have rows — show friendly badge.
 */
const DELIVERY_LOG_CUTOFF = new Date('2026-07-25T00:00:00Z');

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DeliveryAttemptStatus, {
  label: string;
  className: string;
  Icon: React.ElementType;
}> = {
  sent:    { label: 'Enviado',   className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', Icon: CheckCircle2 },
  failed:  { label: 'Falhou',    className: 'bg-red-500/10     text-red-600     border-red-500/20',     Icon: XCircle },
  pending: { label: 'Pendente',  className: 'bg-blue-500/10    text-blue-500    border-blue-500/20',    Icon: Clock },
  timeout: { label: 'Timeout',   className: 'bg-amber-500/10   text-amber-600   border-amber-500/20',   Icon: AlertTriangle },
};

// ─── Raw payload accordion ────────────────────────────────────────────────────

function PayloadAccordion({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  const [open, setOpen] = React.useState(false);
  if (!data) return null;
  return (
    <div className="mt-1.5">
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] font-mono bg-black/30 rounded-[2px] p-2 overflow-x-auto text-muted-foreground/80 whitespace-pre-wrap max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Attempt row ─────────────────────────────────────────────────────────────

function AttemptRow({ attempt }: { attempt: ReturnType<typeof useMessageDeliveryAttempts>['data'] extends (infer T)[] ? T : never }) {
  const cfg = STATUS_CONFIG[attempt.status] ?? STATUS_CONFIG.pending;
  const IconEl = cfg.Icon;

  return (
    <div className="space-y-1.5 py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Attempt number */}
        <span className="text-[10px] text-muted-foreground font-mono">#{attempt.attempt_no}</span>

        {/* Status badge */}
        <Badge variant="outline" className={cn('text-[10px] rounded-[2px] px-1.5 py-0 flex items-center gap-1', cfg.className)}>
          <IconEl className="w-2.5 h-2.5" />
          {cfg.label}
        </Badge>

        {/* HTTP status */}
        {attempt.http_status != null && (
          <span className={cn(
            'text-[10px] font-mono',
            attempt.http_status >= 200 && attempt.http_status < 300 ? 'text-emerald-500' : 'text-red-500'
          )}>
            HTTP {attempt.http_status}
          </span>
        )}

        {/* Duration */}
        {attempt.duration_ms != null && (
          <span className="text-[10px] text-muted-foreground">{attempt.duration_ms}ms</span>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
          {format(new Date(attempt.started_at), 'HH:mm:ss', { locale: ptBR })}
        </span>
      </div>

      {/* wamid */}
      {attempt.wamid && (
        <p className="text-[10px] font-mono text-muted-foreground break-all">
          <span className="text-muted-foreground/60">wamid: </span>{attempt.wamid}
        </p>
      )}

      {/* Error */}
      {attempt.error_message && (
        <p className="text-[10px] text-red-500 break-words">
          {attempt.error_code && <span className="font-mono mr-1">[{attempt.error_code}]</span>}
          {attempt.error_message}
        </p>
      )}

      {/* Raw payloads */}
      <PayloadAccordion label="Request body" data={attempt.request_body} />
      <PayloadAccordion label="Response body" data={attempt.response_body} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MessageDeliveryLogProps {
  /** messages.id (bigint → number). undefined = don't fetch */
  messageId: number | undefined;
  /** messages.created_at — used for AC12 cutoff check */
  createdAt: string;
  /** Only render for outgoing WhatsApp messages */
  channel: string | null | undefined;
  isFromClient: boolean;
}

export function MessageDeliveryLog({ messageId, createdAt, channel, isFromClient }: MessageDeliveryLogProps) {
  const [expanded, setExpanded] = React.useState(false);

  const { data: attempts, isLoading, isError } = useMessageDeliveryAttempts(
    messageId,
    expanded // AC13: lazy fetch — enabled only when user opens
  );

  // Only for outgoing WhatsApp messages
  const isWhatsApp = channel === 'whatsapp';
  if (!isWhatsApp || isFromClient) return null;

  // AC12: message predates delivery logging — elegant fallback
  const messageDate = new Date(createdAt);
  const isPredeploy = messageDate < DELIVERY_LOG_CUTOFF;

  return (
    <div className="mt-1.5 -mx-0.5">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-0.5"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        Log de delivery
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-1 rounded-[2px] bg-black/20 border border-border/30 px-2.5 py-2 min-w-[220px]">
          {/* AC12: predeploy fallback */}
          {isPredeploy ? (
            <p className="text-[10px] text-muted-foreground/70 italic">
              Log de delivery indisponível para mensagens anteriores a{' '}
              {format(DELIVERY_LOG_CUTOFF, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          ) : isLoading ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Buscando log...
            </div>
          ) : isError ? (
            <p className="text-[10px] text-red-500">Erro ao carregar log de delivery.</p>
          ) : !attempts?.length ? (
            // AC12: post-deploy but no rows yet (AC10 not yet deployed or message still pending)
            <p className="text-[10px] text-muted-foreground/70 italic">
              Nenhuma tentativa de delivery registrada ainda.
            </p>
          ) : (
            // AC11: actual attempt rows
            <div>
              {attempts.map(attempt => (
                <AttemptRow key={attempt.id} attempt={attempt} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
