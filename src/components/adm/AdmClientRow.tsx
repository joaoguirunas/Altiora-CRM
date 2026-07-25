/**
 * AdmClientRow — one row in the ADM clients table.
 * AC1 (REL-02): includes "Versão" column with drift badges.
 */
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HealthBadge } from './HealthBadge';
import { DriftBadge } from './DriftBadge';
import { type AdmClient } from '@/hooks/useAdmClients';
import { cn } from '@/lib/utils';
import {
  MoreVertical, RefreshCw, Edit2, Trash2, User, ExternalLink, ArrowUpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Exported so Adm.tsx header can reuse exact column sizes
export const ROW_COLS = 'grid-cols-[1fr_110px_96px_110px_152px_100px_90px_80px]';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active:    { label: 'Ativo',    className: 'bg-green-500/10  text-green-600  border-green-500/20' },
  inactive:  { label: 'Inativo',  className: 'bg-muted         text-muted-foreground border-border' },
  suspended: { label: 'Suspenso', className: 'bg-red-500/10    text-red-600    border-red-500/20'   },
};

const SYNC_STATUS_MAP: Record<string, { label: string; className: string }> = {
  synced:   { label: 'Sincronizado', className: 'bg-green-500/10  text-green-600  border-green-500/20' },
  syncing:  { label: 'Sincronizando',className: 'bg-blue-500/10   text-blue-600   border-blue-500/20'  },
  pending:  { label: 'Pendente',     className: 'bg-amber-500/10  text-amber-600  border-amber-500/20' },
  error:    { label: 'Erro',         className: 'bg-red-500/10    text-red-600    border-red-500/20'   },
  never:    { label: 'Nunca',        className: 'bg-muted         text-muted-foreground border-border' },
};

interface HealthResult {
  status: 'healthy' | 'degraded' | 'down';
  db_version?: string;
  system_version?: string;
}

interface AdmClientRowProps {
  client: AdmClient;
  health?: HealthResult;
  onEdit: (client: AdmClient) => void;
  onDelete: (client: AdmClient) => void;
  onSync: (client: AdmClient) => void;
  onHealthCheck: (client: AdmClient) => void;
  onCreateUser: (client: AdmClient) => void;
  onViewDetail: (client: AdmClient) => void;
  /** REL-02 AC1: opens UpdateClientModal */
  onUpdateVersion: (client: AdmClient) => void;
  /** REL-03 AC5: opens DriftModal (Gamma AC6) — optional until modal is wired */
  onOpenDriftModal?: (client: AdmClient) => void;
  isUpdating?: boolean;
}

export function AdmClientRow({
  client,
  health,
  onEdit,
  onDelete,
  onSync,
  onHealthCheck,
  onCreateUser,
  onViewDetail,
  onUpdateVersion,
  onOpenDriftModal,
  isUpdating,
}: AdmClientRowProps) {
  const statusInfo = STATUS_MAP[client.status] ?? STATUS_MAP.inactive;
  const syncInfo = SYNC_STATUS_MAP[client.sync_status] ?? SYNC_STATUS_MAP.never;

  // AC1: version drift badge
  const versionBadge = React.useMemo(() => {
    if (!client.current_version) {
      return (
        <Badge
          variant="outline"
          className="text-[10px] rounded-[4px] bg-muted text-muted-foreground border-border cursor-default"
        >
          Nunca sincronizado
        </Badge>
      );
    }
    if (client.current_version === client.target_version || !client.target_version) {
      return (
        <Badge
          variant="outline"
          className="text-[10px] rounded-[4px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 cursor-default"
        >
          Atualizado
        </Badge>
      );
    }
    // Drift: current !== target
    return (
      <button
        type="button"
        onClick={() => onUpdateVersion(client)}
        className="inline-flex items-center gap-1"
        title="Clique para atualizar"
      >
        <Badge
          variant="outline"
          className="text-[10px] rounded-[4px] bg-amber-500/10 text-amber-600 border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors"
        >
          <ArrowUpCircle className="w-2.5 h-2.5 mr-0.5" />
          desatualizado
        </Badge>
      </button>
    );
  }, [client, onUpdateVersion]);

  return (
    <div className={cn('grid items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-white/[0.025] group transition-colors', ROW_COLS)}>
      {/* Name / Slug */}
      <div
        className="cursor-pointer min-w-0"
        onClick={() => onViewDetail(client)}
      >
        <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
        <p className="text-[11px] text-muted-foreground font-mono truncate">{client.slug}</p>
        {/* AC5 (REL-03): schema drift badge — DriftModal wired by Gamma (AC6) */}
        <DriftBadge
          clientId={client.id}
          onClick={onOpenDriftModal ? () => onOpenDriftModal(client) : undefined}
        />
      </div>

      {/* AC1: Versão */}
      <div className="flex flex-col gap-0.5">
        {client.current_version && (
          <span className="text-[11px] font-mono text-foreground leading-none">
            v{client.current_version}
          </span>
        )}
        {versionBadge}
      </div>

      {/* Status */}
      <Badge variant="outline" className={cn('text-[10px] rounded-[4px] w-fit', statusInfo.className)}>
        {statusInfo.label}
      </Badge>

      {/* Sync status */}
      <Badge variant="outline" className={cn('text-[10px] rounded-[4px] w-fit', syncInfo.className)}>
        {syncInfo.label}
      </Badge>

      {/* Last synced */}
      <div className="text-[11px] text-muted-foreground">
        {client.last_synced_at
          ? format(new Date(client.last_synced_at), 'dd/MM/yy HH:mm', { locale: ptBR })
          : '—'}
      </div>

      {/* Health */}
      <div>
        {health
          ? <HealthBadge status={health.status} dbVersion={health.db_version} systemVersion={health.system_version} />
          : <HealthBadge status="unknown" />
        }
      </div>

      {/* Created */}
      <div className="text-[11px] text-muted-foreground">
        {format(new Date(client.created_at), 'dd/MM/yy', { locale: ptBR })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-[28px] w-[28px] p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
          onClick={() => onSync(client)}
          title="Sync agora"
          disabled={isUpdating}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-[28px] w-[28px] p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onViewDetail(client)}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(client)}>
              <Edit2 className="w-3.5 h-3.5 mr-2" />
              Editar cliente
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateUser(client)}>
              <User className="w-3.5 h-3.5 mr-2" />
              Criar usuário
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHealthCheck(client)}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Health check
            </DropdownMenuItem>
            {client.current_version !== client.target_version && client.target_version && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onUpdateVersion(client)}>
                  <ArrowUpCircle className="w-3.5 h-3.5 mr-2" />
                  Atualizar versão
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(client)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Remover cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
