/**
 * AdmClientSingle — Detail page for one ADM client.
 * REL-02 AC5: "Histórico de releases" section using ClientVersionsHistory.
 */
import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ArrowUpCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useAdmClients,
  useSyncClientNow,
  useCheckHealth,
} from '@/hooks/useAdmClients';
import { HealthBadge } from '@/components/adm/HealthBadge';
import { AdmSyncPanel } from '@/components/adm/AdmSyncPanel';
import { AdmAuditLogPanel } from '@/components/adm/AdmAuditLogPanel';
import { ClientVersionsHistory } from '@/components/adm/ClientVersionsHistory';
import { UpdateClientModal } from '@/components/adm/UpdateClientModal';

export default function AdmClientSingle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: clients } = useAdmClients();
  const { mutate: syncNow, isPending: isSyncing } = useSyncClientNow();
  const { mutate: checkHealth } = useCheckHealth();

  const [health, setHealth] = React.useState<{
    status: 'healthy' | 'degraded' | 'down';
    db_version?: string;
    system_version?: string;
  } | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [viewJobId, setViewJobId] = React.useState<string | undefined>(undefined);

  const client = clients?.find(c => c.id === id) ?? null;

  if (!client && clients !== undefined) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-muted-foreground text-sm">Cliente não encontrado.</p>
        <Button
          variant="link"
          size="sm"
          className="mt-2 text-xs"
          onClick={() => navigate('/adm')}
        >
          Voltar ao ADM
        </Button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="px-6 py-20 text-center text-sm text-muted-foreground animate-pulse">
        Carregando...
      </div>
    );
  }

  const hasDrift = client.target_version && client.current_version !== client.target_version;

  const handleHealthCheck = () => {
    checkHealth(client.id, {
      onSuccess: (result) => {
        setHealth(result);
        toast.success(`Health: ${result.status}`);
      },
      onError: () => toast.error('Health check falhou'),
    });
  };

  const handleSync = () => {
    syncNow(client.id, {
      onSuccess: () => toast.success('Sync iniciado'),
    });
  };

  const handleViewJob = (jobId: string) => {
    setViewJobId(jobId);
    setActiveTab('sync-jobs');
  };

  // Format date helper
  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—';

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-[28px] w-[28px] p-0 shrink-0 mt-0.5"
            onClick={() => navigate('/adm')}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-foreground">{client.name}</h1>
              <span className="text-sm font-mono text-muted-foreground">{client.slug}</span>
              {health && <HealthBadge status={health.status} dbVersion={health.db_version} systemVersion={health.system_version} />}
            </div>

            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {/* Version */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Versão:</span>
                <span className="font-mono font-semibold text-foreground">
                  {client.current_version ? `v${client.current_version}` : '—'}
                </span>
                {hasDrift && (
                  <Badge
                    variant="outline"
                    className="text-[10px] rounded-[4px] bg-amber-500/10 text-amber-600 border-amber-500/20 cursor-pointer"
                    onClick={() => setUpdateModalOpen(true)}
                  >
                    <ArrowUpCircle className="w-2.5 h-2.5 mr-0.5" />
                    → v{client.target_version}
                  </Badge>
                )}
              </div>

              <span className="text-[11px] text-muted-foreground">
                URL: <span className="font-mono">{client.supabase_url}</span>
              </span>

              {client.contact_email && (
                <span className="text-[11px] text-muted-foreground">
                  Contato: {client.contact_email}
                </span>
              )}

              <span className="text-[11px] text-muted-foreground">
                Sync: {fmtDate(client.last_synced_at)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-[30px] rounded-[4px] text-xs gap-1.5"
              onClick={handleHealthCheck}
            >
              <ExternalLink className="w-3 h-3" />
              Health
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px] rounded-[4px] text-xs gap-1.5"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
              Sync
            </Button>
            {hasDrift && (
              <Button
                size="sm"
                className="h-[30px] rounded-[4px] text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0"
                onClick={() => setUpdateModalOpen(true)}
              >
                <ArrowUpCircle className="w-3 h-3" />
                Atualizar
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-6 pt-3">
          <TabsList className="h-8 rounded-[4px] bg-muted/50">
            <TabsTrigger value="overview" className="text-xs rounded-[4px] px-3">Visão geral</TabsTrigger>
            <TabsTrigger value="sync-jobs" className="text-xs rounded-[4px] px-3">Sync Jobs</TabsTrigger>
            <TabsTrigger value="releases" className="text-xs rounded-[4px] px-3">Histórico releases</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs rounded-[4px] px-3">Audit Log</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="overflow-auto px-6 pb-6 mt-4">
          <div className="grid grid-cols-2 gap-6 max-w-2xl">
            {[
              ['Status', client.status],
              ['Sync status', client.sync_status],
              ['Versão atual', client.current_version ?? '—'],
              ['Versão alvo', client.target_version ?? '—'],
              ['Criado em', fmtDate(client.created_at)],
              ['Última sync', fmtDate(client.last_synced_at)],
              ['Último health check', fmtDate(client.last_health_check_at)],
              ['Status health', client.last_health_status ?? '—'],
              ['Contato', client.contact_name ?? '—'],
              ['E-mail contato', client.contact_email ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{value}</p>
              </div>
            ))}
            {client.notes && (
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Observações</p>
                <p className="text-xs text-foreground mt-0.5 whitespace-pre-line">{client.notes}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Sync Jobs ── */}
        <TabsContent value="sync-jobs" className="overflow-auto px-6 pb-6 mt-4">
          <AdmSyncPanel clientId={client.id} initialJobId={viewJobId} />
        </TabsContent>

        {/* ── Histórico releases (AC5) ── */}
        <TabsContent value="releases" className="overflow-auto px-6 pb-6 mt-4">
          <div className="max-w-2xl">
            <h2 className="text-sm font-semibold text-foreground mb-3">Histórico de releases</h2>
            <ClientVersionsHistory clientId={client.id} onViewJob={handleViewJob} />
          </div>
        </TabsContent>

        {/* ── Audit Log ── */}
        <TabsContent value="audit" className="overflow-auto px-6 pb-6 mt-4">
          <AdmAuditLogPanel entityType="adm_clients" />
        </TabsContent>
      </Tabs>

      {/* UpdateClientModal */}
      <UpdateClientModal
        client={client}
        open={updateModalOpen}
        onOpenChange={setUpdateModalOpen}
      />
    </div>
  );
}
