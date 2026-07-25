/**
 * ALTIORA-25 UC15: Painel de pendências para Gestor/Admin.
 *
 * AC1: Lista referrals em 3 categorias: Sem Closer, Sem próxima ação, Parados.
 * AC2: Cada item tem ações rápidas: "Atribuir Closer", "Definir ação", "Ver ficha".
 * AC3: Polling 30s via useAltioraPendencias.
 * AC4: Contagem de pendências no header.
 */

import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, UserX, Clock, Activity, ExternalLink, Loader2, CheckCircle2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAltioraPendencias, type PendenciaReferral, DIAS_PARADO_DEFAULT } from '@/hooks/useAltioraPendencias';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AltioraPendenciasPanelProps {
  /** Callback para abrir modal de atribuição de Closer */
  onAtribuirCloser?: (leadId: string) => void;
  /** Callback para abrir modal de próxima ação */
  onDefinirAcao?: (leadId: string) => void;
  isManager?: boolean;
}

// ── Pendência Row ─────────────────────────────────────────────────────────────

interface PendenciaRowProps {
  referral: PendenciaReferral;
  tipo: 'semCloser' | 'semAcao' | 'parado';
  onAtribuirCloser?: (id: string) => void;
  onDefinirAcao?: (id: string) => void;
}

const PendenciaRow = ({ referral, tipo, onAtribuirCloser, onDefinirAcao }: PendenciaRowProps) => {
  const navigate = useNavigate();
  const clientName = referral.pessoa?.name || referral.pessoa?.nome || 'Cliente sem nome';
  const stageName  = referral.stage?.nome  || referral.stage?.name  || '—';
  const closerName = referral.closer?.name || '—';

  const tempoParado = formatDistanceToNow(new Date(referral.updated_at), {
    locale: ptBR,
    addSuffix: true,
  });

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-muted/20 rounded-[2px] transition-colors group">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[12px] font-medium text-foreground/90 truncate">{clientName}</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 rounded-[2px] flex-shrink-0 border-border/50">
            {stageName}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground/60">
          {tipo === 'semCloser' && 'Sem Closer atribuído'}
          {tipo === 'semAcao' && `Closer: ${closerName} · Sem próxima ação definida`}
          {tipo === 'parado' && `Parado ${tempoParado} · Closer: ${closerName}`}
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {tipo === 'semCloser' && onAtribuirCloser && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAtribuirCloser(referral.id)}
            className="h-6 px-2 text-[10px] rounded-[2px] gap-1"
          >
            Atribuir Closer
          </Button>
        )}
        {(tipo === 'semAcao' || tipo === 'parado') && onDefinirAcao && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDefinirAcao(referral.id)}
            className="h-6 px-2 text-[10px] rounded-[2px] gap-1"
          >
            Definir ação
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/crm/negocios/${referral.id}`)}
          className="h-6 px-2 rounded-[2px]"
          title="Ver ficha"
        >
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────

interface PendenciasSectionProps {
  title:    string;
  icon:     React.ReactNode;
  items:    PendenciaReferral[];
  tipo:     'semCloser' | 'semAcao' | 'parado';
  color:    string;
  onAtribuirCloser?: (id: string) => void;
  onDefinirAcao?: (id: string) => void;
}

const PendenciasSection = ({
  title, icon, items, tipo, color,
  onAtribuirCloser, onDefinirAcao,
}: PendenciasSectionProps) => {
  if (items.length === 0) return (
    <div className="space-y-1">
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-[2px] ${color}`}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1">{title}</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      </div>
      <p className="text-[11px] text-muted-foreground/40 px-3 py-1">Nenhuma pendência nesta categoria.</p>
    </div>
  );

  return (
    <div className="space-y-0.5">
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-[2px] ${color}`}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1">{title}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full border-current/30">
          {items.length}
        </Badge>
      </div>
      <div className="divide-y divide-border/20">
        {items.map(r => (
          <PendenciaRow
            key={r.id}
            referral={r}
            tipo={tipo}
            onAtribuirCloser={onAtribuirCloser}
            onDefinirAcao={onDefinirAcao}
          />
        ))}
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const AltioraPendenciasPanel = ({
  onAtribuirCloser,
  onDefinirAcao,
  isManager = false,
}: AltioraPendenciasPanelProps) => {
  const { data, isLoading, dataUpdatedAt } = useAltioraPendencias(isManager);

  if (!isManager) return null;

  return (
    <div className="border border-border rounded-[4px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
          <span className="text-[12px] font-semibold text-foreground">Pendências Altiora</span>
          {(data?.totalCount ?? 0) > 0 && (
            <Badge className="text-[10px] h-5 px-1.5 rounded-full bg-amber-500/10 text-amber-600 border-amber-500/30">
              {data?.totalCount} pendência{data!.totalCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40" />}
          {dataUpdatedAt > 0 && !isLoading && (
            <span className="text-[10px] text-muted-foreground/40">
              Atualizado {formatDistanceToNow(new Date(dataUpdatedAt), { locale: ptBR, addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="divide-y divide-border/30">
        <div className="p-3">
          <PendenciasSection
            title="Sem Closer"
            icon={<UserX className="w-3.5 h-3.5" />}
            items={data?.semCloser ?? []}
            tipo="semCloser"
            color="text-red-600"
            onAtribuirCloser={onAtribuirCloser}
          />
        </div>
        <div className="p-3">
          <PendenciasSection
            title="Sem próxima ação"
            icon={<Clock className="w-3.5 h-3.5" />}
            items={data?.semAcao ?? []}
            tipo="semAcao"
            color="text-amber-600"
            onDefinirAcao={onDefinirAcao}
          />
        </div>
        <div className="p-3">
          <PendenciasSection
            title={`Parados há mais de ${DIAS_PARADO_DEFAULT} dias`}
            icon={<Activity className="w-3.5 h-3.5" />}
            items={data?.parados ?? []}
            tipo="parado"
            color="text-muted-foreground"
            onDefinirAcao={onDefinirAcao}
          />
        </div>
      </div>
    </div>
  );
};

export default AltioraPendenciasPanel;
