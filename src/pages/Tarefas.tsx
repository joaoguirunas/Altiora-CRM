import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListChecks, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUsuariosDoTenant } from '@/hooks/useTimes';
import { useAgendamentosSimple, type AgendamentoSimple } from '@/hooks/useAgendamentosSimple';
import { useOverdueTaskCount, useUserTaskMutations, useUserTasks, type UserTask } from '@/hooks/useUserTasks';
import NovaTarefaModal from '@/components/tarefas/NovaTarefaModal';
import TimelineItemCard from '@/components/tarefas/TimelineItemCard';
import { KIND_STYLES, type TimelineItem } from '@/components/tarefas/types';

type ViewMode = 'dia' | 'semana';

/** YYYY-MM-DD no fuso local (mesma convenção de useAgendamentosSimple). */
const toISODate = (d: Date) => d.toLocaleDateString('sv');

const startOfWeekMon = (d: Date) => {
  const r = new Date(d);
  r.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
};

const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

/** Status de reunião que ainda aguarda o closer registrar o desfecho. */
const PENDING_MEETING_STATUS = new Set(['agendado', 'reagendado']);
const OVERDUE_GRACE_MS = 10 * 60 * 1000;

const meetingToItem = (m: AgendamentoSimple): TimelineItem => {
  const pessoa = m.negocio?.person?.nome ?? m.negocio?.pessoa?.name ?? null;
  const local = m.location || (m.google_meet_link ? 'Google Meet' : null);
  const isPending = PENDING_MEETING_STATUS.has(m.status ?? '');

  return {
    key: `meeting:${m.id}`,
    kind: 'reuniao',
    date: m.data ?? '',
    time: m.hora_inicio ? m.hora_inicio.slice(0, 5) : null,
    // Com quem é a reunião vem primeiro — o título do negócio raramente está
    // preenchido, então prioriza o nome da pessoa.
    title: pessoa || m.negocio?.titulo || 'Reunião',
    subtitle: [
      m.altiora_tipo ? `Reunião ${m.altiora_tipo}` : null,
      local,
    ].filter(Boolean).join(' · '),
    done: !isPending,
    needsStatusUpdate:
      isPending &&
      m.status !== 'bloqueio manual' &&
      !!m.end_time &&
      Date.now() - new Date(m.end_time).getTime() >= OVERDUE_GRACE_MS,
    meeting: m,
  };
};

const taskToItem = (t: UserTask): TimelineItem => ({
  key: `task:${t.id}`,
  kind: t.isFromTeam ? 'equipe' : 'propria',
  date: t.due_date,
  time: t.due_time,
  title: t.title,
  subtitle: t.isFromTeam ? 'Atribuída pela equipe' : 'Criada por você',
  done: t.done,
  needsStatusUpdate: false,
  task: t,
});

/** Sem horário vai para o fim do dia (ordena por horário crescente). */
const byTime = (a: TimelineItem, b: TimelineItem) =>
  (a.time ?? '99:99').localeCompare(b.time ?? '99:99');

const Tarefas = () => {
  const navigate = useNavigate();
  const { currentUserId, isAdmin, isManager } = useUserPermissions();

  // Admin/gestor pode atribuir tarefa a outra pessoa e inspecionar a agenda dela.
  const canAssign = isAdmin || isManager;
  const { usuarios } = useUsuariosDoTenant();

  const assignableUsers = useMemo(() => {
    if (!canAssign) return [];
    return usuarios
      .filter(u => u.active !== false && u.ativo !== false)
      .map(u => ({ id: u.id as string, nome: (u.nome || u.name || u.email) as string }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [canAssign, usuarios]);

  const [viewMode, setViewMode] = useState<ViewMode>('dia');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  /** Agenda em exibição. Só admin/gestor consegue trocar; default é a própria. */
  const [viewUserId, setViewUserId] = useState<string | null>(null);

  const targetUserId = (canAssign ? viewUserId : null) ?? currentUserId;
  const targetUserName = assignableUsers.find(u => u.id === targetUserId)?.nome;

  const selectedISO = toISODate(selectedDate);
  const weekStart = useMemo(() => startOfWeekMon(selectedDate), [selectedDate]);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Carregamos a semana inteira de uma vez e recortamos o dia em memória —
  // alternar dia/semana não dispara refetch.
  const weekFrom = toISODate(weekStart);
  const weekTo = toISODate(addDays(weekStart, 6));

  const { data: tasks = [], isLoading: loadingTasks } = useUserTasks(targetUserId, weekFrom, weekTo);
  const { data: overdueCount = 0 } = useOverdueTaskCount(targetUserId, toISODate(new Date()));
  const { data: meetings = [], isLoading: loadingMeetings } = useAgendamentosSimple(targetUserId, !!targetUserId);
  const { createTask, toggleTask, deleteTask, attachFiles } = useUserTaskMutations(currentUserId);

  const isLoading = loadingTasks || loadingMeetings;

  /** Timeline da semana inteira, indexada por data. */
  const itemsByDate = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    const push = (item: TimelineItem) => {
      if (!item.date) return;
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    };

    meetings
      .filter(m => m.status !== 'bloqueio manual' && m.status !== 'cancelado')
      // Evento vindo do Google sem lead vinculado é compromisso pessoal ou
      // reunião interna do consultor — não é reunião do CRM e não tem desfecho
      // pra registrar, então não entra na timeline.
      .filter(m => m.source !== 'google' || !!m.negocio_id)
      .filter(m => !!m.data && m.data >= weekFrom && m.data <= weekTo)
      .forEach(m => push(meetingToItem(m)));

    tasks.forEach(t => push(taskToItem(t)));

    map.forEach(list => list.sort(byTime));
    return map;
  }, [meetings, tasks, weekFrom, weekTo]);

  const dayItems = useMemo(
    () => itemsByDate.get(selectedISO) ?? [],
    [itemsByDate, selectedISO],
  );

  const stats = useMemo(() => ({
    meetings: dayItems.filter(i => i.kind === 'reuniao').length,
    pending: dayItems.filter(i => i.kind !== 'reuniao' && !i.done).length,
    late: overdueCount,
  }), [dayItems, overdueCount]);

  const headerLabel = useMemo(() => {
    if (viewMode === 'semana') {
      const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
      return `${fmt.format(weekStart)} — ${fmt.format(addDays(weekStart, 6))}`;
    }
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(selectedDate);
  }, [viewMode, selectedDate, weekStart]);

  const shiftPeriod = (dir: 1 | -1) =>
    setSelectedDate(prev => addDays(prev, viewMode === 'semana' ? 7 * dir : dir));

  const handleToggle = (item: TimelineItem) => {
    if (!item.task) return;
    toggleTask.mutate({ id: item.task.id, done: !item.task.done });
  };

  const handleAttach = (item: TimelineItem, files: File[]) => {
    if (!item.task) return;
    attachFiles.mutate({ task: item.task, files });
  };

  const handleDelete = (item: TimelineItem) => {
    if (!item.task) return;
    if (!window.confirm(`Excluir a tarefa "${item.task.title}"?`)) return;
    deleteTask.mutate(item.task);
  };

  const openLead = (leadId: string) => navigate(`/negocios/${leadId}`);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-4 flex-wrap px-6 py-3.5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex bg-card border border-border rounded-[10px] p-0.5">
            {(['dia', 'semana'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3.5 py-1.5 text-[13px] rounded-[8px] transition-colors',
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode === 'dia' ? 'Hoje' : 'Semana'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => shiftPeriod(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted transition-colors"
              title={viewMode === 'semana' ? 'Semana anterior' : 'Dia anterior'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => shiftPeriod(1)}
              className="w-8 h-8 flex items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted transition-colors"
              title={viewMode === 'semana' ? 'Próxima semana' : 'Próximo dia'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-sm text-muted-foreground capitalize">{headerLabel}</span>

          {selectedISO !== toISODate(new Date()) && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-xs text-primary hover:underline"
            >
              Voltar para hoje
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {canAssign && assignableUsers.length > 0 && (
            <Select
              value={targetUserId ?? ''}
              onValueChange={v => setViewUserId(v === currentUserId ? null : v)}
            >
              <SelectTrigger className="h-9 w-[190px] rounded-[10px] text-[13px]">
                <Users className="w-3.5 h-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Ver agenda de…" />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.id === currentUserId ? `${u.nome} (você)` : u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5 h-9 rounded-[10px]">
            <Plus className="w-4 h-4" /> Nova tarefa
          </Button>
        </div>
      </div>

      {canAssign && targetUserId !== currentUserId && (
        <div className="shrink-0 px-6 py-2 bg-[hsl(var(--stats-primary))] border-b border-[hsl(var(--stats-primary-border))] text-xs text-[hsl(var(--stats-primary-text))]">
          Você está vendo a agenda de <strong>{targetUserName}</strong>. Novas tarefas serão atribuídas a esta pessoa por padrão.
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-5 flex flex-col min-h-full">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Reuniões do dia', value: stats.meetings, tone: 'primary' },
            { label: 'Tarefas pendentes', value: stats.pending, tone: 'secondary' },
            { label: 'Atrasadas', value: stats.late, tone: 'quaternary' },
          ].map(card => (
            <div
              key={card.label}
              className="rounded-[14px] border px-5 py-4"
              style={{
                background: `hsl(var(--stats-${card.tone}))`,
                borderColor: `hsl(var(--stats-${card.tone}-border))`,
              }}
            >
              <p
                className="m-0 mb-1 text-[11px] uppercase tracking-wide"
                style={{ color: `hsl(var(--stats-${card.tone}-text))` }}
              >
                {card.label}
              </p>
              <p
                className="m-0 text-[26px] font-semibold tabular-nums leading-tight"
                style={{ color: `hsl(var(--stats-${card.tone}-text))` }}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[74px] bg-card border border-border rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'dia' ? (
          <div className="flex-1 flex flex-col gap-2.5">
            {dayItems.map(item => (
              <TimelineItemCard
                key={item.key}
                item={item}
                onToggle={handleToggle}
                onAttach={handleAttach}
                onDelete={handleDelete}
                onUpdateMeetingStatus={i => i.meeting?.negocio?.id && openLead(i.meeting.negocio.id)}
                onOpenLead={openLead}
              />
            ))}

            {dayItems.length === 0 && (
              // Estado vazio centrado no espaço restante — a tela não fica pesada no topo.
              <div className="flex-1 flex flex-col items-center justify-center text-center rounded-[14px] border border-dashed border-border py-16">
                <div className="mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ListChecks className="h-7 w-7 text-primary" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Nada para este dia. Bom trabalho!
                </p>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                  Reuniões da Agenda aparecem aqui automaticamente. Tarefas você cria abaixo.
                </p>
                <Button variant="outline" size="sm" onClick={() => setModalOpen(true)} className="gap-1.5 rounded-[10px]">
                  <Plus className="w-4 h-4" /> Nova tarefa
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {weekDates.map((d, i) => {
              const dISO = toISODate(d);
              const isToday = dISO === toISODate(new Date());
              const items = itemsByDate.get(dISO) ?? [];

              return (
                <div key={dISO} className="flex flex-col gap-2 min-h-[320px]">
                  <button
                    onClick={() => { setSelectedDate(d); setViewMode('dia'); }}
                    className={cn(
                      'text-center py-2.5 rounded-[12px] border transition-colors',
                      isToday
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted',
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      {WEEKDAY_LABELS[i]}
                    </div>
                    <div className="text-base font-semibold tabular-nums">{d.getDate()}</div>
                  </button>

                  <div className="flex flex-col gap-1.5">
                    {items.map(item => (
                      <button
                        key={item.key}
                        onClick={() => { setSelectedDate(d); setViewMode('dia'); }}
                        className={cn(
                          'relative text-left bg-card border border-border rounded-[12px] pl-3 pr-2 py-2 hover:bg-muted transition-colors',
                          item.done && 'opacity-55',
                        )}
                        title={item.title}
                      >
                        <span
                          className={cn(
                            'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[12px]',
                            KIND_STYLES[item.kind].bar,
                          )}
                        />
                        <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                          {item.time ?? '—'}
                        </div>
                        <div
                          className={cn(
                            'text-xs text-foreground mt-0.5 truncate',
                            item.done && 'line-through text-muted-foreground',
                          )}
                        >
                          {item.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <NovaTarefaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultDate={selectedISO}
        // Ao inspecionar a agenda de alguém, o default do modal é essa pessoa.
        userId={targetUserId}
        canAssign={canAssign}
        assignableUsers={assignableUsers}
        onSave={input => createTask.mutateAsync({
          ...input,
          assigneeName: assignableUsers.find(u => u.id === input.assigned_to)?.nome,
        })}
      />
    </div>
  );
};

export default Tarefas;
