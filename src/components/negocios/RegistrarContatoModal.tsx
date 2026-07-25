/**
 * ALTIORA-11 AC1-AC2: Modal de registro de primeiro contato Altiora.
 *
 * Campos: data/hora do contato, canal, resposta do cliente, resultado (textarea).
 * Validação AC2: data de contato anterior à data de handoff gera erro inline.
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
import { Phone, AlertTriangle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContatoFormData {
  dataContato: string;
  canal: string;
  resposta: string;
  resultado: string;
}

interface RegistrarContatoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ContatoFormData) => void;
  isLoading?: boolean;
  /** ISO date — data de handoff do referral (AC2: contato não pode ser anterior) */
  altioraDataHandoff?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CANAIS = ['WhatsApp', 'Ligação', 'E-mail'];
const RESPOSTAS = ['Respondeu', 'Não respondeu', 'Número errado'];

// ── Component ─────────────────────────────────────────────────────────────────

const RegistrarContatoModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  altioraDataHandoff,
}: RegistrarContatoModalProps) => {
  const nowLocal = new Date();
  nowLocal.setSeconds(0, 0);
  const defaultDateTime = nowLocal.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"

  const [dataContato, setDataContato] = useState(defaultDateTime);
  const [canal, setCanal] = useState('');
  const [resposta, setResposta] = useState('');
  const [resultado, setResultado] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // AC2: validação de data anterior ao handoff
  const validateDate = (value: string) => {
    if (!altioraDataHandoff) {
      setDateError(null);
      return true;
    }
    const contato  = new Date(value);
    const handoff  = new Date(altioraDataHandoff);
    // Comparar só a data (ignorar horário) para permitir contato no mesmo dia do handoff
    const contatoDay = new Date(contato.getFullYear(), contato.getMonth(), contato.getDate());
    const handoffDay = new Date(handoff.getFullYear(), handoff.getMonth(), handoff.getDate());
    if (contatoDay < handoffDay) {
      setDateError('Data anterior ao recebimento do referral');
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleDateChange = (value: string) => {
    setDataContato(value);
    validateDate(value);
  };

  const canConfirm = canal && resposta && !dateError && !isLoading;

  const handleConfirm = () => {
    if (!canConfirm) return;
    if (!validateDate(dataContato)) return;
    onConfirm({ dataContato, canal, resposta, resultado });
    // Reset
    setDataContato(defaultDateTime);
    setCanal('');
    setResposta('');
    setResultado('');
    setDateError(null);
  };

  const handleClose = () => {
    setDataContato(defaultDateTime);
    setCanal('');
    setResposta('');
    setResultado('');
    setDateError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Phone className="w-5 h-5 text-primary" />
            Registrar contato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Data/hora do contato */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Data / hora do contato <span className="text-destructive">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={dataContato}
              onChange={e => handleDateChange(e.target.value)}
              className="rounded-[4px] text-sm"
            />
            {dateError && (
              <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                <AlertTriangle className="w-3 h-3" />
                {dateError}
              </p>
            )}
          </div>

          {/* Canal */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Canal <span className="text-destructive">*</span>
            </Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {CANAIS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resposta do cliente */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Resposta do cliente <span className="text-destructive">*</span>
            </Label>
            <Select value={resposta} onValueChange={setResposta}>
              <SelectTrigger className="rounded-[4px]">
                <SelectValue placeholder="Selecione a resposta" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {RESPOSTAS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resultado (opcional) */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Resultado / observações
            </Label>
            <Textarea
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              placeholder="Descreva o resultado do contato..."
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
            disabled={!canConfirm}
            className="rounded-[4px] h-[30px] text-xs gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" />
            {isLoading ? 'Salvando...' : 'Registrar contato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarContatoModal;
