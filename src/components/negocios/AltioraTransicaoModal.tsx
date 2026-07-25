/**
 * ALTIORA-12: Modal de validação de transição de etapa Altiora.
 *
 * AC1: Exibe campos obrigatórios não atendidos antes de confirmar a transição.
 * AC3: Detecta salto de etapas e exige confirmação explícita.
 * AC4: Chama useConfirmarTransicao que insere em lead_stage_history.
 * AC5: Retorno a etapa anterior é permitido com confirmação.
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  checkStageRequirements,
  isSkippingStages,
  useConfirmarTransicao,
  type StageRequirement,
} from '@/hooks/useAltioraStageTransition';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AltioraTransicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  actorId: string;
  fromStageId: string;
  toStageId: string;
  fromStageName: string;
  toStageName: string;
  /** Called after successful transition */
  onSuccess: (newStageId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const AltioraTransicaoModal = ({
  open,
  onOpenChange,
  leadId,
  actorId,
  fromStageId,
  toStageId,
  fromStageName,
  toStageName,
  onSuccess,
}: AltioraTransicaoModalProps) => {
  const confirmarTransicao = useConfirmarTransicao();

  const [missingReqs, setMissingReqs]   = useState<StageRequirement[]>([]);
  const [isChecking, setIsChecking]     = useState(false);
  const [skipConfirmed, setSkipConfirmed] = useState(false);

  const isSkipping  = isSkippingStages(fromStageId, toStageId);
  const isGoingBack = (() => {
    // Detect backward movement — if fromStageId > toStageId in order
    // (Use a simple position lookup via known IDs)
    const fromNum = parseInt(fromStageId.split('-').pop()?.replace(/^0+/, '') ?? '0', 10);
    const toNum   = parseInt(toStageId.split('-').pop()?.replace(/^0+/, '') ?? '0', 10);
    return toNum < fromNum;
  })();

  // Check requirements whenever modal opens
  useEffect(() => {
    if (!open) return;
    setIsChecking(true);
    setMissingReqs([]);
    setSkipConfirmed(false);

    checkStageRequirements(leadId, toStageId).then(missing => {
      setMissingReqs(missing);
      setIsChecking(false);
    });
  }, [open, leadId, toStageId]);

  const canConfirm = !isChecking
    && !confirmarTransicao.isPending
    && (!isSkipping || skipConfirmed);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await confirmarTransicao.mutateAsync({
      leadId,
      actorId,
      fromStageId,
      toStageId,
      skipConfirmed,
    });
    onOpenChange(false);
    onSuccess(toStageId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            Mover para "{toStageName}"
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Transition arrow */}
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground/70 truncate max-w-[160px]">{fromStageName}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
            <span className="font-medium text-foreground truncate max-w-[160px]">{toStageName}</span>
          </div>

          {/* Loading requirements */}
          {isChecking && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground/70 py-2">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Verificando pré-requisitos...
            </div>
          )}

          {/* Missing requirements */}
          {!isChecking && missingReqs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Pré-requisitos não atendidos:
              </p>
              <ul className="space-y-1.5">
                {missingReqs.map((req, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-[4px] bg-amber-500/5 border border-amber-500/20"
                  >
                    <XCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div>
                      <p className="text-[12px] font-medium text-foreground">{req.label}</p>
                      <p className="text-[11px] text-muted-foreground/70">{req.missing}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground/60">
                Você pode confirmar mesmo assim — o sistema apenas avisará que os dados estão incompletos.
              </p>
            </div>
          )}

          {/* All requirements met */}
          {!isChecking && missingReqs.length === 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-[4px] bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
              <p className="text-[12px] text-emerald-700 dark:text-emerald-400">
                Todos os pré-requisitos atendidos.
              </p>
            </div>
          )}

          {/* Skip warning (AC3) */}
          {isSkipping && !isGoingBack && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2.5 rounded-[4px] bg-orange-500/5 border border-orange-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[12px] font-medium text-orange-700 dark:text-orange-400">
                    Você está pulando etapas
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    A transição de "{fromStageName}" direto para "{toStageName}" pula etapas intermediárias.
                    Confirme abaixo para prosseguir.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={skipConfirmed}
                  onChange={e => setSkipConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-[12px] text-foreground/80 group-hover:text-foreground">
                  Confirmo que estou ciente do salto de etapas
                </span>
              </label>
            </div>
          )}

          {/* Going back warning */}
          {isGoingBack && (
            <div className="flex items-start gap-2 p-2.5 rounded-[4px] bg-blue-500/5 border border-blue-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div>
                <p className="text-[12px] font-medium text-blue-700 dark:text-blue-400">
                  Retorno a etapa anterior
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Os dados registrados nas etapas mais avançadas serão preservados.
                </p>
              </div>
            </div>
          )}

          {/* Status badge if has missing reqs but user can proceed */}
          {missingReqs.length > 0 && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0.5 h-5 rounded-[3px]',
                'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-400',
              )}
            >
              Transição com aviso
            </Badge>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmarTransicao.isPending}
            className="rounded-[4px] h-[30px] text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-[4px] h-[30px] text-xs gap-1.5"
          >
            {confirmarTransicao.isPending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <ArrowRight className="w-3 h-3" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AltioraTransicaoModal;
