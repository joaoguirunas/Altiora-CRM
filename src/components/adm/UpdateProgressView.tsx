/**
 * UpdateProgressView — Realtime progress for a sync job (REL-02 AC3)
 * Subscribes to adm_sync_logs:job_id=eq.{jobId} via Supabase Realtime.
 * AC8: role="status" + aria-live="polite" for accessibility.
 */
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmSyncLogs } from '@/hooks/useAdmClients';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type JobStatus = 'pending' | 'running' | 'success' | 'failed';

const STATUS_CONFIG: Record<JobStatus, { label: string; className: string; Icon: React.ElementType }> = {
  pending: { label: 'Aguardando', className: 'bg-muted text-muted-foreground border-border',             Icon: Clock },
  running: { label: 'Em andamento', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',       Icon: Loader2 },
  success: { label: 'Concluído',    className: 'bg-green-500/10 text-green-600 border-green-500/20',    Icon: CheckCircle2 },
  failed:  { label: 'Falhou',       className: 'bg-red-500/10 text-red-600 border-red-500/20',          Icon: XCircle },
};

interface UpdateProgressViewProps {
  jobId: string;
  onClose: () => void;
  onViewLogs?: () => void;
  initialStatus?: JobStatus;
}

export function UpdateProgressView({ jobId, onClose, onViewLogs, initialStatus = 'pending' }: UpdateProgressViewProps) {
  const [jobStatus, setJobStatus] = React.useState<JobStatus>(initialStatus);
  const { data: logs } = useAdmSyncLogs(jobId);

  // Subscribe to adm_sync_jobs changes via Realtime
  React.useEffect(() => {
    const channel = supabase
      .channel(`adm-sync-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'adm_sync_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status as JobStatus;
          setJobStatus(newStatus);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  const cfg = STATUS_CONFIG[jobStatus] ?? STATUS_CONFIG.pending;
  const isRunning = jobStatus === 'pending' || jobStatus === 'running';
  const isSuccess = jobStatus === 'success';
  const isFailed = jobStatus === 'failed';

  const logEntries = logs ?? [];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Progresso da atualização"
      className="space-y-4"
    >
      {/* Status pill */}
      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className={cn('rounded-[4px] text-xs font-medium flex items-center gap-1.5 px-3 py-1', cfg.className)}
        >
          <cfg.Icon className={cn('w-3.5 h-3.5', isRunning && 'animate-spin')} />
          {cfg.label}
        </Badge>
        {!isRunning && (
          <span className="text-xs text-muted-foreground font-mono">Job: {jobId.slice(0, 8)}</span>
        )}
      </div>

      {/* Log stream */}
      <div className="rounded-[4px] border border-border bg-black/40 p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-1">
        {logEntries.length === 0 && isRunning && (
          <p className="text-muted-foreground animate-pulse">Aguardando logs...</p>
        )}
        {logEntries.map((log) => (
          <div
            key={log.id}
            className={cn(
              'flex gap-2',
              log.level === 'error' && 'text-red-400',
              log.level === 'warn'  && 'text-amber-400',
              log.level === 'info'  && 'text-foreground/80',
            )}
          >
            <span className="text-muted-foreground shrink-0">
              {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
            </span>
            <span className="break-all">{log.message}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {isFailed && onViewLogs && (
          <Button
            variant="outline"
            size="sm"
            className="h-[30px] rounded-[4px] text-xs"
            onClick={onViewLogs}
          >
            Ver detalhes
          </Button>
        )}
        {(isSuccess || isFailed) && (
          <Button
            size="sm"
            className="h-[30px] rounded-[4px] text-xs"
            onClick={onClose}
          >
            {isSuccess ? 'Fechar' : 'Fechar'}
          </Button>
        )}
        {isRunning && (
          <p className="text-xs text-muted-foreground self-center">
            Aguardando conclusão...
          </p>
        )}
      </div>
    </div>
  );
}
