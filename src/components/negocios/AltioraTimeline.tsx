/**
 * ALTIORA-21: Linha do tempo do referral.
 *
 * Renderiza eventos de `altiora_lead_interactions` em ordem cronológica reversa
 * com ícone, label, ator, descrição e data relativa.
 * "Ver mais" carrega 50 eventos adicionais sem scroll infinito (AC5).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  GitBranch, Phone, Target, UserCheck, Trophy, XCircle,
  Calendar, CheckCircle, UserX, RotateCcw, Edit2, Circle,
  MessageSquare, AlertCircle, ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAltioraTimeline, TIMELINE_PAGE_SIZE, type TimelineEvent } from '@/hooks/useAltioraTimeline';

// ── Event type config ─────────────────────────────────────────────────────────

interface EventConfig {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  colorClass: string;
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  stage_changed:        { icon: GitBranch,     label: 'Mudança de etapa',       colorClass: 'text-blue-400' },
  first_contact:        { icon: Phone,          label: 'Primeiro contato',        colorClass: 'text-emerald-400' },
  next_action_set:      { icon: Target,         label: 'Próxima ação definida',   colorClass: 'text-amber-400' },
  closer_assigned:      { icon: UserCheck,      label: 'Closer atribuído',        colorClass: 'text-violet-400' },
  closer_reassigned:    { icon: UserCheck,      label: 'Closer reatribuído',      colorClass: 'text-violet-400' },
  won:                  { icon: Trophy,         label: 'Referral Ganho',          colorClass: 'text-[#00D26A]' },
  closed_won:           { icon: Trophy,         label: 'Referral Ganho',          colorClass: 'text-[#00D26A]' },
  lost:                 { icon: XCircle,        label: 'Referral Perdido',        colorClass: 'text-red-400' },
  closed_lost:          { icon: XCircle,        label: 'Referral Perdido',        colorClass: 'text-red-400' },
  meeting_scheduled:    { icon: Calendar,       label: 'Reunião agendada',        colorClass: 'text-sky-400' },
  meeting_done:         { icon: CheckCircle,    label: 'Reunião realizada',       colorClass: 'text-emerald-400' },
  meeting_noshow:       { icon: UserX,          label: 'No-show',                 colorClass: 'text-orange-400' },
  reopened:             { icon: RotateCcw,      label: 'Referral reaberto',       colorClass: 'text-indigo-400' },
  field_changed:        { icon: Edit2,          label: 'Campo alterado',          colorClass: 'text-slate-400' },
  contact_registered:   { icon: MessageSquare,  label: 'Contato registrado',      colorClass: 'text-teal-400' },
  note_added:           { icon: MessageSquare,  label: 'Observação adicionada',   colorClass: 'text-slate-400' },
  alert:                { icon: AlertCircle,    label: 'Alerta',                  colorClass: 'text-red-400' },
};

const DEFAULT_EVENT: EventConfig = {
  icon: Circle,
  label: 'Evento',
  colorClass: 'text-muted-foreground/40',
};

function getEventConfig(type: string): EventConfig {
  return EVENT_CONFIG[type] ?? DEFAULT_EVENT;
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(parseISO(dateString), {
      addSuffix: true,
      locale: ptBR,
    });
  } catch {
    return '—';
  }
}

// ── Event item ────────────────────────────────────────────────────────────────

interface EventItemProps {
  event: TimelineEvent;
  isLast: boolean;
}

const EventItem = ({ event, isLast }: EventItemProps) => {
  const config = getEventConfig(event.type);
  const Icon = config.icon;

  return (
    <div className="flex gap-3">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-none',
          'bg-card border border-border',
        )}>
          <Icon className={cn('w-3.5 h-3.5', config.colorClass)} strokeWidth={1.5} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border/50 mt-1 mb-1 min-h-[16px]" />
        )}
      </div>

      {/* Content */}
      <div className={cn('pb-4 min-w-0 flex-1', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-foreground/80 leading-tight">
            {config.label}
          </span>
          <span className="text-[11px] text-muted-foreground/40 whitespace-nowrap flex-none">
            {relativeTime(event.created_at)}
          </span>
        </div>

        {event.description && (
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed mt-0.5">
            {event.description}
          </p>
        )}

        {event.actor?.name && (
          <p className="text-[11px] text-muted-foreground/40 mt-1">
            por {event.actor.name}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface AltioraTimelineProps {
  leadId: string;
}

export const AltioraTimeline = ({ leadId }: AltioraTimelineProps) => {
  const [limit, setLimit] = useState(TIMELINE_PAGE_SIZE);

  const { events, isLoading, isError, hasMore } = useAltioraTimeline(leadId, limit);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-muted flex-none" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-2.5 w-48 bg-muted/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-[12px] text-red-400/70 py-4 text-center">
        Erro ao carregar histórico.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground/40 italic py-4 text-center">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-0">
        {events.map((event, idx) => (
          <EventItem
            key={event.id}
            event={event}
            isLast={idx === events.length - 1 && !hasMore}
          />
        ))}
      </div>

      {/* Ver mais (AC5) */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-[12px] text-muted-foreground/60 hover:text-foreground/80 h-8 rounded-[4px]"
          onClick={() => setLimit((prev) => prev + TIMELINE_PAGE_SIZE)}
        >
          <ChevronDown className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
          Ver mais
        </Button>
      )}
    </div>
  );
};
