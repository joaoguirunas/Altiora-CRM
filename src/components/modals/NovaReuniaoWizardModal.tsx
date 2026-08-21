import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  ArrowLeft, CalendarIcon, Check, Clock, User,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNegocios } from '@/hooks/useNegocios';
import { useConsultorDisponibilidade } from '@/hooks/useConsultorDisponibilidade';
import { useCriarAgendamento } from '@/hooks/useAgendamentos';
import { useAuth } from '@/hooks/useAuth';
import { isAltioraPipeline } from '@/utils/pipelineLabels';
import { ALTIORA_TIPOS, ALTIORA_REUNIAO_NOME, isAltioraTipoReuniao } from '@/constants/altioraReunioes';
import ConvidadosEmailField from '@/components/reunioes/ConvidadosEmailField';

type MeetingType = 'discovery' | 'demo' | 'closing' | 'consulting' | 'mentoring' | 'qbr' | 'followup' | 'other' | 'R1' | 'R2' | 'R3' | 'EXTRA';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface SelectedLead {
  id: string;
  clientName: string;
  value?: number;
  /** Negócio pertence ao pipeline Altiora — troca o tipo de reunião pra R1/R2/R3 */
  isAltiora?: boolean;
}

interface SelectedConsultor {
  id: string;
  nome: string;
  email?: string;
}

interface WizardState {
  step: Step;
  selectedLead: SelectedLead | null;
  /**
   * Consultores da reunião. O PRIMEIRO é o organizador: é o dono do evento no
   * Google Calendar (meetings.users_id) e é a agenda usada para calcular os
   * horários livres. Os demais entram em `meeting_collaborators` e são
   * convidados do evento — nunca donos. Ver ADR-ALTIORA-01.
   */
  selectedConsultores: SelectedConsultor[];
  /**
   * Convidados de fora do time, por e-mail (`meeting_guests`). Só participantes
   * do evento: não são organizador nem co-host e não têm conta no CRM.
   */
  guestEmails: string[];
  selectedDate: Date | undefined;
  selectedDuration: number;
  selectedTimeSlot: { start: string; end: string } | null;
  notes: string;
  location: string;
  meetingType: MeetingType | '';
}

const INITIAL_STATE: WizardState = {
  step: 1,
  selectedLead: null,
  selectedConsultores: [],
  guestEmails: [],
  selectedDate: undefined,
  selectedDuration: 60,
  selectedTimeSlot: null,
  notes: '',
  location: '',
  meetingType: 'discovery',
};

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: 'discovery',  label: 'Discovery Call' },
  { value: 'demo',       label: 'Demo / Pitch' },
  { value: 'closing',    label: 'Reunião de Fecho' },
  { value: 'consulting', label: 'Consultoria' },
  { value: 'mentoring',  label: 'Mentoria' },
  { value: 'qbr',        label: 'QBR' },
  { value: 'followup',   label: 'Follow-up' },
  { value: 'other',      label: 'Outro' },
];

// Pipeline Altiora usa a própria nomenclatura de reunião em vez da genérica.
// O rótulo é o mesmo nome que vai para o título do convite do cliente —
// ver src/constants/altioraReunioes.ts.
const ALTIORA_MEETING_TYPE_OPTIONS: { value: MeetingType; label: string }[] =
  ALTIORA_TIPOS.map(tipo => ({ value: tipo, label: ALTIORA_REUNIAO_NOME[tipo] }));

const DURATION_OPTIONS = [
  { value: 30, label: '30min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
];

const STEP_LABELS: Record<Step, string> = {
  1: 'Negócio',
  2: 'Consultores',
  3: 'Agenda',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  initialLead?: { id: string; clientName: string; value?: number };
}

const NovaReuniaoWizardModal = ({ open, onOpenChange, initialLead }: Props) => {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Closer (comercial/closer) e user padrão: auto-atribuem a si mesmos, pulam step 2
  const isUserType =
    user?.profile?.user_type === 'user' ||
    user?.profile?.user_type === 'comercial' ||
    user?.profile?.user_type === 'closer';

  useEffect(() => {
    if (open) {
      // Closer/comercial já entra com ele mesmo pré-selecionado como organizador,
      // mas continua vendo a etapa: pode adicionar mais consultores à reunião.
      const selfConsultor = isUserType && user?.profile
        ? [{ id: user.profile.id, nome: user.profile.nome, email: user.profile.email || undefined }]
        : [];
      setState({
        ...INITIAL_STATE,
        selectedLead: initialLead ?? null,
        step: initialLead ? 2 : 1,
        selectedConsultores: selfConsultor,
      });
      setSearchTerm('');
      setShowDetails(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data hooks ──────────────────────────────────────────────────────────────

  const { data: negocios = [], isLoading: isLoadingNegocios } = useNegocios();
  const criarAgendamento = useCriarAgendamento();

  // Consultores list — for manual mode
  const { data: consultores = [] } = useQuery({
    queryKey: ['consultores-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_users')
        .select('id, nome, email')
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('nome');
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.nome,
        email: item.email as string | null,
      })) as Array<{ id: string; name: string; email: string | null }>;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Horários livres: sempre a agenda do ORGANIZADOR (primeiro consultor), que é
  // quem vai ser dono do evento no Google Calendar. A disponibilidade dos
  // colaboradores adicionais não é cruzada aqui — limitação conhecida e
  // documentada no ADR-ALTIORA-01.
  const organizador = state.selectedConsultores[0] ?? null;
  const { data: consultorSlots = [] } = useConsultorDisponibilidade({
    consultorId: organizador?.id || '',
    date: state.selectedDate ? format(state.selectedDate, 'yyyy-MM-dd') : '',
    duration: state.selectedDuration,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const negociosAtivos = useMemo(
    () =>
      negocios.filter((n) => {
        const clientName = n.person?.name || n.pessoa?.nome || n.pessoa?.name || '';
        return (
          n.status === 'in_progress' &&
          (searchTerm === '' || clientName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }),
    [negocios, searchTerm],
  );

  // Slots for the selected date — sempre a agenda do organizador
  const slotsForSelectedDate = useMemo(() => {
    if (!state.selectedDate) return [];
    return consultorSlots
      .filter((s) => s.available)
      .map((s) => ({ start: s.start.slice(0, 5), end: s.end.slice(0, 5) }));
  }, [state.selectedDate, consultorSlots]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    if (state.step === 1) return !!state.selectedLead;
    if (state.step === 2) return state.selectedConsultores.length > 0;
    if (state.step === 3) return !!state.selectedTimeSlot?.start && !!state.selectedTimeSlot?.end;
    return false;
  };

  const handleNext = () => {
    if (!canAdvance()) {
      const msgs: Record<number, string> = {
        1: 'Selecione um negócio para continuar',
        2: 'Escolha o modo de distribuição para continuar',
        3: 'Selecione um horário para confirmar',
      };
      toast.error(msgs[state.step]);
      return;
    }
    setState((prev) => ({ ...prev, step: (prev.step + 1) as Step }));
  };

  const handleBack = () => {
    setState((prev) => ({ ...prev, step: (prev.step - 1) as Step }));
  };

  const handleClose = () => onOpenChange(false);

  const handleConfirm = async () => {
    if (!state.selectedLead || !state.selectedDate || !state.selectedTimeSlot) {
      toast.error('Dados incompletos');
      return;
    }

    const dateStr = format(state.selectedDate, 'yyyy-MM-dd');
    const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

    const [organizadorSel, ...colaboradores] = state.selectedConsultores;
    if (!organizadorSel) { toast.error('Selecione ao menos um consultor'); return; }

    try {
      const meetingPayload = {
        lead_id:    state.selectedLead.id,
        user_id:    organizadorSel.id,
        title:      `Reunião — ${state.selectedLead.clientName}`,
        date:       dateStr,
        start_time: normalizeTime(state.selectedTimeSlot.start),
        end_time:   normalizeTime(state.selectedTimeSlot.end),
        location:   state.location || undefined,
        notes:      state.notes || undefined,
        status:     'agendado',
        // Gravados dentro do hook, antes do evento ir pro Google Calendar, para
        // que organizador, cliente e colaboradores entrem no MESMO convite.
        collaboratorIds: colaboradores.map((c) => c.id),
        // Convidados externos — gravados na mesma janela, ver useAgendamentos.
        guestEmails: state.guestEmails,
        // R1/R2/R3 vira altiora_tipo no hook, que é o que faz o convite usar o
        // template do playbook em vez do texto genérico.
        meeting_type: state.meetingType || undefined,
      };
      await criarAgendamento.mutateAsync(meetingPayload);

      handleClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao confirmar reunião');
    }
  };

  // ── Step indicator ────────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const visibleSteps = [1, 2, 3] as Step[];
    const stepNumbers: Record<number, number> = { 1: 1, 2: 2, 3: 3 };

    return (
      <div className="flex items-center gap-1 mb-5">
        {visibleSteps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <div className="w-6 h-px bg-border" />}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors',
                  state.step === s
                    ? 'bg-primary text-primary-foreground'
                    : state.step > s
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {state.step > s ? <Check className="w-3 h-3" /> : stepNumbers[s]}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  state.step === s ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Step 1 — Negócio ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-3">
      <Input
        placeholder="Buscar por nome do cliente..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
        {isLoadingNegocios ? (
          <p className="text-center py-10 text-sm text-muted-foreground">Carregando negócios...</p>
        ) : negociosAtivos.length === 0 ? (
          <p className="text-center py-10 text-sm text-muted-foreground">
            {negocios.length === 0 ? 'Nenhum negócio cadastrado' : 'Nenhum resultado encontrado'}
          </p>
        ) : (
          negociosAtivos.map((negocio) => {
            const clientName =
              negocio.person?.name || negocio.pessoa?.nome || negocio.pessoa?.name || 'Cliente';
            const email = negocio.person?.email || negocio.pessoa?.email || '';
            const value = negocio.value || negocio.valor;
            const isSelected = state.selectedLead?.id === negocio.id;
            const isAltiora = isAltioraPipeline(negocio.pipeline?.name ?? negocio.pipeline?.nome ?? '');
            return (
              <button
                key={negocio.id}
                type="button"
                onClick={() =>
                  setState((prev) => {
                    const wasAltiora = isAltioraTipoReuniao(prev.meetingType);
                    // Altiora usa R1/R2/R3 — troca o default ao trocar de negócio, só quando
                    // o tipo atual não faz sentido pro pipeline recém-selecionado.
                    const meetingType = isAltiora
                      ? (wasAltiora ? prev.meetingType : 'R1')
                      : (wasAltiora ? 'discovery' : prev.meetingType);
                    return {
                      ...prev,
                      selectedLead: { id: negocio.id, clientName, value, isAltiora },
                      meetingType,
                    };
                  })
                }
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-[4px] border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{clientName}</p>
                    {email && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {value ? (
                      <span className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          maximumFractionDigits: 0,
                        }).format(value)}
                      </span>
                    ) : null}
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Step 2 — Distribuição ─────────────────────────────────────────────────────

  const renderStep2 = () => {
    const toggleConsultor = (c: { id: string; name: string; email: string | null }) =>
      setState((prev) => {
        const jaSelecionado = prev.selectedConsultores.some((sc) => sc.id === c.id);
        const selectedConsultores = jaSelecionado
          ? prev.selectedConsultores.filter((sc) => sc.id !== c.id)
          : [...prev.selectedConsultores, { id: c.id, nome: c.name, email: c.email || undefined }];
        // Trocar o organizador (posição 0) muda a agenda usada para os horários
        // livres — o slot já escolhido pode não valer mais.
        const organizadorMudou = (prev.selectedConsultores[0]?.id ?? null) !== (selectedConsultores[0]?.id ?? null);
        return organizadorMudou
          ? { ...prev, selectedConsultores, selectedTimeSlot: null }
          : { ...prev, selectedConsultores };
      });

    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Selecione um ou mais consultores. O primeiro é o organizador: a reunião
          entra na agenda dele e os horários livres são os dele.
        </p>

        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
          {consultores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum consultor ativo encontrado
            </p>
          ) : (
            consultores.map((c) => {
              const index = state.selectedConsultores.findIndex((sc) => sc.id === c.id);
              const isSelected = index >= 0;
              const isOrganizador = index === 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleConsultor(c)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-[4px] border flex items-center gap-3 transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.email && (
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    )}
                  </div>
                  {isOrganizador && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary shrink-0">
                      Organizador
                    </span>
                  )}
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Convidados de fora do time — o cliente e os consultores acima já
            entram no convite por outra via. */}
        <div className="pt-1 border-t border-border/60">
          <div className="pt-3">
            {/* `alreadyInvited` cobre só os consultores: o e-mail do cliente não
                está no estado do wizard (SelectedLead traz id/nome/valor). A edge
                function deduplica attendees por e-mail, então digitar o do
                cliente é inofensivo — só não é avisado aqui. */}
            <ConvidadosEmailField
              value={state.guestEmails}
              onChange={(guestEmails) => setState((prev) => ({ ...prev, guestEmails }))}
              alreadyInvited={state.selectedConsultores
                .map((c) => c.email)
                .filter((e): e is string => !!e)}
              label="Convidar por e-mail (fora do time)"
            />
          </div>
        </div>
      </div>
    );
  };

  // ── Step 3 — Agenda ───────────────────────────────────────────────────────────

  const renderStep3 = () => {
    const isLoadingSlots = false;

    const slotsByPeriod = {
      manha: slotsForSelectedDate.filter((s) => {
        const h = parseInt(s.start.split(':')[0]);
        return h >= 6 && h < 12;
      }),
      tarde: slotsForSelectedDate.filter((s) => {
        const h = parseInt(s.start.split(':')[0]);
        return h >= 12 && h < 18;
      }),
      noite: slotsForSelectedDate.filter((s) => {
        const h = parseInt(s.start.split(':')[0]);
        return h >= 18 && h < 24;
      }),
    };

    const periodLabels: Record<string, string> = {
      manha: 'Manhã',
      tarde: 'Tarde',
      noite: 'Noite',
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Duração</p>
            <div className="flex gap-1.5 flex-wrap">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      selectedDuration: opt.value,
                      selectedTimeSlot: null,
                    }))
                  }
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-[4px] border font-medium transition-colors',
                    state.selectedDuration === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <p className="text-xs font-medium text-muted-foreground mb-2">Data</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'w-full justify-start text-left font-normal text-xs h-8',
                !state.selectedDate && 'text-muted-foreground',
              )}
              onClick={() => setCalendarOpen((prev) => !prev)}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {state.selectedDate
                ? format(state.selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecionar data'}
            </Button>
            {calendarOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 rounded-[4px] border bg-popover shadow-md">
                <Calendar
                  mode="single"
                  selected={state.selectedDate}
                  onSelect={(date) => {
                    setState((prev) => ({ ...prev, selectedDate: date, selectedTimeSlot: null }));
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </div>
            )}
          </div>
        </div>

        {state.selectedDate && (
          <div className="space-y-3">
            {isLoadingSlots ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Carregando horários disponíveis...</p>
              </div>
            ) : (
              (() => {
                // Use calendar slots when available; otherwise generate slots from 08:00–20:00
                const displaySlots: Array<{ start: string; end: string }> = slotsForSelectedDate.length > 0
                  ? slotsForSelectedDate
                  : (() => {
                      const step = state.selectedDuration <= 30 ? 30 : 60;
                      const gen: Array<{ start: string; end: string }> = [];
                      for (let m = 8 * 60; m + state.selectedDuration <= 20 * 60; m += step) {
                        const sh = Math.floor(m / 60), sm = m % 60;
                        const em = m + state.selectedDuration;
                        const eh = Math.floor(em / 60), emm = em % 60;
                        gen.push({
                          start: `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`,
                          end:   `${String(eh).padStart(2,'0')}:${String(emm).padStart(2,'0')}`,
                        });
                      }
                      return gen;
                    })();

                const toH = (t: string) => parseInt(t.split(':')[0]);
                const periods = [
                  { key: 'manha', label: 'Manhã', slots: displaySlots.filter(s => toH(s.start) < 12) },
                  { key: 'tarde', label: 'Tarde', slots: displaySlots.filter(s => toH(s.start) >= 12 && toH(s.start) < 18) },
                  { key: 'noite', label: 'Noite', slots: displaySlots.filter(s => toH(s.start) >= 18) },
                ];

                return (
                  <div className="space-y-3">
                    {periods.map(({ key, label, slots }) =>
                      slots.length === 0 ? null : (
                        <div key={key}>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
                          <div className="grid grid-cols-5 gap-1.5">
                            {slots.map((slot, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setState((prev) => ({ ...prev, selectedTimeSlot: slot }))}
                                className={cn(
                                  'py-2 text-xs rounded-[4px] border font-medium text-center transition-colors',
                                  state.selectedTimeSlot?.start === slot.start
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card border-border hover:bg-muted text-foreground',
                                )}
                              >
                                {slot.start.slice(0, 5)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {!state.selectedDate && (
          <div className="text-center py-8 bg-muted rounded-[4px] border border-border border-dashed">
            <CalendarIcon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Selecione uma data para ver os horários disponíveis
            </p>
          </div>
        )}

        {/* Meeting type */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Tipo de Reunião</Label>
          <Select
            value={state.meetingType}
            onValueChange={(v) => setState((prev) => ({ ...prev, meetingType: v as MeetingType }))}
          >
            <SelectTrigger className="h-8 text-xs rounded-[4px]">
              <SelectValue placeholder="Selecionar tipo..." />
            </SelectTrigger>
            <SelectContent className="rounded-[4px]">
              {(state.selectedLead?.isAltiora ? ALTIORA_MEETING_TYPE_OPTIONS : MEETING_TYPE_OPTIONS).map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional details (collapsible) */}
        <div className="rounded-[4px] border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <span className="font-medium">Detalhes opcionais</span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', showDetails && 'rotate-180')}
            />
          </button>
          {showDetails && (
            <div className="px-3 pb-3 pt-3 space-y-3 border-t border-border">
              <div>
                <Label className="text-xs text-muted-foreground">Local</Label>
                <Input
                  placeholder="Ex.: Online, Escritório..."
                  value={state.location}
                  onChange={(e) => setState((prev) => ({ ...prev, location: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Input
                  placeholder="Observações sobre a reunião..."
                  value={state.notes}
                  onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Main ──────────────────────────────────────────────────────────────────────

  const isPending = criarAgendamento.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Nova reunião</DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="py-1">
          {state.step === 1 && renderStep1()}
          {state.step === 2 && renderStep2()}
          {state.step === 3 && renderStep3()}
        </div>

        {/* Compact context bar */}
        {(state.selectedLead || state.selectedConsultores.length > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground bg-muted border border-border rounded-[4px] px-3 py-2 mt-1">
            {state.selectedLead && (
              <span>
                <strong className="text-foreground font-medium">Cliente:</strong>{' '}
                {state.selectedLead.clientName}
              </span>
            )}
            {state.selectedConsultores.length > 0 && (
              <span>
                <strong className="text-foreground font-medium">
                  {state.selectedConsultores.length > 1 ? 'Consultores:' : 'Consultor:'}
                </strong>{' '}
                {state.selectedConsultores.map((c) => c.nome).join(', ')}
              </span>
            )}
            {state.selectedDate && (
              <span>
                <strong className="text-foreground font-medium">Data:</strong>{' '}
                {format(state.selectedDate, 'dd/MM')}
              </span>
            )}
            {state.selectedTimeSlot && (
              <span>
                <strong className="text-foreground font-medium">Horário:</strong>{' '}
                {state.selectedTimeSlot.start.slice(0, 5)}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t mt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs h-8">
            Cancelar
          </Button>
          <div className="flex gap-2">
            {state.step > 1 && !(initialLead && state.step === 2) && (
              <Button variant="outline" size="sm" onClick={handleBack} className="text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar
              </Button>
            )}
            {state.step < 3 ? (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canAdvance()}
                className="text-xs h-8"
              >
                Continuar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!canAdvance() || isPending}
                className="text-xs h-8"
              >
                {isPending ? 'Agendando...' : 'Confirmar reunião'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovaReuniaoWizardModal;
