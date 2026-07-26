
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, AlertTriangle } from "lucide-react";

// UUID da etapa "Perdido" — exclui da lista de retorno
const ALTIORA_LOST_STAGE_ID = 'a1000000-0000-0000-0001-000000000013';

export interface ReobrirPayload {
  stageId: string;
  proximaAcao?: string;
}

interface Stage {
  id: string;
  nome: string;
  name?: string;
  order_index?: number;
  ordem?: number;
  /** FK para o pipeline — pode ser pipeline_id ou leads_pipelines_id dependendo do hook */
  pipeline_id?: string;
  leads_pipelines_id?: string;
}

interface ReobrirReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: ReobrirPayload) => void;
  isLoading?: boolean;
  stages: Stage[];
  pipelineId?: string;
}

/**
 * ALTIORA-19 AC4: Modal de reabertura de referral perdido.
 * Visível apenas para Gestor Comercial e Admin.
 */
const ReobrirReferralModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  stages,
  pipelineId,
}: ReobrirReferralModalProps) => {
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [proximaAcao, setProximaAcao] = useState<string>("");

  // Etapas ativas do pipeline Altiora, excluindo "Perdido"
  const stagesAtivos = stages
    .filter(s => {
      const belongsToPipeline = !pipelineId || s.pipeline_id === pipelineId || s.leads_pipelines_id === pipelineId;
      return belongsToPipeline && s.id !== ALTIORA_LOST_STAGE_ID;
    })
    .sort((a, b) => (a.order_index ?? a.ordem ?? 0) - (b.order_index ?? b.ordem ?? 0));

  const handleConfirm = () => {
    if (!selectedStageId) return;
    onConfirm({
      stageId: selectedStageId,
      proximaAcao: proximaAcao.trim() || undefined,
    });
    setSelectedStageId("");
    setProximaAcao("");
  };

  const handleClose = () => {
    setSelectedStageId("");
    setProximaAcao("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <RotateCcw className="w-5 h-5" />
            Reabrir Referral
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info sobre histórico preservado */}
          <div className="flex items-start gap-2 p-3 rounded-[4px] bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" strokeWidth={1.5} />
            <p className="text-xs leading-relaxed">
              O encerramento anterior ficará preservado no histórico do referral.
            </p>
          </div>

          {/* Etapa de retorno — obrigatória */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Etapa de retorno <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione a etapa de retorno" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {stagesAtivos.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.nome || stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Próxima ação (opcional, mas recomendada) */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Próxima ação (recomendada)
            </Label>
            <Textarea
              value={proximaAcao}
              onChange={(e) => setProximaAcao(e.target.value)}
              placeholder="Descreva a próxima ação após reabrir..."
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
          <Button
            onClick={handleConfirm}
            disabled={!selectedStageId || isLoading}
            className="bg-amber-500 hover:bg-amber-500/90 text-white rounded-[4px] h-[30px] text-xs gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isLoading ? "Reabrindo..." : "Reabrir Referral"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReobrirReferralModal;
