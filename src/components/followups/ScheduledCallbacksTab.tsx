/**
 * ScheduledCallbacksTab — FUP-AUTO-01 UI-1
 *
 * "Programado" tab in the Followups page.
 * Shows two types of scheduled FUPs:
 *  1. `fup_programados` — multi-type FUPs scheduled via `agendar_fup` tool (FUP-AUTO-01)
 *  2. `ai_scheduled_callbacks` — ad-hoc retornos scheduled via `agendar_retorno` tool
 */

import { useState } from 'react';
import {
  Clock, X, AlertCircle, CheckCircle2, Loader2,
  Bot, MessageSquare, ArrowRightLeft, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useFupProgramados,
  useCancelFupProgramado,
  type FupStatus,
  type FupTipo,
  type FupProgramado,
} from '@/hooks/useFupProgramados';
import {
  useScheduledCallbacks,
  useCancelScheduledCallback,
  type CallbackStatus,
  type ScheduledCallback,
} from '@/hooks/useScheduledCallbacks';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { cn } from '@/lib/utils';

// ── Status config ─────────────────────────────────────────────────────────────

const FUP_STATUS_CONFIG: Record<FupStatus, { label: string; dotClass: string; badgeClass: string }> = {
  pending:    { label: 'Pendente',    dotClass: 'bg-blue-400',    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50' },
  processing: { label: 'Executando', dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50' },
  done:       { label: 'Concluído',  dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50' },
  failed:     { label: 'Falhou',     dotClass: 'bg-red-400',     badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-300/50' },
  cancelled:  { label: 'Cancelado',  dotClass: 'bg-zinc-400',    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-300/50' },
};

const CB_STATUS_CONFIG: Record<CallbackStatus, { label: string; dotClass: string; badgeClass: string }> = {
  pending:    { label: 'Pendente',    dotClass: 'bg-blue-400',    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50' },
  processing: { label: 'Executando', dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50' },
  sent:       { label: 'Enviado',    dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50' },
  failed:     { label: 'Falhou',     dotClass: 'bg-red-400',     badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-300/50' },
  cancelled:  { label: 'Cancelado',  dotClass: 'bg-zinc-400',    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-300/50' },
  skipped:    { label: 'Ignorado',   dotClass: 'bg-zinc-300',    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-300/50' },
};

const TIPO_LABELS: Record<FupTipo, string> = {
  etapa_crm:   'Mover Etapa',
  agendamento: 'Reunião',
  programado:  'WhatsApp',
};

const TIPO_ICONS: Record<FupTipo, typeof ArrowRightLeft> = {
  etapa_crm:   ArrowRightLeft,
  agendamento: CalendarClock,
  programado:  MessageSquare,
};

// ── FUP Programado Row ─────────────────────────────────────────────────────────

function FupRow({ fup }: { fup: FupProgramado }) {
  const cancel = useCancelFupProgramado();
  const cfg     = FUP_STATUS_CONFIG[fup.status];
  const Icon    = TIPO_ICONS[fup.tipo];
  const when    = new Date(fup.scheduled_at);
  const isOverdue = fup.status === 'pending' && when < new Date();

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
      isOverdue && 'bg-red-50/40 dark:bg-red-950/20',
    )}>
      <span className={cn('block w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.dotClass)} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-foreground truncate">
            {fup.person_name ?? 'Contato desconhecido'}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
            <Clock className="w-3 h-3" />
            {when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOverdue && (
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <AlertCircle className="w-3 h-3" /> Atrasado
            </span>
          )}
        </div>

        {fup.motivo && (
          <p className="text-[12px] text-muted-foreground line-clamp-1">{fup.motivo}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', cfg.badgeClass)}>
            {cfg.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground flex items-center gap-0.5">
            <Icon className="w-2.5 h-2.5" />
            {TIPO_LABELS[fup.tipo]}
          </Badge>
          {fup.template_id && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground font-mono">
              {fup.template_id}
            </Badge>
          )}
        </div>

        {fup.error_message && (
          <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 pt-0.5">
            <AlertCircle className="w-3 h-3 shrink-0" />{fup.error_message}
          </p>
        )}
      </div>

      {fup.status === 'pending' && (
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          title="Cancelar FUP programado"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ id: fup.id })}
        >
          {cancel.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </Button>
      )}
      {fup.status === 'done' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />}
    </div>
  );
}

// ── Callback Row ──────────────────────────────────────────────────────────────

function CallbackRow({ cb }: { cb: ScheduledCallback }) {
  const cancel = useCancelScheduledCallback();
  const cfg    = CB_STATUS_CONFIG[cb.status];
  const when   = new Date(cb.scheduled_for);
  const isOverdue = cb.status === 'pending' && when < new Date();

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
      isOverdue && 'bg-red-50/40 dark:bg-red-950/20',
    )}>
      <span className={cn('block w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.dotClass)} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-foreground truncate">
            {cb.person_name ?? 'Contato desconhecido'}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
            <Clock className="w-3 h-3" />
            {when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOverdue && (
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <AlertCircle className="w-3 h-3" /> Atrasado
            </span>
          )}
        </div>

        <p className="text-[12px] text-muted-foreground line-clamp-1">{cb.reason}</p>

        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', cfg.badgeClass)}>{cfg.label}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            {cb.mode === 'agent'
              ? <><Bot className="w-2.5 h-2.5 mr-0.5 inline" />Agente</>
              : <><MessageSquare className="w-2.5 h-2.5 mr-0.5 inline" />Direto</>
            }
          </Badge>
          {cb.whatsapp_template_name && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground font-mono">
              {cb.whatsapp_template_name}
            </Badge>
          )}
        </div>

        {cb.error_message && (
          <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 pt-0.5">
            <AlertCircle className="w-3 h-3 shrink-0" />{cb.error_message}
          </p>
        )}
      </div>

      {cb.status === 'pending' && (
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          title="Cancelar retorno" disabled={cancel.isPending}
          onClick={() => cancel.mutate({ id: cb.id })}
        >
          {cancel.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
        </Button>
      )}
      {cb.status === 'sent' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />}
    </div>
  );
}

// ── Sub-tab: FUP Programados ─────────────────────────────────────────────────

type FupSubTab = 'pending' | 'all';

function FupProgramadosPane({ status }: { status: FupSubTab }) {
  const { data = [], isLoading } = useFupProgramados(status);
  if (isLoading) return <StandardPageLoader size="medium" message="Carregando FUPs programados..." />;
  if (data.length === 0) return (
    <p className="text-center py-8 text-[13px] text-muted-foreground/60">
      {status === 'pending' ? 'Nenhum FUP programado pendente.' : 'Nenhum FUP programado encontrado.'}
    </p>
  );
  return <div className="rounded-[4px] border border-border overflow-hidden">{data.map(f => <FupRow key={f.id} fup={f} />)}</div>;
}

// ── Sub-tab: Retornos ad-hoc ─────────────────────────────────────────────────

function CallbacksPane({ status }: { status: 'pending' | 'all' }) {
  const { data = [], isLoading } = useScheduledCallbacks(status);
  if (isLoading) return <StandardPageLoader size="medium" message="Carregando retornos agendados..." />;
  if (data.length === 0) return (
    <p className="text-center py-8 text-[13px] text-muted-foreground/60">
      {status === 'pending' ? 'Nenhum retorno agendado pendente.' : 'Nenhum retorno agendado encontrado.'}
    </p>
  );
  return <div className="rounded-[4px] border border-border overflow-hidden">{data.map(c => <CallbackRow key={c.id} cb={c} />)}</div>;
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

const ScheduledCallbacksTab = () => {
  const [subTab, setSubTab]     = useState<'fup' | 'retorno'>('fup');
  const [fupFilter, setFupFilter]   = useState<FupSubTab>('pending');
  const [cbFilter, setCbFilter]     = useState<'pending' | 'all'>('pending');

  const { data: pendingFups = [] }      = useFupProgramados('pending');
  const { data: pendingCallbacks = [] } = useScheduledCallbacks('pending');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-[13px] font-semibold text-foreground">FUPs Programados</p>
        <p className="text-[12px] text-muted-foreground/60 mt-0.5">
          Ações agendadas automaticamente pelo agente IA — executadas pelo worker a cada 5 min.
        </p>
      </div>

      {/* Main sub-tabs: FUP Programado vs Retorno ad-hoc */}
      <Tabs value={subTab} onValueChange={v => setSubTab(v as 'fup' | 'retorno')}>
        <TabsList className="h-[45px] w-full justify-start gap-0 bg-card dark:bg-zinc-950 border border-border rounded-[2px] p-0">
          <TabsTrigger value="fup"
            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px] px-4 gap-1.5"
          >
            FUP Programado
            {pendingFups.length > 0 && (
              <span className="text-[10px] font-medium px-1 leading-none rounded-[2px] bg-primary/10 text-primary">
                {pendingFups.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="retorno"
            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px] px-4 gap-1.5"
          >
            Retorno ad-hoc
            {pendingCallbacks.length > 0 && (
              <span className="text-[10px] font-medium px-1 leading-none rounded-[2px] bg-primary/10 text-primary">
                {pendingCallbacks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* FUP Programado pane */}
        <TabsContent value="fup" className="mt-3 space-y-3">
          <div className="flex gap-1.5">
            {(['pending', 'all'] as const).map(s => (
              <button key={s}
                onClick={() => setFupFilter(s)}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-[3px] transition-colors',
                  fupFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'pending' ? 'Pendentes' : 'Histórico'}
              </button>
            ))}
          </div>
          <FupProgramadosPane status={fupFilter} />
        </TabsContent>

        {/* Retorno ad-hoc pane */}
        <TabsContent value="retorno" className="mt-3 space-y-3">
          <div className="flex gap-1.5">
            {(['pending', 'all'] as const).map(s => (
              <button key={s}
                onClick={() => setCbFilter(s)}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-[3px] transition-colors',
                  cbFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {s === 'pending' ? 'Pendentes' : 'Histórico'}
              </button>
            ))}
          </div>
          <CallbacksPane status={cbFilter} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScheduledCallbacksTab;
