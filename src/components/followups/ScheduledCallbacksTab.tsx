/**
 * ScheduledCallbacksTab — FUP-AUTO-01
 *
 * Displays all AI-scheduled callbacks (retornos programados via agendar_retorno tool).
 * Allows managers to view and cancel pending callbacks.
 */

import { useState } from 'react';
import { Clock, X, AlertCircle, CheckCircle2, Loader2, Bot, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useScheduledCallbacks,
  useCancelScheduledCallback,
  type CallbackStatus,
  type ScheduledCallback,
} from '@/hooks/useScheduledCallbacks';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { cn } from '@/lib/utils';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CallbackStatus, {
  label: string;
  dotClass: string;
  badgeClass: string;
}> = {
  pending:    { label: 'Pendente',    dotClass: 'bg-blue-400',    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/50' },
  processing: { label: 'Executando', dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/50' },
  sent:       { label: 'Enviado',    dotClass: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/50' },
  failed:     { label: 'Falhou',     dotClass: 'bg-red-400',     badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-300/50' },
  cancelled:  { label: 'Cancelado',  dotClass: 'bg-zinc-400',    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-300/50' },
  skipped:    { label: 'Ignorado',   dotClass: 'bg-zinc-300',    badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-300/50' },
};

const TABS: Array<{ value: 'pending' | 'all'; label: string }> = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'all',     label: 'Histórico' },
];

// ── Row ───────────────────────────────────────────────────────────────────────

function CallbackRow({ cb }: { cb: ScheduledCallback }) {
  const cancel = useCancelScheduledCallback();
  const cfg = STATUS_CONFIG[cb.status];
  const scheduledDate = new Date(cb.scheduled_for);
  const isOverdue = cb.status === 'pending' && scheduledDate < new Date();

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
      isOverdue && 'bg-red-50/40 dark:bg-red-950/20',
    )}>
      {/* Status dot */}
      <div className="mt-1.5 shrink-0">
        <span className={cn('block w-2 h-2 rounded-full', cfg.dotClass)} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Person + scheduled time */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-foreground truncate">
            {cb.person_name ?? 'Contato desconhecido'}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
            <Clock className="w-3 h-3" />
            {scheduledDate.toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {isOverdue && (
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <AlertCircle className="w-3 h-3" /> Atrasado
            </span>
          )}
        </div>

        {/* Reason */}
        <p className="text-[12px] text-muted-foreground line-clamp-1">
          {cb.reason}
        </p>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', cfg.badgeClass)}>
            {cfg.label}
          </Badge>

          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            {cb.mode === 'agent' ? (
              <><Bot className="w-2.5 h-2.5 mr-0.5" />Agente</>
            ) : (
              <><MessageSquare className="w-2.5 h-2.5 mr-0.5" />Direto</>
            )}
          </Badge>

          {cb.whatsapp_template_name && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground font-mono">
              {cb.whatsapp_template_name}
            </Badge>
          )}

          {cb.channel !== 'whatsapp' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground capitalize">
              {cb.channel}
            </Badge>
          )}
        </div>

        {/* Error message if failed */}
        {cb.error_message && (
          <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 pt-0.5">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {cb.error_message}
          </p>
        )}
      </div>

      {/* Cancel button — only for pending */}
      {cb.status === 'pending' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          title="Cancelar retorno"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate({ id: cb.id })}
        >
          {cancel.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
        </Button>
      )}

      {/* Sent confirmation icon */}
      {cb.status === 'sent' && (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
      )}
    </div>
  );
}

// ── Pane ─────────────────────────────────────────────────────────────────────

function CallbackPane({ status }: { status: 'pending' | 'all' }) {
  const { data: callbacks = [], isLoading } = useScheduledCallbacks(status);

  if (isLoading) return <StandardPageLoader size="medium" message="Carregando retornos programados..." />;

  if (callbacks.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground/60">
        {status === 'pending'
          ? 'Nenhum retorno programado pendente.'
          : 'Nenhum retorno programado encontrado.'}
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-border overflow-hidden">
      {callbacks.map(cb => <CallbackRow key={cb.id} cb={cb} />)}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

const ScheduledCallbacksTab = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const { data: pending = [] } = useScheduledCallbacks('pending');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <p className="text-[13px] font-semibold text-foreground">Retornos Programados pelo Agente IA</p>
        <p className="text-[12px] text-muted-foreground/60 mt-0.5">
          Agendamentos criados automaticamente pela tool{' '}
          <code className="font-mono text-[11px]">agendar_retorno</code>. Um retorno pendente por lead.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'pending' | 'all')}>
        <TabsList className="h-[45px] w-full justify-start gap-0 bg-card dark:bg-zinc-950 border border-border rounded-[2px] p-0">
          {TABS.map(tab => {
            const count = tab.value === 'pending' ? pending.length : null;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px] px-4 gap-1.5"
              >
                {tab.label}
                {count !== null && count > 0 && (
                  <span className="text-[10px] font-medium px-1 leading-none rounded-[2px] bg-primary/10 text-primary">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            <CallbackPane status={tab.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ScheduledCallbacksTab;
