/**
 * ALTIORA-14 AC1-AC4: Drawer para registrar resultado de reunião Altiora.
 *
 * Abre apenas para reuniões com horário passado.
 * Status: Realizada (cliente compareceu), No-show, Cancelada.
 * AC2: Realizada → resultado + encadeia ProximaAcaoModal
 * AC3: No-show → motivo + ação (Reagendar / Encerrar como Perdido)
 * AC4: Salva status + compareceu + resultado em meetings + insere interação
 * AC5: R1 realizada → toast com sugestão de preencher diagnóstico R1 (ALTIORA-15)
 */

import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useRegistrarResultadoMeeting,
  type AltioraMeetingType,
  type ResultadoMeetingStatus,
} from '@/hooks/useAltioraMeetings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Constants ─────────────────────────────────────────────────────────────────

const MOTIVOS_NOSHOW = [
  'Não compareceu sem aviso prévio',
  'Avisou e pediu remarcação',
  'Problema técnico (conexão, link do Meet)',
  'Esqueceu o compromisso',
  'Imprevisto de última hora (justificado)',
  'Outro (detalhar em observações)',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistrarResultadoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  leadId: string;
  tipo: AltioraMeetingType;
  /** Callback quando "Realizada" — encadeia ProximaAcaoModal (AC2) */
  onRealizadaSuccess?: () => void;
  /** Callback quando "No-show + Reagendar" — abre modal de agendamento (AC3) */
  onNoShowRemarcar?: () => void;
  /** Callback quando "No-show + Encerrar como Perdido" (AC3) */
  onNoShowPerder?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const RegistrarResultadoDrawer = ({
  open,
  onOpenChange,
  meetingId,
  leadId,
  tipo,
  onRealizadaSuccess,
  onNoShowRemarcar,
  onNoShowPerder,
}: RegistrarResultadoDrawerProps) => {
  const { user } = useAuth();
  const registrarResultado = useRegistrarResultadoMeeting();

  const [status, setStatus] = useState<ResultadoMeetingStatus | ''>('');
  const [resultado, setResultado] = useState('');
  const [motivoNoShow, setMotivoNoShow] = useState('');
  const [acaoNoShow, setAcaoNoShow] = useState<'remarcar' | 'perder' | ''>('');

  const canSave =
    !!status &&
    (status !== 'noshow' || !!motivoNoShow) &&
    (status !== 'realizada' || resultado.trim().length > 0) &&
    !registrarResultado.isPending;

  const handleSave = async () => {
    if (!canSave || !user?.id) return;
    await registrarResultado.mutateAsync({
      meetingId,
      leadId,
      tipo,
      actorId: user.id,
      status: status as ResultadoMeetingStatus,
      resultado: status === 'realizada' ? resultado : undefined,
      motivoNoShow: status === 'noshow' ? motivoNoShow : undefined,
    });

    // AC5: R1 realizada → sugestão de preencher diagnóstico R1
    if (status === 'realizada' && tipo === 'R1') {
      toast.info('Preencha o diagnóstico da R1 na seção "Diagnóstico R1" da ficha.', {
        duration: 6000,
      });
    }

    onOpenChange(false);

    if (status === 'realizada') {
      onRealizadaSuccess?.();
    } else if (status === 'noshow') {
      if (acaoNoShow === 'remarcar') onNoShowRemarcar?.();
      if (acaoNoShow === 'perder')   onNoShowPerder?.();
    }

    // Reset
    setStatus('');
    setResultado('');
    setMotivoNoShow('');
    setAcaoNoShow('');
  };

  const handleClose = () => {
    setStatus('');
    setResultado('');
    setMotivoNoShow('');
    setAcaoNoShow('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
          <SheetTitle className="text-base font-semibold">
            Registrar resultado — {tipo}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status da reunião */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-3 block">
              O que aconteceu? <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={status}
              onValueChange={v => setStatus(v as ResultadoMeetingStatus)}
              className="space-y-2"
            >
              <label
                className={cn(
                  'flex items-center gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
                  status === 'realizada'
                    ? 'border-emerald-500/60 bg-emerald-500/5'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <RadioGroupItem value="realizada" />
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-none" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium">Realizada</p>
                  <p className="text-[11px] text-muted-foreground">Cliente compareceu</p>
                </div>
              </label>

              <label
                className={cn(
                  'flex items-center gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
                  status === 'noshow'
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <RadioGroupItem value="noshow" />
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-none" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium">No-show</p>
                  <p className="text-[11px] text-muted-foreground">Cliente não compareceu</p>
                </div>
              </label>

              <label
                className={cn(
                  'flex items-center gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
                  status === 'cancelada'
                    ? 'border-destructive/60 bg-destructive/5'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <RadioGroupItem value="cancelada" />
                <XCircle className="w-4 h-4 text-destructive flex-none" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium">Cancelada</p>
                  <p className="text-[11px] text-muted-foreground">Reunião foi cancelada</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Realizada: resultado */}
          {status === 'realizada' && (
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">
                Resultado geral <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={resultado}
                onChange={e => setResultado(e.target.value)}
                placeholder="Descreva o resultado da reunião..."
                className="min-h-[100px] rounded-[4px]"
              />
            </div>
          )}

          {/* No-show: motivo + ação */}
          {status === 'noshow' && (
            <>
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">
                  Motivo do no-show <span className="text-destructive">*</span>
                </Label>
                <Select value={motivoNoShow} onValueChange={setMotivoNoShow}>
                  <SelectTrigger className="rounded-[4px]">
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[4px]">
                    {MOTIVOS_NOSHOW.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">
                  Próxima ação
                </Label>
                <RadioGroup
                  value={acaoNoShow}
                  onValueChange={v => setAcaoNoShow(v as 'remarcar' | 'perder')}
                  className="space-y-2"
                >
                  <label className={cn(
                    'flex items-center gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
                    acaoNoShow === 'remarcar' ? 'border-primary/60 bg-primary/5' : 'border-border hover:bg-muted/30',
                  )}>
                    <RadioGroupItem value="remarcar" />
                    <span className="text-sm">Reagendar reunião</span>
                  </label>
                  <label className={cn(
                    'flex items-center gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
                    acaoNoShow === 'perder' ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:bg-muted/30',
                  )}>
                    <RadioGroupItem value="perder" />
                    <span className="text-sm">Encerrar como Perdido</span>
                  </label>
                </RadioGroup>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t border-border gap-2 flex-none">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={registrarResultado.isPending}
            className="rounded-[4px] h-[34px] text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-[4px] h-[34px] text-xs gap-1.5 flex-1"
          >
            {registrarResultado.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Registrar resultado'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default RegistrarResultadoDrawer;
