/**
 * ClientVersionsHistory — REL-02 AC5
 * Shows adm_client_versions ordered by applied_at DESC (limit 20).
 */
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useAdmClientVersions } from '@/hooks/useAdmClients';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const VERSION_STATUS: Record<string, { label: string; className: string }> = {
  success: { label: 'Sucesso',   className: 'bg-green-500/10  text-green-600  border-green-500/20' },
  failed:  { label: 'Falhou',    className: 'bg-red-500/10    text-red-600    border-red-500/20'   },
  partial: { label: 'Parcial',   className: 'bg-amber-500/10  text-amber-600  border-amber-500/20' },
};

interface ClientVersionsHistoryProps {
  clientId: string;
  onViewJob?: (jobId: string) => void;
}

export function ClientVersionsHistory({ clientId, onViewJob }: ClientVersionsHistoryProps) {
  const { data: versions, isLoading } = useAdmClientVersions(clientId);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
        Carregando histórico...
      </div>
    );
  }

  if (!versions?.length) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        Nenhuma atualização registrada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {versions.map(v => {
        const statusInfo = VERSION_STATUS[v.status] ?? VERSION_STATUS.failed;
        return (
          <Card key={v.id} className="p-3 border border-border bg-card rounded-[2px]">
            <div className="flex items-center justify-between gap-3">
              {/* Version arrow */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-muted-foreground">{v.from_version ?? '—'}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="font-semibold text-foreground">v{v.to_version}</span>
              </div>

              {/* Status + date */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn('text-[10px] rounded-[4px]', statusInfo.className)}>
                  {statusInfo.label}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(v.applied_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </span>
                {v.sync_job_id && onViewJob && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-[22px] px-1.5 text-[10px] text-muted-foreground"
                    onClick={() => onViewJob(v.sync_job_id!)}
                  >
                    <ExternalLink className="w-2.5 h-2.5 mr-1" />
                    Ver job
                  </Button>
                )}
              </div>
            </div>

            {/* Error summary if failed */}
            {v.error_summary && (
              <p className="mt-2 text-[11px] text-red-500 font-mono break-all">
                {v.error_summary}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
