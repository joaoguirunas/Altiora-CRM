/**
 * DriftModal — REL-03 AC6
 *
 * Modal showing drift records for a specific client.
 * Opens when user clicks the DriftBadge (AC5) on an AdmClientRow.
 *
 * Features:
 * - List of 'detected' drift records from useClientDrift
 * - Per record: detected_at, expected_release, diff_summary, hash comparison
 * - "Repair" button → useRepairDrift mutation
 * - "Ignorar" button → UPDATE status to 'acknowledged_persistent'
 * - Loading skeleton while fetching
 */

import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, WrenchIcon, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useClientDrift, type ClientDrift } from '@/hooks/useClientDrift';
import { useRepairDrift } from '@/hooks/useRepairDrift';
import { useQueryClient } from '@tanstack/react-query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbUntyped = supabase as unknown as SupabaseClient<any>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface DriftModalProps {
  clientId: string;
  clientName?: string;
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateHash(hash: string, len = 12): string {
  return hash.length > len ? `${hash.slice(0, len)}…` : hash;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─── Single drift row ─────────────────────────────────────────────────────────

interface DriftRowProps {
  record: ClientDrift;
  clientId: string;
  onIgnore: (id: string) => void;
  isIgnoring: boolean;
}

function DriftRow({ record, clientId, onIgnore, isIgnoring }: DriftRowProps) {
  const { mutate: repair, isPending: isRepairing } = useRepairDrift();

  const handleRepair = () => {
    repair({ driftId: record.id, clientId });
  };

  return (
    <div className="border border-border rounded-[4px] p-3 space-y-2.5 bg-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[12px] font-semibold text-foreground">
              Drift detectado
            </span>
            <span className="text-[11px] text-muted-foreground ml-2">
              {formatDate(record.detected_at)}
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-[9px] rounded-[3px] bg-amber-500/10 text-amber-600 border-amber-500/20 flex-shrink-0"
        >
          {record.expected_release}
        </Badge>
      </div>

      {/* Hash comparison */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="space-y-0.5">
          <p className="text-muted-foreground uppercase tracking-wide text-[9px] font-semibold">
            Hash esperado
          </p>
          <code className="font-mono text-emerald-600 bg-emerald-500/5 px-1.5 py-0.5 rounded text-[10px]">
            {truncateHash(record.expected_hash)}
          </code>
        </div>
        <div className="space-y-0.5">
          <p className="text-muted-foreground uppercase tracking-wide text-[9px] font-semibold">
            Hash atual
          </p>
          <code className="font-mono text-red-500 bg-red-500/5 px-1.5 py-0.5 rounded text-[10px]">
            {truncateHash(record.actual_hash)}
          </code>
        </div>
      </div>

      {/* diff_summary */}
      {record.diff_summary && (
        <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5 leading-snug">
          {record.diff_summary}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-[11px] px-2.5 gap-1.5 rounded-[4px]"
          onClick={handleRepair}
          disabled={isRepairing || isIgnoring}
          aria-label={`Reparar drift de ${formatDate(record.detected_at)}`}
        >
          {isRepairing
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <WrenchIcon className="w-3 h-3" />
          }
          {isRepairing ? 'Reparando…' : 'Repair'}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] px-2.5 gap-1.5 rounded-[4px] text-muted-foreground hover:text-foreground"
          onClick={() => onIgnore(record.id)}
          disabled={isRepairing || isIgnoring}
          aria-label={`Ignorar drift de ${formatDate(record.detected_at)}`}
        >
          {isIgnoring
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <EyeOff className="w-3 h-3" />
          }
          Ignorar
        </Button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DriftSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map(i => (
        <div key={i} className="h-24 rounded-[4px] animate-pulse bg-muted" />
      ))}
    </div>
  );
}

// ─── DriftModal ───────────────────────────────────────────────────────────────

export function DriftModal({ clientId, clientName, open, onClose }: DriftModalProps) {
  const qc = useQueryClient();
  const { data: allRecords, isLoading } = useClientDrift(clientId);

  // Show only 'detected' records (not repaired/acknowledged)
  const detected = (allRecords ?? []).filter(r => r.status === 'detected');
  const historical = (allRecords ?? []).filter(r => r.status !== 'detected');

  // Per-record ignore state (local, by id)
  const [ignoringId, setIgnoringId] = React.useState<string | null>(null);

  const handleIgnore = async (driftId: string) => {
    setIgnoringId(driftId);
    try {
      const { error } = await sbUntyped
        .from('adm_client_drift')
        .update({ status: 'acknowledged_persistent' })
        .eq('id', driftId)
        .eq('status', 'detected');

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['adm-client-drift', clientId] });
      qc.invalidateQueries({ queryKey: ['adm-all-clients-drift'] });
      toast.success('Drift marcado como ignorado.');
    } catch (err) {
      toast.error(`Falha ao ignorar drift: ${(err as Error).message}`);
    } finally {
      setIgnoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto rounded-[6px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <AlertTriangle className={cn(
              'w-4 h-4',
              detected.length > 0 ? 'text-red-500' : 'text-muted-foreground',
            )} />
            Drift de schema
            {clientName && (
              <span className="text-muted-foreground font-normal text-[13px]">
                — {clientName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            Divergências entre o schema esperado e o schema atual do tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Loading */}
          {isLoading && <DriftSkeleton />}

          {/* No detected drift */}
          {!isLoading && detected.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-[13px] font-medium text-foreground">
                Nenhum drift ativo
              </p>
              <p className="text-[11px] text-muted-foreground">
                O schema deste cliente está sincronizado.
              </p>
            </div>
          )}

          {/* Active detected records */}
          {detected.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Detectados ({detected.length})
              </p>
              {detected.map(record => (
                <DriftRow
                  key={record.id}
                  record={record}
                  clientId={clientId}
                  onIgnore={handleIgnore}
                  isIgnoring={ignoringId === record.id}
                />
              ))}
            </div>
          )}

          {/* Historical (repaired / acknowledged) */}
          {historical.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico ({historical.length})
              </p>
              {historical.map(record => (
                <div
                  key={record.id}
                  className="border border-border/50 rounded-[4px] px-3 py-2 flex items-center gap-3 bg-muted/30"
                >
                  <CheckCircle2 className={cn(
                    'w-3.5 h-3.5 flex-shrink-0',
                    record.status === 'repaired' ? 'text-emerald-500' : 'text-muted-foreground',
                  )} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(record.detected_at)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-2 text-[9px] rounded-[3px]',
                        record.status === 'repaired'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {record.status === 'repaired' ? 'reparado' : 'ignorado'}
                    </Badge>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] rounded-[3px] text-muted-foreground flex-shrink-0"
                  >
                    {record.expected_release}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
