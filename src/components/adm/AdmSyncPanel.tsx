/**
 * AdmSyncPanel — tab "Sync Jobs" with job list + realtime log tail.
 */
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdmSyncJobs, useAdmSyncLogs } from '@/hooks/useAdmClients';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

const STATUS_CFG: Record<string, { label: string; className: string }> = {
  pending:  { label: 'Pendente',    className: 'bg-muted text-muted-foreground border-border' },
  running:  { label: 'Rodando',     className: 'bg-blue-500/10   text-blue-600   border-blue-500/20' },
  success:  { label: 'Sucesso',     className: 'bg-green-500/10  text-green-600  border-green-500/20' },
  failed:   { label: 'Falhou',      className: 'bg-red-500/10    text-red-600    border-red-500/20' },
};

interface AdmSyncPanelProps {
  clientId?: string;
  initialJobId?: string;
}

export function AdmSyncPanel({ clientId, initialJobId }: AdmSyncPanelProps) {
  const { data: jobs } = useAdmSyncJobs(clientId);
  const [selectedJobId, setSelectedJobId] = React.useState<string | undefined>(initialJobId);
  const { data: logs } = useAdmSyncLogs(selectedJobId);

  const selectedJob = jobs?.find(j => j.id === selectedJobId) ?? jobs?.[0];

  React.useEffect(() => {
    if (!selectedJobId && jobs?.length) {
      setSelectedJobId(initialJobId ?? jobs[0].id);
    }
  }, [jobs, selectedJobId, initialJobId]);

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-80">
      {/* Job list */}
      <div className="border border-border rounded-[2px] overflow-y-auto">
        {!jobs?.length ? (
          <p className="p-4 text-xs text-muted-foreground">Nenhum job registrado.</p>
        ) : (
          jobs.map(job => {
            const cfg = STATUS_CFG[job.status] ?? STATUS_CFG.pending;
            const isActive = selectedJob?.id === job.id;
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b border-border last:border-0 text-xs transition-colors',
                  isActive ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]'
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <Badge variant="outline" className={cn('text-[9px] rounded-[2px] px-1 py-0', cfg.className)}>
                    {cfg.label}
                  </Badge>
                  {job.status === 'running' && (
                    <RefreshCw className="w-2.5 h-2.5 text-blue-500 animate-spin" />
                  )}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">{job.id.slice(0, 8)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(job.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                </p>
                {job.client_name && <p className="text-[10px] text-foreground/70 truncate">{job.client_name}</p>}
              </button>
            );
          })
        )}
      </div>

      {/* Log tail */}
      <div className="border border-border rounded-[2px] bg-black/40 p-3 overflow-y-auto font-mono text-[11px] space-y-1">
        {!selectedJob ? (
          <p className="text-muted-foreground">Selecione um job para ver os logs.</p>
        ) : !logs?.length ? (
          <p className="text-muted-foreground animate-pulse">Aguardando logs...</p>
        ) : (
          logs.map(log => (
            <div
              key={log.id}
              className={cn(
                'flex gap-2',
                log.level === 'error' && 'text-red-400',
                log.level === 'warn'  && 'text-amber-400',
              )}
            >
              <span className="text-muted-foreground shrink-0">
                {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
