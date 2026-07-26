/**
 * ALTIORA-13 — AltioraAgendarReuniaoModal
 *
 * Modal para agendar/reagendar R1, R2 ou R3 com integração Google Calendar.
 *
 * AC1: Botão "Agendar R1/R2/R3" → modal com: Data/hora, Duração, Participantes.
 *      Cria evento no Google Calendar do Closer + Google Meet automático.
 * AC3: Detecta conflito de horário no banco local e exibe aviso.
 * AC4: Botão "Reagendar" pré-preenche modal e faz PATCH do evento.
 * AC5: Fallback manual quando GCal não configurado — Closer insere link manualmente.
 * AC6: Registra interação em `altiora_lead_interactions`.
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Link as LinkIcon,
  Video,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  type AltioraMeetingType,
  type AltioraMeeting,
  useCreateAltioraMeeting,
  useUpdateAltioraMeeting,
  useCheckAltioraConflict,
} from '@/hooks/useAltioraMeetings';

// ── Constants ─────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1h' },
  { value: 90,  label: '1h30' },
  { value: 120, label: '2h' },
];

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30; // 08:00 a 21:30 de 30 em 30
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

const TIPO_LABELS: Record<AltioraMeetingType, string> = {
  R1: 'R1 — Reunião de Diagnóstico',
  R2: 'R2 — Apresentação de Proposta',
  R3: 'R3 — Fechamento',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface AltioraAgendarReuniaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  closerId: string;
  peopleId?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
  /** Tipo pré-selecionado (ex: "R1") */
  tipoInicial?: AltioraMeetingType;
  /** Se fornecido, modo reagendamento */
  meetingToEdit?: AltioraMeeting;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AltioraAgendarReuniaoModal = ({
  open,
  onOpenChange,
  leadId,
  closerId,
  peopleId,
  clientEmail,
  clientName,
  tipoInicial = 'R1',
  meetingToEdit,
}: AltioraAgendarReuniaoModalProps) => {
  const isEditing = !!meetingToEdit;

  // ── Form state ────────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<AltioraMeetingType>(
    meetingToEdit?.altiora_tipo ?? tipoInicial,
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    meetingToEdit ? new Date(meetingToEdit.start_time) : undefined,
  );
  const [startHour, setStartHour] = useState<string>(() => {
    if (meetingToEdit) {
      const d = new Date(meetingToEdit.start_time);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return '10:00';
  });
  const [duracao, setDuracao] = useState<number>(
    meetingToEdit?.altiora_duracao_minutos ?? 60,
  );
  const [notes, setNotes] = useState(meetingToEdit?.notes ?? '');
  const [manualLink, setManualLink] = useState(meetingToEdit?.meeting_link ?? '');
  const [forceConflict, setForceConflict] = useState(false);
  const [conflict, setConflict] = useState<{ hasConflict: boolean; slots: Array<{ start: string; end: string }> } | null>(null);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      setTipo(meetingToEdit?.altiora_tipo ?? tipoInicial);
      setSelectedDate(meetingToEdit ? new Date(meetingToEdit.start_time) : undefined);
      setStartHour(() => {
        if (meetingToEdit) {
          const d = new Date(meetingToEdit.start_time);
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return '10:00';
      });
      setDuracao(meetingToEdit?.altiora_duracao_minutos ?? 60);
      setNotes(meetingToEdit?.notes ?? '');
      setManualLink(meetingToEdit?.meeting_link ?? '');
      setForceConflict(false);
      setConflict(null);
    }
  }, [open, meetingToEdit, tipoInicial]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateAltioraMeeting();
  const updateMutation = useUpdateAltioraMeeting();
  const checkConflict  = useCheckAltioraConflict();

  const isPending = createMutation.isPending || updateMutation.isPending || checkConflict.isPending;

  // ── Computed times ────────────────────────────────────────────────────────
  const computedTimes = (() => {
    if (!selectedDate || !startHour) return null;
    const [h, m] = startHour.split(':').map(Number);
    const start = new Date(selectedDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + duracao * 60 * 1000);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  })();

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!computedTimes) return;

    // Verificar conflito (exceto se usuário forçou)
    if (!forceConflict) {
      const conflictResult = await checkConflict.mutateAsync({
        userId: closerId,
        startTime: computedTimes.startTime,
        endTime: computedTimes.endTime,
        excludeMeetingId: meetingToEdit?.id,
      });

      if (conflictResult.hasConflict) {
        setConflict({ hasConflict: true, slots: conflictResult.conflictingSlots });
        return; // Bloquear até usuário confirmar force
      }
    }

    if (isEditing && meetingToEdit) {
      updateMutation.mutate(
        {
          meetingId: meetingToEdit.id,
          leadId,
          tipo,
          startTime: computedTimes.startTime,
          endTime: computedTimes.endTime,
          duracaoMinutos: duracao,
          notes: notes || undefined,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(
        {
          leadId,
          peopleId,
          closerId,
          tipo,
          startTime: computedTimes.startTime,
          endTime: computedTimes.endTime,
          duracaoMinutos: duracao,
          notes: notes || undefined,
          meetingLink: manualLink || undefined,
          clientEmail: clientEmail ?? undefined,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">
            {isEditing ? `Reagendar ${tipo}` : 'Agendar Reunião'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de reunião */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Tipo de reunião</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as AltioraMeetingType)}>
                <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIPO_LABELS) as [AltioraMeetingType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-[13px]">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Data */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-[13px] h-9 rounded-[4px]',
                    !selectedDate && 'text-muted-foreground/60',
                  )}
                >
                  <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground/50" />
                  {selectedDate
                    ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarUI
                  mode="single"
                  selected={selectedDate}
                  onSelect={date => { setSelectedDate(date); setConflict(null); }}
                  disabled={d => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Horário + Duração */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Horário de início</Label>
              <Select value={startHour} onValueChange={v => { setStartHour(v); setConflict(null); }}>
                <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                  <Clock className="mr-1.5 h-3.5 w-3.5 text-muted-foreground/50" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {TIME_SLOTS.map(t => (
                    <SelectItem key={t} value={t} className="text-[13px]">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Duração</Label>
              <Select value={String(duracao)} onValueChange={v => setDuracao(Number(v))}>
                <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)} className="text-[13px]">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Participantes (informativo) */}
          {clientEmail && (
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Participantes</Label>
              <div className="text-[13px] text-foreground bg-muted/30 border border-border rounded-[4px] px-3 py-2">
                {clientName && <span className="font-medium">{clientName}</span>}
                {clientEmail && <span className="text-muted-foreground/70"> — {clientEmail}</span>}
                {' '}
                <span className="text-[11px] text-muted-foreground/50">(convite enviado automaticamente)</span>
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Pauta, contexto da reunião..."
              className="text-[13px] rounded-[4px] min-h-[72px] resize-none"
            />
          </div>

          {/* Fallback manual — AC5 */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              Link do Meet (opcional — gerado automaticamente pelo Google Calendar)
            </Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
              <Input
                value={manualLink}
                onChange={e => setManualLink(e.target.value)}
                placeholder="https://meet.google.com/... (deixe em branco para gerar)"
                className="pl-9 h-9 text-[13px] rounded-[4px]"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Se o Google Calendar estiver conectado, o Meet é criado automaticamente.
              Insira apenas se precisar de um link externo.
            </p>
          </div>

          {/* Alerta de conflito — AC3 */}
          {conflict?.hasConflict && (
            <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-[13px]">
                <strong>Conflito de agenda detectado.</strong>{' '}
                Já existe {conflict.slots.length === 1 ? 'uma reunião' : `${conflict.slots.length} reuniões`} neste horário.
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConflict(null)}
                    className="h-7 text-[12px] rounded-[3px]"
                  >
                    Escolher outro horário
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setForceConflict(true); setConflict(null); }}
                    className="h-7 text-[12px] rounded-[3px]"
                  >
                    Confirmar mesmo assim
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Aviso de forçar conflito */}
          {forceConflict && !conflict?.hasConflict && (
            <Alert className="border-orange-500/30 bg-orange-500/5">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <AlertDescription className="text-[12px] text-orange-700">
                Agendando com conflito de horário confirmado.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-[13px] rounded-[4px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !selectedDate || !startHour}
            className="text-[13px] rounded-[4px]"
          >
            {isPending
              ? 'Salvando...'
              : isEditing
              ? `Reagendar ${tipo}`
              : `Agendar ${tipo}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
