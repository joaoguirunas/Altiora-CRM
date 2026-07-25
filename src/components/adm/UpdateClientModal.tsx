/**
 * UpdateClientModal — REL-02 AC2+AC3
 * Shows changelog between current → target version, confirms twice,
 * then triggers the background job and shows live Realtime progress.
 * AC8: focus trap + aria-busy + role="status".
 */
import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { type AdmClient, useUpdateClient } from '@/hooks/useAdmClients';
import { useAdmReleasesBetween } from '@/hooks/useAdmReleases';
import { UpdateProgressView } from './UpdateProgressView';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UpdateClientModalProps {
  client: AdmClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateClientModal({ client, open, onOpenChange }: UpdateClientModalProps) {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);

  const { data: releases, isLoading: releasesLoading } = useAdmReleasesBetween(
    client?.current_version ?? null,
    client?.target_version ?? null
  );

  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient();

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setJobId(null);
    }
  }, [open]);

  if (!client) return null;

  const currentVersion = client.current_version ?? null;
  const targetVersion = client.target_version ?? null;
  const hasDrift = currentVersion !== targetVersion && !!targetVersion;

  const migrationsList = releases?.flatMap(r => (r.migrations as string[]) ?? []) ?? [];
  const estimatedSeconds = Math.max(2, Math.round(migrationsList.length * 0.5));

  const handleUpdate = () => {
    if (!targetVersion) return;
    updateClient(
      { clientId: client.id, targetVersion },
      {
        onSuccess: ({ jobId: newJobId }) => {
          setJobId(newJobId);
          toast.success('Atualização iniciada!');
        },
        onError: () => {
          // toast handled by mutation
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl"
        aria-describedby="update-client-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Atualizar Cliente
            <span className="text-muted-foreground font-normal text-sm">— {client.name}</span>
          </DialogTitle>
          {/* Version arrow */}
          <div className="flex items-center gap-2 text-sm pt-1">
            <Badge variant="outline" className="rounded-[4px] font-mono text-xs">
              v{currentVersion ?? '—'}
            </Badge>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <Badge variant="outline" className="rounded-[4px] font-mono text-xs bg-primary/5 border-primary/30 text-primary">
              v{targetVersion ?? '—'}
            </Badge>
          </div>
        </DialogHeader>

        <div id="update-client-description" className="space-y-4 py-2">
          {/* Progress view (after job started) */}
          {jobId ? (
            <UpdateProgressView
              jobId={jobId}
              onClose={handleClose}
              onViewLogs={() => {
                handleClose();
                navigate(`/adm/clients/${client.id}`);
              }}
            />
          ) : (
            <>
              {/* Changelog */}
              {releasesLoading ? (
                <p className="text-xs text-muted-foreground animate-pulse">Carregando changelog...</p>
              ) : releases && releases.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Changelog</p>
                  <div className="max-h-32 overflow-y-auto rounded-[4px] border border-border bg-muted/30 p-3 space-y-2">
                    {releases.map(r => (
                      <div key={r.id}>
                        <p className="text-xs font-mono font-semibold text-foreground">v{r.version}</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{r.changelog ?? 'Sem changelog.'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Migrations list */}
              {migrationsList.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <FileText className="w-3.5 h-3.5" />
                    {migrationsList.length} migration(s) a aplicar · ~{estimatedSeconds}s
                  </div>
                  <div className="max-h-24 overflow-y-auto rounded-[4px] border border-border bg-muted/30 p-2 space-y-0.5">
                    {migrationsList.map((m, i) => (
                      <p key={i} className="text-[11px] font-mono text-muted-foreground">{m}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Warning when no drift */}
              {!hasDrift && (
                <div className="flex items-start gap-2 p-3 rounded-[4px] bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Este cliente já está na versão alvo. A atualização pode ser aplicada novamente, mas não terá efeito sobre migrations já aplicadas (idempotente).
                  </p>
                </div>
              )}

              <Separator />

              {/* Double confirmation checkbox (AC2) */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-update"
                  checked={confirmed}
                  onCheckedChange={v => setConfirmed(!!v)}
                />
                <Label htmlFor="confirm-update" className="text-xs text-foreground/80 cursor-pointer leading-relaxed">
                  Confirmo que entendo que esta operação modificará o schema do banco do cliente{' '}
                  <span className="font-semibold">{client.name}</span> e não pode ser desfeita automaticamente.
                </Label>
              </div>
            </>
          )}
        </div>

        {!jobId && (
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-[30px] rounded-[4px] text-xs"
              onClick={handleClose}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className={cn('h-[30px] rounded-[4px] text-xs', !confirmed && 'opacity-50')}
              disabled={!confirmed || isUpdating || !targetVersion}
              onClick={handleUpdate}
              aria-busy={isUpdating}
            >
              {isUpdating ? 'Iniciando...' : 'Atualizar agora'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
