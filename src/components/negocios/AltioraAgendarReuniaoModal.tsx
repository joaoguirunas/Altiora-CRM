/**
 * ALTIORA-13 — AltioraAgendarReuniaoModal
 *
 * Modal para agendar/reagendar R1, R2 ou R3 com integração Google Calendar.
 *
 * AC1: Botão "Agendar R1/R2/R3" → modal com: Data/hora, Duração, Participantes.
 *      Cria evento no Google Calendar do Closer + Google Meet automático.
 * AC3: Detecta conflito de horário no banco local e exibe aviso.
 * AC4: Botão "Reagendar" pré-preenche modal e faz PATCH do evento.
 * AC5: O link do Meet é sempre gerado pelo Google Calendar — não há campo manual.
 * AC6: Registra interação em `altiora_lead_interactions`.
 */

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Check,
  ChevronDown,
  Plus,
  X,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAltioraClosers, useAltioraInternalUsers, type AltioraCloser } from '@/hooks/useAltioraClosers';
import {
  type AltioraMeetingType,
  type AltioraMeeting,
  useCreateAltioraMeeting,
  useUpdateAltioraMeeting,
  useCheckAltioraConflict,
  useMeetingCollaborators,
  useMeetingGuests,
} from '@/hooks/useAltioraMeetings';
import ConvidadosEmailField from '@/components/reunioes/ConvidadosEmailField';
import { buildInvitePreview } from '@/lib/invitePreview';
import { ALTIORA_REUNIAO_NOME } from '@/constants/altioraReunioes';

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

// Mesmo nome que o cliente vê no título do convite — ver
// src/constants/altioraReunioes.ts.
const TIPO_LABELS: Record<AltioraMeetingType, string> = ALTIORA_REUNIAO_NOME;

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

  // ── ALTIORA-27: Super Admin escolhe organizador livremente ────────────────
  const { user } = useAuth();
  const isSuperAdmin = user?.profile?.super_adm === true;
  const currentUserId = user?.profile?.id;

  const { data: closers = [] } = useAltioraClosers();
  const { data: internalUsers = [] } = useAltioraInternalUsers({ enabled: isSuperAdmin });

  // Fonte de dados do multi-select de colaboradores: Closer comum só vê
  // outros Closers; Super Admin vê todos os usuários internos ativos.
  const collaboratorSource: AltioraCloser[] = isSuperAdmin ? internalUsers : closers;

  const { data: existingCollaborators = [] } = useMeetingCollaborators(meetingToEdit?.id);
  const { data: existingGuests = [] } = useMeetingGuests(meetingToEdit?.id);

  // ── Form state ────────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<AltioraMeetingType>(
    meetingToEdit?.altiora_tipo ?? tipoInicial,
  );
  // Organizador — só editável para Super Admin criando reunião nova (AC2).
  // Reagendamento não altera organizador (AC5); Closer comum nunca escolhe.
  const [organizerId, setOrganizerId] = useState<string>(
    meetingToEdit?.user_id ?? currentUserId ?? closerId,
  );
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  /** Convidados externos por e-mail — ver ConvidadosEmailField. */
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [collaboratorsPopoverOpen, setCollaboratorsPopoverOpen] = useState(false);
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
  // Convite: o texto do template fica pré-preenchido e o closer pode ajustar.
  // Enquanto ele não editar (`*Dirty` false), os campos acompanham as mudanças
  // do formulário (tipo, duração, colaboradores, observações) e nada é salvo —
  // o servidor continua montando o convite pelo template. Ao editar, o texto
  // dele é gravado em `meetings.invite_title` / `invite_description` e passa a
  // valer sobre o template.
  const [inviteTitle, setInviteTitle] = useState('');
  const [inviteBody, setInviteBody] = useState('');
  const [inviteTitleDirty, setInviteTitleDirty] = useState(false);
  const [inviteBodyDirty, setInviteBodyDirty] = useState(false);
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
      // Reagendamento de reunião que já tinha convite customizado reabre com o
      // texto salvo (e já "sujo", para não ser sobrescrito pelo template).
      const savedTitle = meetingToEdit?.invite_title?.trim() ?? '';
      const savedBody  = meetingToEdit?.invite_description?.trim() ?? '';
      setInviteTitle(savedTitle);
      setInviteBody(savedBody);
      setInviteTitleDirty(!!savedTitle);
      setInviteBodyDirty(!!savedBody);
      setForceConflict(false);
      setConflict(null);
      // ALTIORA-27: reset organizador/colaboradores
      setOrganizerId(meetingToEdit?.user_id ?? currentUserId ?? closerId);
      setCollaboratorsPopoverOpen(false);
      if (!meetingToEdit) {
        setCollaboratorIds([]);
        setGuestEmails([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meetingToEdit, tipoInicial]);

  // Carrega colaboradores existentes ao editar (AC5)
  useEffect(() => {
    if (open && meetingToEdit) {
      setCollaboratorIds(existingCollaborators.map(c => c.user_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meetingToEdit?.id, existingCollaborators]);

  // Idem para os convidados externos já salvos.
  useEffect(() => {
    if (open && meetingToEdit) {
      setGuestEmails(existingGuests.map(g => g.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meetingToEdit?.id, existingGuests]);

  // Organizador efetivo: Closer comum e reagendamento nunca escolhem —
  // organizador é sempre o closerId da ficha (ou o organizador já salvo).
  const effectiveOrganizerId = isEditing
    ? (meetingToEdit?.user_id ?? closerId)
    : (isSuperAdmin ? organizerId : closerId);

  const availableCollaborators = useMemo(
    () => collaboratorSource.filter(u => u.id !== effectiveOrganizerId),
    [collaboratorSource, effectiveOrganizerId],
  );

  const selectedCollaborators = useMemo(
    () => collaboratorSource.filter(u => collaboratorIds.includes(u.id)),
    [collaboratorSource, collaboratorIds],
  );

  // Quem já recebe o convite por outra via. Digitar um destes no campo de
  // e-mail não adiciona nada — o campo avisa em vez de criar duplicata (que o
  // índice único do banco recusaria, e o Google deduplicaria de todo modo).
  const alreadyInvitedEmails = useMemo(() => {
    const organizer = collaboratorSource.find(u => u.id === effectiveOrganizerId);
    return [
      clientEmail,
      organizer?.email,
      ...selectedCollaborators.map(u => u.email),
    ].filter((e): e is string => !!e);
  }, [clientEmail, collaboratorSource, effectiveOrganizerId, selectedCollaborators]);

  const totalParticipantes = selectedCollaborators.length + guestEmails.length;

  // ── Convite (título + corpo do e-mail) ────────────────────────────────────
  // Mesmo builder usado pela edge function (ver src/lib/invitePreview.ts), para
  // que o texto exibido aqui seja o mesmo que o cliente recebe.
  const organizerUser = useMemo(
    () => collaboratorSource.find(u => u.id === effectiveOrganizerId),
    [collaboratorSource, effectiveOrganizerId],
  );

  const invitePreview = useMemo(
    () => buildInvitePreview({
      tipo,
      clientName,
      durationMinutes: duracao,
      consultorNome: organizerUser?.name ?? meetingToEdit?.settings_users?.name ?? null,
      consultorTelefone: organizerUser?.whatsapp ?? null,
      notes,
      colaboradores: selectedCollaborators.map(u => ({ nome: u.name })),
    }),
    [tipo, clientName, duracao, organizerUser, meetingToEdit, notes, selectedCollaborators],
  );

  // Campos não editados seguem o template; os editados ficam intocados.
  useEffect(() => {
    if (!inviteTitleDirty) setInviteTitle(invitePreview.title);
    if (!inviteBodyDirty) setInviteBody(invitePreview.description);
  }, [invitePreview, inviteTitleDirty, inviteBodyDirty]);

  const restaurarConvitePadrao = () => {
    setInviteTitleDirty(false);
    setInviteBodyDirty(false);
    setInviteTitle(invitePreview.title);
    setInviteBody(invitePreview.description);
  };

  const inviteCustomizado = inviteTitleDirty || inviteBodyDirty;

  // Reunião Extra não tem nome fixo no playbook: o título do convite é o nome
  // dela, então é sempre gravado (mesmo sem edição) e não pode ficar vazio.
  const isExtra = tipo === 'EXTRA';

  const toggleCollaborator = (id: string) => {
    setCollaboratorIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  };

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
    // ALTIORA-27: conflito é checado contra o organizador efetivo — quando
    // Super Admin escolhe outro usuário, o conflito passa a ser dele.
    if (!forceConflict) {
      const conflictResult = await checkConflict.mutateAsync({
        userId: effectiveOrganizerId,
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
          collaboratorIds,
          // Lista completa: o hook faz o diff (remove quem saiu do campo).
          guests: guestEmails.map(email => ({ email })),
          // Só grava override do que foi realmente editado — o resto continua
          // sendo montado pelo template no servidor.
          inviteTitle: inviteTitleDirty || isExtra ? inviteTitle : null,
          inviteDescription: inviteBodyDirty ? inviteBody : null,
          title: isExtra ? inviteTitle : undefined,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(
        {
          leadId,
          peopleId,
          closerId: effectiveOrganizerId,
          tipo,
          startTime: computedTimes.startTime,
          endTime: computedTimes.endTime,
          duracaoMinutos: duracao,
          notes: notes || undefined,
          clientEmail: clientEmail ?? undefined,
          collaboratorIds: collaboratorIds.length ? collaboratorIds : undefined,
          guests: guestEmails.length ? guestEmails.map(email => ({ email })) : undefined,
          inviteTitle: inviteTitleDirty || isExtra ? inviteTitle : undefined,
          inviteDescription: inviteBodyDirty ? inviteBody : undefined,
          title: isExtra ? inviteTitle : undefined,
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
            {isEditing ? `Reagendar ${TIPO_LABELS[tipo]}` : 'Agendar Reunião'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
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

          {/* Organizador — ALTIORA-27: só Super Admin escolhe, e só ao criar */}
          {isSuperAdmin && !isEditing && (
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Organizador</Label>
              <Select value={organizerId} onValueChange={setOrganizerId}>
                <SelectTrigger className="h-9 text-[13px] rounded-[4px]">
                  <SelectValue placeholder="Selecionar organizador" />
                </SelectTrigger>
                <SelectContent>
                  {internalUsers.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-[13px]">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/50">
                Quem organiza a reunião (dono do evento no Google Calendar). Padrão: você mesmo.
              </p>
            </div>
          )}

          {isSuperAdmin && isEditing && (
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Organizador</Label>
              <div className="text-[13px] text-foreground bg-muted/30 border border-border rounded-[4px] px-3 py-2">
                {meetingToEdit?.settings_users?.name ?? 'Organizador atual'}
                <span className="text-[11px] text-muted-foreground/50">
                  {' '}— não é possível trocar o organizador ao reagendar
                </span>
              </div>
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

          {/* Adicionar participantes — um único dropdown, sempre visível: em
              cima os colegas do time (co-hosts), embaixo o campo de e-mail para
              quem é de fora. Os chips ficam fora do popover para continuarem
              visíveis com ele fechado. */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Adicionar participantes
            </Label>

            <Popover open={collaboratorsPopoverOpen} onOpenChange={setCollaboratorsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={collaboratorsPopoverOpen}
                  className="w-full justify-between h-9 text-[13px] font-normal rounded-[4px]"
                >
                  <span className="text-muted-foreground/60 truncate flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    {totalParticipantes > 0
                      ? `${totalParticipantes} adicionado${totalParticipantes > 1 ? 's' : ''}`
                      : 'Adicionar participantes'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar colega..." className="h-9 text-[13px]" />
                  <CommandList className="max-h-56">
                    <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                    <CommandGroup heading="Colegas do time">
                      {availableCollaborators.map(u => (
                        <CommandItem
                          key={u.id}
                          value={u.name}
                          onSelect={() => toggleCollaborator(u.id)}
                          className="text-[13px] cursor-pointer"
                        >
                          <Check
                            className={cn(
                              'mr-2 h-3.5 w-3.5',
                              collaboratorIds.includes(u.id) ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{u.name}</span>
                            {u.email && (
                              <span className="text-[11px] text-muted-foreground/50">{u.email}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>

                {/* Convidados de fora — não são co-hosts, só participantes. */}
                <div className="border-t border-border p-2">
                  <ConvidadosEmailField
                    value={guestEmails}
                    onChange={setGuestEmails}
                    alreadyInvited={alreadyInvitedEmails}
                    label="Adicionar por e-mail"
                    showChips={false}
                    hint="Enter ou vírgula para adicionar. Recebem só o convite do calendário."
                  />
                </div>
              </PopoverContent>
            </Popover>

            {(selectedCollaborators.length > 0 || guestEmails.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedCollaborators.map(u => (
                  <Badge
                    key={u.id}
                    variant="outline"
                    className="text-[11px] gap-1 pl-2 pr-1 py-0.5 rounded-[3px] font-normal max-w-full"
                  >
                    <span className="truncate">{u.name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCollaborator(u.id)}
                      className="hover:text-destructive flex-shrink-0"
                      aria-label={`Remover ${u.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {guestEmails.map(email => (
                  <Badge
                    key={email.toLowerCase()}
                    variant="outline"
                    className="text-[11px] gap-1 pl-2 pr-1 py-0.5 rounded-[3px] font-normal max-w-full"
                  >
                    <span className="truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setGuestEmails(prev =>
                          prev.filter(e => e.toLowerCase() !== email.toLowerCase()),
                        )
                      }
                      className="hover:text-destructive flex-shrink-0"
                      aria-label={`Remover ${email}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

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

          {/* Convite — o que o cliente recebe por e-mail. Vem pronto pelo
              template; editar substitui o texto do servidor. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[12px] text-muted-foreground">
                {isExtra ? 'Título da reunião (convite)' : 'Título do e-mail (convite)'}
              </Label>
              {inviteCustomizado && (
                <button
                  type="button"
                  onClick={restaurarConvitePadrao}
                  className="text-[11px] text-muted-foreground/60 hover:text-foreground underline underline-offset-2"
                >
                  Restaurar padrão
                </button>
              )}
            </div>
            <Input
              value={inviteTitle}
              onChange={e => { setInviteTitle(e.target.value); setInviteTitleDirty(true); }}
              className="h-9 text-[13px] rounded-[4px]"
            />
            {isExtra && (
              <p className="text-[11px] text-muted-foreground/50">
                É este título que o cliente vê no convite e que identifica a reunião na aba Reuniões.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Corpo do e-mail (convite)</Label>
            <Textarea
              value={inviteBody}
              onChange={e => { setInviteBody(e.target.value); setInviteBodyDirty(true); }}
              className="text-[13px] rounded-[4px] min-h-[160px]"
            />
            <p className="text-[11px] text-muted-foreground/50">
              {inviteCustomizado
                ? 'Convite personalizado — este texto substitui o modelo padrão.'
                : 'Preenchido pelo modelo padrão. Edite apenas se precisar de um texto diferente.'}
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
            disabled={isPending || !selectedDate || !startHour || (isExtra && !inviteTitle.trim())}
            className="text-[13px] rounded-[4px]"
          >
            {isPending
              ? 'Salvando...'
              : isEditing
              ? `Reagendar ${TIPO_LABELS[tipo]}`
              : `Agendar ${TIPO_LABELS[tipo]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
