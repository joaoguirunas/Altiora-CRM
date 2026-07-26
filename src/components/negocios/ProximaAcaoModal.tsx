/**
 * ALTIORA-11 AC3-AC4: Modal de definição de próxima ação.
 *
 * Aparece encadeado após registrar um contato.
 * Salva next_action_type, next_action_description, next_action_due_at em leads.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Target, AlertTriangle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProximaAcaoFormData {
  tipo: string;
  descricao: string;
  responsavelId?: string;
  prazo?: string;
}

interface Usuario {
  id: string;
  name: string;
}

interface ProximaAcaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ProximaAcaoFormData) => void;
  isLoading?: boolean;
  /** Lista de closers disponíveis */
  closers?: Usuario[];
  /** ID do responsável padrão (Closer atribuído) */
  defaultResponsavelId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS_ACAO = ['Ligação', 'Reunião', 'E-mail', 'Tarefa'];

// ── Component ─────────────────────────────────────────────────────────────────

const ProximaAcaoModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  closers = [],
  defaultResponsavelId = '',
}: ProximaAcaoModalProps) => {
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavelId, setResponsavelId] = useState(defaultResponsavelId);
  const [prazo, setPrazo] = useState('');
  const [prazoError, setPrazoError] = useState<string | null>(null);

  const validatePrazo = (value: string) => {
    if (!value) {
      setPrazoError(null);
      return true;
    }
    const prazoDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (prazoDate < today) {
      setPrazoError('Prazo não pode ser no passado');
      return false;
    }
    setPrazoError(null);
    return true;
  };

  const canConfirm = tipo && descricao.trim() && !prazoError && !isLoading;

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (!validatePrazo(prazo)) return;
    onConfirm({
      tipo,
      descricao: descricao.trim(),
      responsavelId: responsavelId || undefined,
      prazo: prazo || undefined,
    });
    // Reset
    setTipo('');
    setDescricao('');
    setResponsavelId(defaultResponsavelId);
    setPrazo('');
    setPrazoError(null);
  };

  const handleClose = () => {
    setTipo('');
    setDescricao('');
    setResponsavelId(defaultResponsavelId);
    setPrazo('');
    setPrazoError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Target className="w-5 h-5 text-primary" />
            Definir próxima ação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {TIPOS_ACAO.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva o que precisa ser feito..."
              className="min-h-[80px] rounded-[4px]"
            />
          </div>

          {/* Responsável */}
          {closers.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">
                Responsável
              </Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="rounded-[4px]">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent className="rounded-[4px]">
                  {closers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Prazo */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Prazo
            </Label>
            <Input
              type="date"
              value={prazo}
              onChange={e => {
                setPrazo(e.target.value);
                validatePrazo(e.target.value);
              }}
              className="rounded-[4px] text-sm"
            />
            {prazoError && (
              <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                <AlertTriangle className="w-3 h-3" />
                {prazoError}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-[4px] h-[30px] text-xs"
          >
            Pular
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-[4px] h-[30px] text-xs gap-1.5"
          >
            <Target className="w-3.5 h-3.5" />
            {isLoading ? 'Salvando...' : 'Salvar ação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProximaAcaoModal;
