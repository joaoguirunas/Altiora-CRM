/**
 * BulkUpdateModal — REL-02 AC4
 * Bulk update all outdated clients. Max 5 concurrent fan-out.
 * AC8: focus trap via Dialog, aria-busy on action button.
 */
import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type AdmClient, useBulkUpdateClients } from '@/hooks/useAdmClients';
import { cn } from '@/lib/utils';

interface BulkUpdateModalProps {
  clients: AdmClient[];  // only outdated clients passed in
  targetVersion: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientResult {
  clientId: string;
  name: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

export function BulkUpdateModal({ clients, targetVersion, open, onOpenChange }: BulkUpdateModalProps) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(clients.map(c => c.id)));
  const [confirmed, setConfirmed] = React.useState(false);
  const [results, setResults] = React.useState<ClientResult[] | null>(null);
  const { mutate: bulkUpdate, isPending } = useBulkUpdateClients();

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setSelected(new Set(clients.map(c => c.id)));
      setConfirmed(false);
      setResults(null);
    }
  }, [open, clients]);

  const toggleClient = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = [...selected];
  const selectedClients = clients.filter(c => selected.has(c.id));

  const handleBulkUpdate = () => {
    if (!targetVersion || selectedIds.length === 0) return;

    // Initialize results
    setResults(selectedClients.map(c => ({ clientId: c.id, name: c.name, status: 'pending' })));

    bulkUpdate(
      { clientIds: selectedIds, targetVersion },
      {
        onSuccess: ({ results: batchResults }) => {
          setResults(batchResults.map(r => {
            const client = clients.find(c => c.id === r.clientId);
            return {
              clientId: r.clientId,
              name: client?.name ?? r.clientId,
              status: r.error ? 'failed' : 'success',
              error: r.error,
            };
          }));
          const ok = batchResults.filter(r => !r.error).length;
          const fail = batchResults.filter(r => !!r.error).length;
          if (fail === 0) {
            toast.success(`${ok} cliente(s) atualizados com sucesso`);
          } else {
            toast.warning(`${ok} atualizados, ${fail} com erro`);
          }
        },
        onError: () => {
          setResults(prev => prev?.map(r => ({ ...r, status: 'failed' })) ?? null);
        },
      }
    );
  };

  const isDone = results !== null && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Atualizar todos os clientes desatualizados
          </DialogTitle>
          {targetVersion && (
            <p className="text-xs text-muted-foreground pt-1">
              Versão alvo:{' '}
              <span className="font-mono font-semibold text-foreground">v{targetVersion}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client list or results */}
          {results ? (
            // Progress / results view
            <div
              role="status"
              aria-live="polite"
              className="space-y-1.5 max-h-56 overflow-y-auto"
            >
              {results.map(r => (
                <div key={r.clientId} className="flex items-center gap-2 text-xs">
                  {r.status === 'pending' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
                  {r.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                  {r.status === 'failed'  && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  <span className="font-medium text-foreground truncate">{r.name}</span>
                  {r.error && <span className="text-red-500 truncate text-[10px]">{r.error}</span>}
                </div>
              ))}
            </div>
          ) : (
            // Selection list
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {clients.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`bulk-${c.id}`}
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggleClient(c.id)}
                  />
                  <Label htmlFor={`bulk-${c.id}`} className="cursor-pointer flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-muted-foreground font-mono">{c.current_version ?? '—'}</span>
                  </Label>
                </div>
              ))}
            </div>
          )}

          {!results && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-[4px] text-xs">
                  {selectedIds.length} selecionado(s)
                </Badge>
              </div>

              {/* Double confirmation (AC4) */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="bulk-confirm"
                  checked={confirmed}
                  onCheckedChange={v => setConfirmed(!!v)}
                />
                <Label htmlFor="bulk-confirm" className="text-xs text-foreground/80 cursor-pointer leading-relaxed">
                  Confirmo que entendo que esta operação modificará o schema de{' '}
                  <span className="font-semibold">{selectedIds.length} cliente(s)</span>.
                  Máximo 5 atualizações em paralelo.
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px] rounded-[4px] text-xs"
            onClick={() => onOpenChange(false)}
          >
            {isDone ? 'Fechar' : 'Cancelar'}
          </Button>
          {!isDone && (
            <Button
              size="sm"
              className={cn('h-[30px] rounded-[4px] text-xs', (!confirmed || selectedIds.length === 0) && 'opacity-50')}
              disabled={!confirmed || selectedIds.length === 0 || isPending || !targetVersion}
              onClick={handleBulkUpdate}
              aria-busy={isPending}
            >
              {isPending
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Atualizando...</>
                : `Atualizar ${selectedIds.length} cliente(s)`
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
