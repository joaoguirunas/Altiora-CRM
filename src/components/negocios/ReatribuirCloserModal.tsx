/**
 * ALTIORA-22 UC08: Modal de reatribuição de Closer para Gestor/Admin.
 *
 * AC1: Exibe Closer atual (read-only), select de novo Closer ativo, select de motivo.
 * AC2: Registra interaction closer_reassigned com metadados.
 * AC3: Toggle "Manter atividades com o responsável anterior".
 * AC5: Valida que o novo Closer está ativo antes de salvar.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAltioraClosers } from '@/hooks/useAltioraClosers';
import {
  useReatribuirCloser,
  MOTIVOS_REATRIBUICAO,
  type MotivoReatribuicao,
} from '@/hooks/useAltioraReatribuicao';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReatribuirCloserModalProps {
  isOpen:        boolean;
  onClose:       () => void;
  leadId:        string;
  currentCloserId?: string | null;
  currentCloserName?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ReatribuirCloserModal = ({
  isOpen,
  onClose,
  leadId,
  currentCloserId,
  currentCloserName,
}: ReatribuirCloserModalProps) => {
  const { user } = useAuth();
  const { data: closers = [], isLoading: isLoadingClosers } = useAltioraClosers();
  const reatribuir = useReatribuirCloser();

  const [novoCloserId, setNovoCloserId] = useState('');
  const [motivo, setMotivo] = useState<MotivoReatribuicao | ''>('');
  const [manterAtividades, setManterAtividades] = useState(false);

  const novoCloser = closers.find(c => c.id === novoCloserId);
  const canSave = novoCloserId && novoCloserId !== currentCloserId && motivo && !reatribuir.isPending;

  const handleClose = () => {
    setNovoCloserId('');
    setMotivo('');
    setManterAtividades(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!user?.id || !novoCloserId || !motivo) return;
    await reatribuir.mutateAsync({
      leadId,
      fromCloserId:              currentCloserId ?? null,
      fromCloserName:            currentCloserName ?? 'Sem responsável',
      toCloserId:                novoCloserId,
      toCloserName:              novoCloser?.name ?? '',
      motivo:                    motivo as MotivoReatribuicao,
      manterAtividadesComAnterior: manterAtividades,
      actorId:                   user.id,
    });
    handleClose();
  };

  // Closers disponíveis = ativos exceto o atual
  const closersDisponiveis = closers.filter(c => c.id !== currentCloserId);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-[420px] rounded-[4px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-muted-foreground" />
            Alterar responsável
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Closer atual (read-only) */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block text-muted-foreground">
              Closer atual
            </Label>
            <div className="h-9 px-3 flex items-center rounded-[4px] border border-border bg-muted/30 text-sm text-muted-foreground">
              {currentCloserName ?? 'Sem responsável'}
            </div>
          </div>

          {/* Novo Closer (select) */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Novo Closer <span className="text-destructive">*</span>
            </Label>
            {isLoadingClosers ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando closers...
              </div>
            ) : closersDisponiveis.length === 0 ? (
              <div className="flex items-center gap-2 py-2 text-amber-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Nenhum Closer ativo disponível.
              </div>
            ) : (
              <Select value={novoCloserId} onValueChange={setNovoCloserId}>
                <SelectTrigger className="rounded-[4px]">
                  <SelectValue placeholder="Selecione um Closer..." />
                </SelectTrigger>
                <SelectContent className="rounded-[4px]">
                  {closersDisponiveis.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.email && (
                        <span className="text-muted-foreground text-[11px] ml-1.5">— {c.email}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Motivo da troca */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Motivo da troca <span className="text-destructive">*</span>
            </Label>
            <Select value={motivo} onValueChange={v => setMotivo(v as MotivoReatribuicao)}>
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {MOTIVOS_REATRIBUICAO.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AC3: Toggle manter atividades */}
          <div className="flex items-center gap-3 py-1 border-t border-border/50 pt-3">
            <Switch
              checked={manterAtividades}
              onCheckedChange={setManterAtividades}
            />
            <div>
              <Label className="text-sm font-medium cursor-pointer">
                Manter reuniões com o responsável anterior
              </Label>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Reuniões futuras já agendadas não serão transferidas ao novo Closer.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={reatribuir.isPending}
            className="rounded-[4px] h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSave}
            className="rounded-[4px] h-8 text-xs gap-1.5"
          >
            {reatribuir.isPending ? (
              <><Loader2 className="w-3 h-3 animate-spin" />Salvando...</>
            ) : (
              <><UserCheck className="w-3 h-3" />Confirmar reatribuição</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReatribuirCloserModal;
