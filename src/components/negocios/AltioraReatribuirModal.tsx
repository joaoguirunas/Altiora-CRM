/**
 * ALTIORA-22 AC1-AC3: Modal de reatribuição de Closer.
 *
 * Exibe: Closer atual (read-only), Novo Closer (select de ativos),
 * Motivo da troca (select), toggle "Manter atividades com anterior".
 * Ao confirmar: atualiza altiora_closer_id + registra interação + notifica ambos.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserCheck } from 'lucide-react';
import { useAltioraClosers } from '@/hooks/useAltioraClosers';
import {
  useReatribuirCloser,
  MOTIVOS_REATRIBUICAO,
  type MotivoReatribuicao,
} from '@/hooks/useAltioraReatribuicao';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AltioraReatribuirModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentCloserId: string | null;
  currentCloserName: string;
  actorId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AltioraReatribuirModal = ({
  open,
  onOpenChange,
  leadId,
  currentCloserId,
  currentCloserName,
  actorId,
}: AltioraReatribuirModalProps) => {
  const [novoCloserId, setNovoCloserId] = useState('');
  const [motivo, setMotivo] = useState<MotivoReatribuicao | ''>('');
  const [manterAtividades, setManterAtividades] = useState(false);

  const { data: closers = [], isLoading: loadingClosers } = useAltioraClosers();
  const reatribuir = useReatribuirCloser();

  const closersDisponiveis = closers.filter(c => c.id !== currentCloserId);
  const novoCloser = closers.find(c => c.id === novoCloserId);

  const handleConfirmar = async () => {
    if (!novoCloserId || !motivo) return;

    await reatribuir.mutateAsync({
      leadId,
      fromCloserId:               currentCloserId,
      fromCloserName:             currentCloserName,
      toCloserId:                 novoCloserId,
      toCloserName:               novoCloser?.name ?? novoCloserId,
      motivo,
      manterAtividadesComAnterior: manterAtividades,
      actorId,
    });

    // Reset e fechar
    setNovoCloserId('');
    setMotivo('');
    setManterAtividades(false);
    onOpenChange(false);
  };

  const canConfirm = !!novoCloserId && !!motivo && !reatribuir.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <UserCheck className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
            Alterar responsável
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Closer atual — read-only */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Closer atual
            </Label>
            <div className="px-3 py-2.5 rounded-[4px] border border-border bg-muted/30 text-[13px] text-foreground/70">
              {currentCloserName || 'Não atribuído'}
            </div>
          </div>

          {/* Novo Closer */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Novo Closer *
            </Label>
            <Select
              value={novoCloserId}
              onValueChange={setNovoCloserId}
              disabled={loadingClosers}
            >
              <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                <SelectValue placeholder="Selecione um Closer" />
              </SelectTrigger>
              <SelectContent>
                {closersDisponiveis.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name}
                  </SelectItem>
                ))}
                {closersDisponiveis.length === 0 && (
                  <SelectItem value="__none" disabled className="text-[12px] text-muted-foreground/50">
                    Nenhum Closer disponível
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Motivo da troca *
            </Label>
            <Select
              value={motivo}
              onValueChange={(v) => setMotivo(v as MotivoReatribuicao)}
            >
              <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_REATRIBUICAO.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-[13px]">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manter atividades (AC3) */}
          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <Label className="text-[13px] text-foreground/80 cursor-pointer">
                Manter atividades com o responsável anterior
              </Label>
              <p className="text-[11px] text-muted-foreground/50">
                Se ativado, as reuniões futuras não são transferidas ao novo Closer.
              </p>
            </div>
            <Switch
              checked={manterAtividades}
              onCheckedChange={setManterAtividades}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-[4px] h-8 text-[13px]"
            onClick={() => onOpenChange(false)}
            disabled={reatribuir.isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-[4px] h-8 text-[13px] bg-primary hover:bg-primary/90"
            disabled={!canConfirm}
            onClick={handleConfirmar}
          >
            {reatribuir.isPending ? 'Salvando…' : 'Confirmar reatribuição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
