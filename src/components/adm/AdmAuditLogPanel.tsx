/**
 * AdmAuditLogPanel — paginated audit log with action/entity_type filters.
 */
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAdmAuditLog, type AdmAuditLog } from '@/hooks/useAdmClients';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  'client.created':           'bg-green-500/10  text-green-600  border-green-500/20',
  'client.updated':           'bg-blue-500/10   text-blue-600   border-blue-500/20',
  'client.deleted':           'bg-red-500/10    text-red-600    border-red-500/20',
  'client.updated_to_release':'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'client.bulk_update':       'bg-amber-500/10  text-amber-600  border-amber-500/20',
};

const ENTITY_TYPES = ['', 'adm_clients', 'adm_sync_jobs', 'adm_releases'];

function AuditRow({ entry }: { entry: AdmAuditLog }) {
  const [expanded, setExpanded] = React.useState(false);
  const colorClass = ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground border-border';
  const details = entry.details as Record<string, unknown>;

  return (
    <div
      className="px-4 py-2.5 border-b border-border last:border-0 hover:bg-white/[0.025] transition-colors cursor-pointer"
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn('text-[10px] rounded-[4px] shrink-0 font-mono', colorClass)}>
          {entry.action}
        </Badge>
        <span className="text-xs text-foreground/80 truncate flex-1">
          {entry.entity_name ?? entry.entity_id ?? '—'}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {entry.actor_email}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {format(new Date(entry.created_at), 'dd/MM HH:mm', { locale: ptBR })}
        </span>
      </div>

      {expanded && Object.keys(details).length > 0 && (
        <pre className="mt-2 text-[10px] font-mono bg-black/30 rounded-[4px] p-2 overflow-x-auto text-muted-foreground whitespace-pre-wrap">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

interface AdmAuditLogPanelProps {
  /** Optional: pre-filter by entity_type (e.g. from AdmClientSingle) */
  entityType?: string;
}

export function AdmAuditLogPanel({ entityType }: AdmAuditLogPanelProps) {
  const [page, setPage] = React.useState(0);
  const [actionFilter, setActionFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState(entityType ?? '');
  const [search, setSearch] = React.useState('');

  const { data: entries, isLoading } = useAdmAuditLog({
    action: actionFilter || undefined,
    entity_type: typeFilter || undefined,
    page,
  });

  const filtered = React.useMemo(() => {
    if (!entries) return [];
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.entity_name?.toLowerCase().includes(q) ||
      e.actor_email?.toLowerCase().includes(q) ||
      e.action.includes(q)
    );
  }, [entries, search]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="pl-8 h-[32px] text-xs rounded-[4px]"
          />
        </div>

        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="h-[32px] text-xs rounded-[4px] w-[160px]">
            <SelectValue placeholder="Tipo de entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs">Todos os tipos</SelectItem>
            {ENTITY_TYPES.slice(1).map(t => (
              <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          placeholder="Filtrar por action..."
          className="h-[32px] text-xs rounded-[4px] w-[200px] font-mono"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 bg-muted/30 border-b border-border grid grid-cols-[2fr_2fr_1fr_100px] gap-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ação</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Entidade</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ator</span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data</span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
            Carregando logs...
          </div>
        ) : !filtered.length ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum registro encontrado.
          </div>
        ) : (
          filtered.map(entry => <AuditRow key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Página {page + 1} · {filtered.length} registros
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-[28px] w-[28px] p-0 rounded-[4px]"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-[28px] w-[28px] p-0 rounded-[4px]"
            onClick={() => setPage(p => p + 1)}
            disabled={(entries?.length ?? 0) < 30}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
