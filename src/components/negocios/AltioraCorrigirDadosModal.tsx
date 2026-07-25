/**
 * ALTIORA-22 AC4: Modal de correção de dados críticos (Admin only).
 *
 * Permite ao Admin corrigir: origem, data handoff, valor do prêmio.
 * Exige motivo textual. Registra correção em altiora_lead_interactions
 * com payload {campo, valor_antigo, valor_novo, corrected_by, correction_reason}.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import {
  useCorrigirCampo,
  CAMPOS_CORRIGIVEIS,
  type CampoCorrigivel,
} from '@/hooks/useAltioraReatribuicao';

// ── Opções de origem ──────────────────────────────────────────────────────────

const ORIGENS = [
  { value: 'avenue_email', label: 'Avenue (e-mail)' },
  { value: 'manual',       label: 'Manual' },
  { value: 'indicacao',    label: 'Indicação' },
  { value: 'outros',       label: 'Outros' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface AltioraCorrigirDadosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  /** Valores atuais do lead para exibir como "antes" */
  currentValues: {
    altiora_origem?: string | null;
    altiora_data_handoff?: string | null;
    value?: number | null;
  };
  actorId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AltioraCorrigirDadosModal = ({
  open,
  onOpenChange,
  leadId,
  currentValues,
  actorId,
}: AltioraCorrigirDadosModalProps) => {
  const [campo, setCampo] = useState<CampoCorrigivel | ''>('');
  const [novoValor, setNovoValor] = useState('');
  const [motivo, setMotivo] = useState('');

  const corrigir = useCorrigirCampo();

  const campoConfig = CAMPOS_CORRIGIVEIS.find(c => c.value === campo);

  const valorAtual = (): string => {
    if (!campo) return '';
    if (campo === 'altiora_origem') return currentValues.altiora_origem ?? '—';
    if (campo === 'altiora_data_handoff') return currentValues.altiora_data_handoff ?? '—';
    if (campo === 'value') return currentValues.value?.toString() ?? '0';
    return '';
  };

  const handleCampoChange = (val: CampoCorrigivel) => {
    setCampo(val);
    setNovoValor(valorAtual());
  };

  const handleConfirmar = async () => {
    if (!campo || !novoValor || !motivo.trim()) return;

    await corrigir.mutateAsync({
      leadId,
      campo,
      campoLabel: campoConfig?.label ?? campo,
      valorAntigo: valorAtual(),
      valorNovo:   novoValor,
      motivo:      motivo.trim(),
      actorId,
    });

    // Reset e fechar
    setCampo('');
    setNovoValor('');
    setMotivo('');
    onOpenChange(false);
  };

  const canConfirm = !!campo && !!novoValor && motivo.trim().length >= 5 && !corrigir.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            Corrigir dados críticos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Aviso Admin */}
          <div className="px-3 py-2 rounded-[4px] border border-amber-400/30 bg-amber-400/5 text-[12px] text-amber-400/80">
            Esta ação é auditada. Toda correção é registrada no histórico do referral com seu nome e o motivo informado.
          </div>

          {/* Selecionar campo */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Campo a corrigir *
            </Label>
            <Select
              value={campo}
              onValueChange={(v) => handleCampoChange(v as CampoCorrigivel)}
            >
              <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                {CAMPOS_CORRIGIVEIS.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-[13px]">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor atual (read-only) */}
          {campo && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Valor atual
              </Label>
              <div className="px-3 py-2.5 rounded-[4px] border border-border bg-muted/30 text-[13px] text-foreground/60">
                {valorAtual() || '—'}
              </div>
            </div>
          )}

          {/* Novo valor */}
          {campo && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Novo valor *
              </Label>
              {campo === 'altiora_origem' ? (
                <Select value={novoValor} onValueChange={setNovoValor}>
                  <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-[13px]">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : campo === 'altiora_data_handoff' ? (
                <Input
                  type="date"
                  value={novoValor.split('T')[0]}
                  onChange={(e) => setNovoValor(e.target.value)}
                  className="h-9 text-[13px] rounded-[4px]"
                />
              ) : (
                <Input
                  type="number"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-[13px] rounded-[4px]"
                />
              )}
            </div>
          )}

          {/* Motivo da correção */}
          {campo && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Motivo da correção * (mín. 5 caracteres)
              </Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da correção..."
                className="text-[13px] rounded-[4px] min-h-[72px] resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-[4px] h-8 text-[13px]"
            onClick={() => onOpenChange(false)}
            disabled={corrigir.isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-[4px] h-8 text-[13px] bg-amber-500 hover:bg-amber-500/90 text-white"
            disabled={!canConfirm}
            onClick={handleConfirmar}
          >
            {corrigir.isPending ? 'Salvando…' : 'Confirmar correção'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
