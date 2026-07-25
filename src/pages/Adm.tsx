/**
 * Adm.tsx — ADM control plane main page.
 * REL-02: AC4 (Bulk button), AC7 (new-release notification).
 * REL-03: AC9 (StatsBar "Com drift" card).
 * Tabs: Clientes / Sync Jobs / Audit Log.
 */
import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Zap, ServerCog, AlertTriangle, Users, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAdmClients,
  useDeleteAdmClient,
  useSyncClientNow,
  useCheckHealth,
  type AdmClient,
} from '@/hooks/useAdmClients';
import { useLatestAdmRelease } from '@/hooks/useAdmReleases';
import { AdmClientRow, ROW_COLS } from '@/components/adm/AdmClientRow';
import { AdmClientModal } from '@/components/adm/AdmClientModal';
import { UpdateClientModal } from '@/components/adm/UpdateClientModal';
import { BulkUpdateModal } from '@/components/adm/BulkUpdateModal';
import { AdmSyncPanel } from '@/components/adm/AdmSyncPanel';
import { AdmAuditLogPanel } from '@/components/adm/AdmAuditLogPanel';
import { useAllClientsDrift } from '@/hooks/useClientDrift';

// ─── AC7: New-release notification ────────────────────────────────────────────

const LAST_SEEN_KEY = 'adm_last_seen_release';

function useNewReleaseNotification() {
  const { data: latest } = useLatestAdmRelease();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!latest) return;
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (lastSeen === latest.version) return;
    // Show once per release
    toast.info(`Nova release disponível: v${latest.version}. Clique para ver clientes desatualizados.`, {
      action: {
        label: 'Ver ADM',
        onClick: () => navigate('/adm'),
      },
      duration: 10_000,
    });
    localStorage.setItem(LAST_SEEN_KEY, latest.version);
  }, [latest, navigate]);
}

// ─── StatsBar — REL-03 AC9 ────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: boolean;
}

function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-[4px] border border-border bg-card',
      accent && 'border-red-500/30 bg-red-500/5',
    )}>
      <span className={cn('flex-shrink-0', accent ? 'text-red-500' : 'text-muted-foreground')}>
        {icon}
      </span>
      <div>
        <p className="text-[18px] font-semibold leading-none text-foreground tabular-nums">
          {value}
        </p>
        <p className={cn(
          'text-[10px] font-medium uppercase tracking-wide mt-0.5',
          accent ? 'text-red-500/80' : 'text-muted-foreground',
        )}>
          {label}
        </p>
      </div>
    </div>
  );
}

interface AdmStatsBarProps {
  totalClients: number;
  outdatedCount: number;
}

function AdmStatsBar({ totalClients, outdatedCount }: AdmStatsBarProps) {
  const { data: driftSummary } = useAllClientsDrift();
  const driftCount = driftSummary?.count ?? 0;

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/20 flex-wrap">
      <StatCard
        label="Clientes"
        value={totalClients}
        icon={<Users className="w-4 h-4" />}
      />
      <StatCard
        label="Desatualizados"
        value={outdatedCount}
        icon={<GitMerge className="w-4 h-4" />}
        accent={outdatedCount > 0}
      />
      <StatCard
        label="Com drift"
        value={driftCount}
        icon={<AlertTriangle className="w-4 h-4" />}
        accent={driftCount > 0}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface AdmHeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  outdatedClients: AdmClient[];
  latestVersion: string | null;
  onBulkUpdate: () => void;
  onNewClient: () => void;
}

function AdmHeader({
  search, onSearchChange, outdatedClients, latestVersion, onBulkUpdate, onNewClient,
}: AdmHeaderProps) {
  return (
    <div className="flex items-center gap-3 pb-4 flex-wrap">
      <div className="flex items-center gap-2 mr-auto">
        <ServerCog className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-base font-semibold text-foreground">ADM Control Plane</h1>
        {outdatedClients.length > 0 && (
          <Badge variant="outline" className="rounded-[4px] text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
            {outdatedClients.length} desatualizados
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar cliente..."
          className="pl-8 h-[32px] text-xs rounded-[4px] w-[200px]"
        />
      </div>

      {/* AC4: Bulk update button */}
      <Button
        size="sm"
        variant="outline"
        className={cn(
          'h-[32px] rounded-[4px] text-xs gap-1.5',
          outdatedClients.length > 0 && 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10'
        )}
        disabled={outdatedClients.length === 0}
        onClick={onBulkUpdate}
      >
        <Zap className="w-3.5 h-3.5" />
        Atualizar todos
        {outdatedClients.length > 0 && (
          <Badge variant="outline" className="ml-1 text-[9px] rounded-full px-1.5 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">
            {outdatedClients.length}
          </Badge>
        )}
      </Button>

      <Button
        size="sm"
        className="h-[32px] rounded-[4px] text-xs gap-1.5"
        onClick={onNewClient}
      >
        <Plus className="w-3.5 h-3.5" />
        Novo cliente
      </Button>
    </div>
  );
}

// ─── Table header ─────────────────────────────────────────────────────────────

function TableHeader() {
  return (
    <div className={cn('grid gap-3 px-4 py-2 bg-muted/30 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider', ROW_COLS)}>
      <span>Cliente</span>
      <span>Versão</span>
      <span>Status</span>
      <span>Sync</span>
      <span>Última sync</span>
      <span>Health</span>
      <span>Criado</span>
      <span />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Adm() {
  const navigate = useNavigate();
  const { data: clients, isLoading, refetch } = useAdmClients();
  const { mutate: deleteClient } = useDeleteAdmClient();
  const { mutate: syncNow, isPending: isSyncing } = useSyncClientNow();
  const { mutate: checkHealth } = useCheckHealth();

  const [search, setSearch] = React.useState('');
  const [modalClient, setModalClient] = React.useState<AdmClient | null>(null);
  const [clientModalOpen, setClientModalOpen] = React.useState(false);
  const [updateModalClient, setUpdateModalClient] = React.useState<AdmClient | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [bulkModalOpen, setBulkModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AdmClient | null>(null);

  // Health results keyed by client id
  const [healthMap, setHealthMap] = React.useState<Record<string, { status: 'healthy' | 'degraded' | 'down'; db_version?: string; system_version?: string }>>({});

  // AC7
  useNewReleaseNotification();

  const allClients = clients ?? [];
  const latestVersion = allClients.reduce<string | null>((acc, c) => {
    if (!c.target_version) return acc;
    if (!acc) return c.target_version;
    return c.target_version > acc ? c.target_version : acc;
  }, null);

  const outdatedClients = allClients.filter(
    c => c.target_version && c.current_version !== c.target_version
  );

  const filtered = search.trim()
    ? allClients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.includes(search.toLowerCase())
      )
    : allClients;

  // Handlers
  const handleEdit = (c: AdmClient) => {
    setModalClient(c);
    setClientModalOpen(true);
  };
  const handleNewClient = () => {
    setModalClient(null);
    setClientModalOpen(true);
  };
  const handleDelete = (c: AdmClient) => setDeleteTarget(c);
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteClient(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };
  const handleSync = (c: AdmClient) => {
    syncNow(c.id, {
      onSuccess: () => toast.success(`Sync de ${c.name} iniciado`),
    });
  };
  const handleHealthCheck = (c: AdmClient) => {
    checkHealth(c.id, {
      onSuccess: (result) => {
        setHealthMap(prev => ({ ...prev, [c.id]: result }));
        toast.success(`Health de ${c.name}: ${result.status}`);
      },
      onError: () => toast.error(`Health check de ${c.name} falhou`),
    });
  };
  const handleUpdateVersion = (c: AdmClient) => {
    setUpdateModalClient(c);
    setUpdateModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-0 min-h-0">
      {/* Page padding container */}
      <div className="px-6 pt-6">
        <AdmHeader
          search={search}
          onSearchChange={setSearch}
          outdatedClients={outdatedClients}
          latestVersion={latestVersion}
          onBulkUpdate={() => setBulkModalOpen(true)}
          onNewClient={handleNewClient}
        />
      </div>

      <Separator />

      {/* REL-03 AC9 — Stats cards */}
      <AdmStatsBar
        totalClients={allClients.length}
        outdatedCount={outdatedClients.length}
      />

      <Tabs defaultValue="clientes" className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-3">
          <TabsList className="h-8 rounded-[4px] bg-muted/50">
            <TabsTrigger value="clientes" className="text-xs rounded-[4px] px-3">
              Clientes {allClients.length > 0 && `(${allClients.length})`}
            </TabsTrigger>
            <TabsTrigger value="sync-jobs" className="text-xs rounded-[4px] px-3">
              Sync Jobs
            </TabsTrigger>
            <TabsTrigger value="audit-log" className="text-xs rounded-[4px] px-3">
              Audit Log
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Clientes tab ── */}
        <TabsContent value="clientes" className="flex-1 overflow-auto mt-0 px-6 pb-6">
          {isLoading ? (
            <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">
              Carregando clientes...
            </div>
          ) : !filtered.length ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              {search ? `Nenhum cliente encontrado para "${search}"` : 'Nenhum cliente cadastrado.'}
            </div>
          ) : (
            <div className="border border-border rounded-[2px] overflow-hidden">
              <TableHeader />
              {filtered.map(c => (
                <AdmClientRow
                  key={c.id}
                  client={c}
                  health={healthMap[c.id]}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSync={handleSync}
                  onHealthCheck={handleHealthCheck}
                  onCreateUser={() => toast.info('Criar usuário — em breve')}
                  onViewDetail={() => navigate(`/adm/clients/${c.id}`)}
                  onUpdateVersion={handleUpdateVersion}
                  isUpdating={isSyncing}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Sync Jobs tab ── */}
        <TabsContent value="sync-jobs" className="flex-1 overflow-auto mt-0 px-6 pb-6">
          <AdmSyncPanel />
        </TabsContent>

        {/* ── Audit Log tab ── */}
        <TabsContent value="audit-log" className="flex-1 overflow-auto mt-0 px-6 pb-6">
          <AdmAuditLogPanel />
        </TabsContent>
      </Tabs>

      {/* ── Modals ── */}
      <AdmClientModal
        open={clientModalOpen}
        onOpenChange={setClientModalOpen}
        client={modalClient}
      />

      <UpdateClientModal
        client={updateModalClient}
        open={updateModalOpen}
        onOpenChange={setUpdateModalOpen}
      />

      <BulkUpdateModal
        clients={outdatedClients}
        targetVersion={latestVersion}
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>{deleteTarget?.name}</strong> do ADM control plane.
              Os dados do cliente no Supabase não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
