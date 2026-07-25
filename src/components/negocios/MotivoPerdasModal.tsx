
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMotivosPerda } from "@/hooks/useMotivosPerda";
import { XCircle, RotateCcw } from "lucide-react";

export interface MotivoPerdasPayload {
  motivoId: string;
  motivoTexto?: string;
  possibilidadeRetomada: boolean;
  observacoes?: string;
}

interface MotivoPerdasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: MotivoPerdasPayload) => void;
  isLoading?: boolean;
}

const MotivoPerdasModal = ({ isOpen, onClose, onConfirm, isLoading = false }: MotivoPerdasModalProps) => {

  const { motivos } = useMotivosPerda('single-tenant');
  const [selectedMotivoId, setSelectedMotivoId] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [possibilidadeRetomada, setPossibilidadeRetomada] = useState<boolean>(false);

  const handleConfirm = () => {
    if (!selectedMotivoId) return;

    const selectedMotivo = motivos.find(m => m.id === selectedMotivoId);
    onConfirm({
      motivoId: selectedMotivoId,
      motivoTexto: observacoes || selectedMotivo?.name,
      possibilidadeRetomada,
      observacoes: observacoes || undefined,
    });

    // Reset form
    setSelectedMotivoId("");
    setObservacoes("");
    setPossibilidadeRetomada(false);
  };

  const handleClose = () => {
    setSelectedMotivoId("");
    setObservacoes("");
    setPossibilidadeRetomada(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            Encerrar como Perdido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Motivo obrigatório — lista de leads_loss_reasons (AC1, AC3) */}
          <div>
            <Label htmlFor="motivo" className="text-sm font-medium text-foreground mb-2 block">
              Motivo da perda <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedMotivoId} onValueChange={setSelectedMotivoId}>
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {motivos.length === 0 && (
                  <SelectItem value="__loading__" disabled>
                    Carregando motivos...
                  </SelectItem>
                )}
                {motivos.map((motivo) => (
                  <SelectItem key={motivo.id} value={motivo.id}>
                    {motivo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Possibilidade de retomada futura (AC1) */}
          <div className="flex items-center justify-between p-3 border border-border rounded-[4px] bg-muted/20">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium text-foreground">Possibilidade de retomada</p>
                <p className="text-xs text-muted-foreground/60">Indica que pode ser reaberto no futuro</p>
              </div>
            </div>
            <Switch
              checked={possibilidadeRetomada}
              onCheckedChange={setPossibilidadeRetomada}
              aria-label="Possibilidade de retomada futura"
            />
          </div>

          {/* Observações adicionais (AC1) */}
          <div>
            <Label htmlFor="observacoes" className="text-sm font-medium text-foreground mb-2 block">
              Observações adicionais (opcional)
            </Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva detalhes sobre o motivo da perda..."
              className="min-h-[80px] rounded-[4px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-[4px] h-[30px] text-xs"
          >
            Cancelar
          </Button>
          {/* AC1: botão desabilitado sem motivo selecionado */}
          <Button
            onClick={handleConfirm}
            disabled={!selectedMotivoId || isLoading}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-[4px] h-[30px] text-xs"
          >
            {isLoading ? "Salvando..." : "Confirmar Perda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MotivoPerdasModal;
