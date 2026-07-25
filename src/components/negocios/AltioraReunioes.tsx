/**
 * ALTIORA-13 — AltioraReunioes
 *
 * Componente de reuniões R1/R2/R3 para a ficha do referral Altiora.
 * Mostra cards separados por tipo de reunião com botões de agendar/reagendar/cancelar.
 *
 * AC1: Botão "Agendar R1/R2/R3" abre AltioraAgendarReuniaoModal.
 * AC2: Link do Meet salvo em meeting_link após criação via GCal.
 * AC4: Botão "Reagendar" pré-preenche o modal com dados da reunião existente.
 * AC5: Fallback manual no modal quando GCal não configurado.
 * AC6: Registra interação em altiora_lead_interactions.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Calendar,
  Video,
  Clock,
  RefreshCw,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  type AltioraMeetingType,
  type AltioraMeeting,
  useAltioraMeetings,
  useCancelAltioraMeeting,
} from '@/hooks/useAltioraMeetings';
import { AltioraAgendarReuniaoModal } from './AltioraAgendarReuniaoModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS: AltioraMeetingType[] = ['R1', 'R2', 'R3'];

const TIPO_CONFIG: Record<AltioraMeetingType, { label: string; color: string; bgColor: string }> = {
  R1: { label: 'R1 — Diagnóstico',      color: '#3B82F6', bgColor: 'bg-[#3B82F6]/10' },
  R2: { label: 'R2 — Proposta',          color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10' },
  R3: { label: 'R3 — Fechamento',        color: '#10B981', bgColor: 'bg-[#10B981]/10' },
};

const STATUS_BADGE: Record<string, string> = {
  agendado:    'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20',
  agendada:    'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20',
  cancelada:   'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
  cancelado:   'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20',
  compareceu:  'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20',
  realizada:   'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20',
};

const STATUS_LABEL: Record<string, string> = {
  agendado:   'Agendada',
  agendada:   'Agendada',
  cancelada:  'Cancelada',
  cancelado:  'Cancelado',
  compareceu: 'Realizada',
  realizada:  'Realizada',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface AltioraReunioesProps {
  leadId: string;
  closerId: string;
  peopleId?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
  /** Se true, Closer pode agendar */
  canSchedule?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MeetingCardProps {
  meeting: AltioraMeeting;
  tipo: AltioraMeetingType;
  leadId: string;
  onReschedule: (meeting: AltioraMeeting) => void;
  onCancel: (meeting: AltioraMeeting) => void;
  canSchedule: boolean;
}

const MeetingCard = ({ meeting, tipo, onReschedule, onCancel, canSchedule }: MeetingCardProps) => {
  const startDate = new Date(meeting.start_time);
  const endDate   = new Date(meeting.end_time);
  const status    = (meeting.status ?? 'agendado').toLowerCase();
  const isCancelled = status === 'cancelada' || status === 'cancelado';
  const isCompleted = status === 'compareceu' || status === 'realizada';

  const badgeClass  = STATUS_BADGE[status] ?? 'text-muted-foreground bg-muted border-border';
  const statusLabel = STATUS_LABEL[status] ?? meeting.status;

  return (
    <div className={cn(
      'border border-border rounded-[4px] bg-card p-3 space-y-2',
      isCancelled && 'opacity-60',
    )}>
      {/* Header: data + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
          <span className="text-[13px] font-medium">
            {format(startDate, "dd 'de' MMM", { locale: ptBR })}
          </span>
          <span className="text-[12px] text-muted-foreground/60">
            {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
          </span>
        </div>
        <span className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium border leading-none',
          badgeClass,
        )}>
          {statusLabel}
        </span>
      </div>

      {/* Duração */}
      {meeting.altiora_duracao_minutos && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60">
          <Clock className="w-3 h-3" />
          <span>{meeting.altiora_duracao_minutos} min</span>
          {meeting.settings_users && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span>{meeting.settings_users.name}</span>
            </>
          )}
        </div>
      )}

      {/* Link do Meet */}
      {meeting.meeting_link && (
        <a
          href={meeting.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] text-[#3B82F6] hover:underline"
        >
          <Video className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">Abrir Google Meet</span>
          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
        </a>
      )}

      {/* Ações */}
      {canSchedule && !isCancelled && !isCompleted && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReschedule(meeting)}
            className="h-7 px-2.5 text-[11px] gap-1.5 rounded-[3px]"
          >
            <RefreshCw className="w-3 h-3" />
            Reagendar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(meeting)}
            className="h-7 px-2.5 text-[11px] gap-1.5 rounded-[3px] text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const AltioraReunioes = ({
  leadId,
  closerId,
  peopleId,
  clientEmail,
  clientName,
  canSchedule = true,
}: AltioraReunioesProps) => {
  const { data: meetings = [], isLoading } = useAltioraMeetings(leadId);
  const cancelMutation = useCancelAltioraMeeting();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<AltioraMeetingType>('R1');
  const [meetingToEdit, setMeetingToEdit] = useState<AltioraMeeting | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<AltioraMeeting | undefined>(undefined);

  const openScheduleModal = (tipo: AltioraMeetingType) => {
    setSelectedTipo(tipo);
    setMeetingToEdit(undefined);
    setModalOpen(true);
  };

  const openRescheduleModal = (meeting: AltioraMeeting) => {
    setSelectedTipo(meeting.altiora_tipo!);
    setMeetingToEdit(meeting);
    setModalOpen(true);
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    cancelMutation.mutate({
      meetingId: cancelTarget.id,
      leadId,
      tipo: cancelTarget.altiora_tipo!,
    });
    setCancelTarget(undefined);
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-[4px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Reuniões Altiora
        </p>
      </div>

      {/* Cards por tipo */}
      {TIPOS.map(tipo => {
        const config     = TIPO_CONFIG[tipo];
        const tipoMeets  = meetings.filter(m => m.altiora_tipo === tipo);
        const latestMeet = tipoMeets.sort(
          (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        )[0];
        const hasScheduled = tipoMeets.some(
          m => m.status !== 'cancelada' && m.status !== 'cancelado',
        );

        return (
          <div key={tipo} className="space-y-2">
            {/* Tipo header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-[12px] font-medium text-foreground">{config.label}</span>
                {hasScheduled && (
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] px-1.5 py-0 h-4 rounded-[2px] border-0', config.bgColor)}
                    style={{ color: config.color }}
                  >
                    Agendada
                  </Badge>
                )}
              </div>

              {canSchedule && !hasScheduled && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openScheduleModal(tipo)}
                  className="h-7 px-2.5 text-[11px] gap-1.5 rounded-[3px]"
                >
                  <Plus className="w-3 h-3" />
                  Agendar {tipo}
                </Button>
              )}
            </div>

            {/* Meeting card ou empty state */}
            {latestMeet ? (
              <MeetingCard
                meeting={latestMeet}
                tipo={tipo}
                leadId={leadId}
                onReschedule={openRescheduleModal}
                onCancel={m => setCancelTarget(m)}
                canSchedule={canSchedule}
              />
            ) : (
              <div className="border border-dashed border-border/40 rounded-[4px] py-4 text-center">
                <p className="text-[12px] text-muted-foreground/40">
                  {tipo} ainda não agendada
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal de agendamento / reagendamento */}
      <AltioraAgendarReuniaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        leadId={leadId}
        closerId={closerId}
        peopleId={peopleId}
        clientEmail={clientEmail}
        clientName={clientName}
        tipoInicial={selectedTipo}
        meetingToEdit={meetingToEdit}
      />

      {/* Diálogo de confirmação de cancelamento */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              A {cancelTarget?.altiora_tipo} agendada para{' '}
              {cancelTarget && format(new Date(cancelTarget.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}{' '}
              será cancelada e o evento será removido do Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar reunião
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
