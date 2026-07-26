import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CalendarDays, Copy, Check, Clock, CalendarX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CalendarSyncCard } from '@/components/profile/CalendarSyncCard';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useMyBookingRuleSet } from '@/hooks/useMyBookingRuleSet';
import { useMyUpcomingMeetings } from '@/hooks/useMyUpcomingMeetings';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmed: 'Confirmado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  done: 'Realizado',
  pendente: 'Pendente',
};

function statusLabel(status: string | null): string {
  if (!status) return 'Agendado';
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

function statusVariant(
  status: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'outline';
  const s = status.toLowerCase();
  if (s === 'realizado' || s === 'done') return 'default';
  if (s === 'confirmado' || s === 'confirmed') return 'secondary';
  return 'outline';
}

// ── Section A: Booking Link ────────────────────────────────────────────────────

function BookingLinkCard() {
  const { ruleSet, isLoading } = useMyBookingRuleSet();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (ruleSet?.url_id == null) return;
    void navigator.clipboard.writeText(String(ruleSet.url_id)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="p-6 rounded-[2px]">
      <div className="flex items-start gap-3 mb-4">
        <CalendarDays className="w-5 h-5 text-[#FF4400] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <h3 className="text-[14px] font-semibold">Meu Link de Agendamento</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compartilhe seu codigo com o lead para que ele acesse sua agenda.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : ruleSet?.url_id != null ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Seu codigo de agendamento</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-[4px] bg-muted font-mono text-sm text-foreground border border-border">
                {ruleSet.url_id}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="rounded-[4px] h-9 px-3 shrink-0"
                aria-label="Copiar codigo"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-[4px] bg-muted/50 border border-border/60">
            <p className="text-xs text-muted-foreground leading-relaxed">
              O lead acessa o link de agendamento publico e adiciona{' '}
              <code className="text-foreground font-mono">?r={ruleSet.url_id}</code> ao URL para
              ser direcionado diretamente para a sua agenda. Exemplo:
            </p>
            <code className="mt-1.5 block text-xs text-muted-foreground font-mono break-all">
              {window.location.origin}/agendar/&#123;id-do-lead&#125;?r={ruleSet.url_id}
            </code>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-[4px] border border-dashed border-border text-center">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sua agenda esta sendo configurada pelo administrador.
          </p>
        </div>
      )}
    </Card>
  );
}

// ── Section C: Upcoming Meetings ───────────────────────────────────────────────

function UpcomingMeetingsCard() {
  const { meetings, isLoading } = useMyUpcomingMeetings();

  return (
    <Card className="p-6 rounded-[2px]">
      <div className="flex items-start gap-3 mb-4">
        <CalendarDays className="w-5 h-5 text-[#FF4400] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <h3 className="text-[14px] font-semibold">Proximas Reunioes</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seus proximos agendamentos confirmados.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-[4px] border border-dashed border-border text-center">
          <CalendarX className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma reuniao agendada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-center justify-between gap-3 p-3 rounded-[4px] border border-border bg-muted/30"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {formatDate(meeting.startIso)}
                  {' '}
                  <span className="text-muted-foreground font-normal">
                    {formatTime(meeting.startIso)}
                  </span>
                </p>
                {meeting.meeting_type && (
                  <p className="text-xs text-muted-foreground truncate">{meeting.meeting_type}</p>
                )}
              </div>
              <Badge variant={statusVariant(meeting.status)} className="shrink-0 text-xs">
                {statusLabel(meeting.status)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MinhaAgendaCloser() {
  const { isComercial, isValid } = useUserPermissions();

  // Wait until auth is resolved before redirecting
  if (isValid && !isComercial) {
    return <Navigate to="/schedule" replace />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Minha Agenda</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie seu link de agendamento e suas proximas reunioes.
        </p>
      </div>

      {/* Top row: booking link + calendar sync */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BookingLinkCard />
        <CalendarSyncCard />
      </div>

      {/* Full-width: upcoming meetings */}
      <UpcomingMeetingsCard />
    </div>
  );
}
