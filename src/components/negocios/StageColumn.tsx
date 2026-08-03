
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Stage } from "@/hooks/usePipelines";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Droppable, Draggable, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { NegocioOptimized } from "@/hooks/useNegociosOptimized";
import { useNavigate } from "react-router-dom";
import { Building2, MessageCircle, Star, Megaphone, MoreHorizontal, XCircle, Activity, ChevronRight, CalendarClock } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMessageCountByLead } from "@/hooks/useMessageCount";
import { useLatestMeetingByLead } from "@/hooks/useLatestMeetingByLead";
import { useUsers } from "@/hooks/useUsersNew";
import CursoBadges from "./CursoBadges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MotivoPerdasModal, { type MotivoPerdasPayload } from "./MotivoPerdasModal";
import { useUpdateNegocio } from "@/hooks/useNegocios";
import { toast } from "sonner";
import { getMotivoPerdaCategoria } from "@/utils/motivoPerdaCategoria";

// ── Utilitário: formata tempo decorrido de forma compacta ──────────────────────
// Exemplo: "2d", "5h", "3sem", "1mes"
// TODO ALTIORA-03: usar stage_entered_at quando migration for aplicada
function formatTempoDecorrido(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNowStrict(new Date(dateStr), {
      locale: ptBR,
      addSuffix: false,
    });
  } catch {
    return '—';
  }
}

interface StageColumnProps {
  stage: Stage;
  negocios: NegocioOptimized[];
  totalValue: number;
  isLoading: boolean;
  /** Quando true, exibe informações adicionais Altiora no card (AC5 — ALTIORA-03). */
  isAltiora?: boolean;
}

const StageColumn = ({
  stage,
  negocios,
  totalValue,
  isLoading,
  isAltiora = false,
}: StageColumnProps) => {
  const navigate = useNavigate();
  const [displayedItems, setDisplayedItems] = useState(10);
  const [showLostModal, setShowLostModal] = useState<string | null>(null);
  const updateNegocio = useUpdateNegocio();

  // AC1 (ALTIORA-03): resolver nome do Closer a partir do altiora_closer_id
  // useUsers usa React Query — o cache é compartilhado, sem N requests por coluna
  const { data: allUsers = [] } = useUsers();
  const closerById = useMemo(() => {
    const map: Record<string, { name: string; avatarUrl?: string }> = {};
    allUsers.forEach(u => {
      map[u.id] = { name: u.name || u.nome || '—', avatarUrl: (u as { avatar_url?: string }).avatar_url };
    });
    return map;
  }, [allUsers]);

  const ITEMS_PER_PAGE = 10;

  // ALTIORA-19 AC2: registra motivo, etapa anterior e possibilidade de retomada
  const handleConfirmLost = async (payload: MotivoPerdasPayload) => {
    if (!showLostModal) return;
    try {
      await updateNegocio.mutateAsync({
        id: showLostModal,
        status: 'lost',
        leads_loss_reasons_id: payload.motivoId,
        loss_reason: payload.observacoes || payload.motivoTexto,
        // Campos Altiora — migration 20260725120000_altiora_leads_referral.sql
        altiora_possibilidade_retomada: payload.possibilidadeRetomada,
        altiora_etapa_perda: stage.nome,
        lost_at: new Date().toISOString(),
      });
      toast.success('Referral encerrado como perdido');
      setShowLostModal(null);
    } catch {
      toast.error('Erro ao encerrar como perdido');
    }
  };

  const displayedNegocios = useMemo(
    () => negocios.slice(0, displayedItems),
    [negocios, displayedItems]
  );

  const leadIds = useMemo(
    () => negocios.map(n => n.id),
    [negocios]
  );
  const { data: messageCounts = {} } = useMessageCountByLead(leadIds);
  const { data: meetingByLead = {} } = useLatestMeetingByLead(leadIds);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-muted-foreground bg-muted border-border';
    if (score >= 8) return 'text-[#00D26A] bg-[#00D26A]/10 border-[#00D26A]/20';
    if (score >= 6) return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20';
    return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
  };

  const getInitials = (name?: string | null) =>
    (name ?? '?')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const handleLoadMore = () => {
    setDisplayedItems(prev => prev + ITEMS_PER_PAGE);
  };

  // Portal-aware draggable to prevent z-index issues
  const PortalAwareDraggable: React.FC<{
    negocio: NegocioOptimized;
    index: number;
    children: (args: { provided: DraggableProvided; snapshot: DraggableStateSnapshot }) => React.ReactNode;
  }> = ({ negocio, index, children }) => (
    <Draggable draggableId={negocio.id} index={index}>
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={provided.draggableProps.style}
          >
            {children({ provided, snapshot })}
          </div>
        );
        return snapshot.isDragging ? createPortal(child, document.body) : child;
      }}
    </Draggable>
  );

  return (
    <div className="w-72 flex-shrink-0 border border-border/60 dark:border-white/10 rounded-xl bg-card/40 dark:bg-white/[0.025] backdrop-blur-sm flex flex-col h-full" role="region" aria-label={`Etapa ${stage.nome} — ${negocios.length} ${isAltiora ? 'referrals' : 'negócios'}`}>
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 dark:border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.cor || 'hsl(var(--muted-foreground))' }}
          />
          <span className="text-[13px] font-medium text-foreground truncate">{stage.nome}</span>
          <span className="text-[11px] text-muted-foreground/40 flex-shrink-0">{negocios.length}</span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground/60 flex-shrink-0 ml-2">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* Cards area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "p-2 space-y-1.5 flex-1 overflow-y-auto min-h-0",
              snapshot.isDraggingOver && "bg-accent/5"
            )}
          >
            {isLoading ? (
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : negocios.length > 0 ? (
              <>
                {displayedNegocios.map((negocio, index) => (
                  <PortalAwareDraggable key={negocio.id} negocio={negocio} index={index}>
                    {({ snapshot }) => (
                      <div
                        onClick={() => navigate(`/crm/kanban/${negocio.id}`)}
                        className={cn(
                          "w-full bg-card dark:bg-white/[0.05] border border-border dark:border-white/10 rounded-xl p-3 space-y-2.5 cursor-pointer transition-all duration-200 shadow-sm dark:shadow-none",
                          "hover:shadow-md hover:border-primary/30 dark:hover:bg-white/[0.08] dark:hover:border-primary/40",
                          snapshot.isDragging && "ring-2 ring-primary/20 shadow-lg z-[9999]",
                          negocio.status === 'lost' && "bg-destructive/5 border-destructive/20"
                        )}
                      >
                        {/* Avatar + nome/empresa + valor/data */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                                {getInitials(negocio.pessoa?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                                {negocio.pessoa?.name || 'Sem nome'}
                              </p>
                              {negocio.empresa?.trade_name && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Building2 className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                                  <span className="truncate">{negocio.empresa.trade_name}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <p className="text-[13px] font-semibold text-primary whitespace-nowrap">
                                {formatCurrency(negocio.value || 0)}
                              </p>
                              {negocio.status === 'in_progress' && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground -mr-1"
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label="Mais ações"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowLostModal(negocio.id);
                                      }}
                                      className="text-[13px] gap-2 cursor-pointer text-destructive focus:text-destructive"
                                    >
                                      <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                                      Marcar como Perdido
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">
                              {negocio.created_at && format(new Date(negocio.created_at), 'dd/MM', { locale: ptBR })}
                            </span>
                          </div>
                        </div>

                        {/* Linha "Score" — qualificação, cursos/produtos, origem, mensagens (omitida se não há nada a exibir) */}
                        {(negocio.pessoa?.score_matrix?.name
                          || messageCounts[negocio.id] > 0
                          || negocio.utm_source
                          || (negocio.pessoa?.cursos && negocio.pessoa.cursos.length > 0)) && (
                          <div className="pt-2 border-t border-border/60 dark:border-white/10">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                              Score
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {negocio.pessoa?.score_matrix?.name && (
                                <span className={cn(
                                  "inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full border leading-none",
                                  getScoreColor(negocio.pessoa.score_matrix.score_number)
                                )}>
                                  <Star className="h-2.5 w-2.5" strokeWidth={1.5} />
                                  {negocio.pessoa.score_matrix.name}
                                </span>
                              )}

                              {messageCounts[negocio.id] > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full border leading-none text-violet-400 bg-violet-400/10 border-violet-400/20">
                                  <MessageCircle className="h-2.5 w-2.5" strokeWidth={1.5} />
                                  {messageCounts[negocio.id]} msg
                                </span>
                              )}

                              {negocio.utm_source && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full border leading-none text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20">
                                  <Megaphone className="h-2.5 w-2.5" strokeWidth={1.5} />
                                  {negocio.utm_source}
                                </span>
                              )}

                              <CursoBadges cursos={negocio.pessoa?.cursos} pill />
                            </div>
                          </div>
                        )}

                        {/* Linha "Reunião" — próxima agendada ou última realizada */}
                        {meetingByLead[negocio.id] && (
                          <div className="pt-2 border-t border-border/60 dark:border-white/10">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                              Reunião
                            </p>
                            <span className={cn(
                              "inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full border leading-none",
                              meetingByLead[negocio.id].isPast
                                ? "text-muted-foreground bg-muted border-border"
                                : "text-primary bg-primary/10 border-primary/20"
                            )}>
                              <CalendarClock className="h-2.5 w-2.5" strokeWidth={1.5} />
                              {meetingByLead[negocio.id].label}
                            </span>
                          </div>
                        )}

                        {/* ── Seção Altiora (AC1–AC4, ALTIORA-03) ── renderizada apenas no pipeline Altiora */}
                        {isAltiora && (
                          <div className="pt-2 border-t border-border/60 dark:border-white/10 space-y-1">

                            {/* AC3: Última atividade via last_interaction_at */}
                            {negocio.last_interaction_at && (
                              <div className="flex items-center gap-1.5">
                                <Activity className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                                <span className="text-[11px] text-muted-foreground/60 truncate">
                                  Atividade {formatTempoDecorrido(negocio.last_interaction_at)} atrás
                                </span>
                              </div>
                            )}

                            {/* AC4: Próxima ação
                                TODO ALTIORA-03: exibir next_action_description + next_action_due_at
                                quando migration 20260725XXX_altiora_next_action.sql for aplicada */}

                            {/* AC1: Closer responsável — badge com foto no canto inferior direito */}
                            <div className="flex justify-end pt-0.5">
                              {negocio.altiora_closer_id ? (() => {
                                const closer = closerById[negocio.altiora_closer_id];
                                const initials = (closer?.name ?? '?')
                                  .split(' ')
                                  .map(w => w[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase();
                                return (
                                  <span className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full border leading-none text-cyan-700 bg-cyan-500/15 border-cyan-500/30 dark:text-cyan-300 dark:bg-cyan-400/15 dark:border-cyan-400/25">
                                    <Avatar className="h-4 w-4">
                                      <AvatarImage src={closer?.avatarUrl || undefined} alt={closer?.name} />
                                      <AvatarFallback className="bg-cyan-500/25 text-cyan-800 text-[7px] font-bold dark:bg-cyan-400/25 dark:text-cyan-200">
                                        {initials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[10px] font-medium truncate max-w-[110px]">
                                      {closer?.name ?? 'Closer'}
                                    </span>
                                  </span>
                                );
                              })() : (
                                <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border leading-none text-amber-400 bg-amber-400/10 border-amber-400/20">
                                  Sem Closer
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </PortalAwareDraggable>
                ))}
                {negocios.length > ITEMS_PER_PAGE && displayedItems < negocios.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="w-full text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/50 mt-1 h-[30px] rounded-lg"
                  >
                    Carregar mais ({negocios.length - displayedItems})
                  </Button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[12px] text-muted-foreground/40">
                  {isAltiora ? 'Nenhum referral nesta etapa' : 'Nenhum negócio nesta etapa'}
                </p>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* ALTIORA-19: modal com toggle de retomada e lista de motivos do banco */}
      <MotivoPerdasModal
        isOpen={!!showLostModal}
        onClose={() => setShowLostModal(null)}
        onConfirm={handleConfirmLost}
        isLoading={updateNegocio.isPending}
        categoria={getMotivoPerdaCategoria(stage.nome)}
      />
    </div>
  );
};

export default StageColumn;
