/**
 * Calls gravadas pela Elephan que ainda não têm contato definido no CRM.
 *
 * Dois casos, vindos do elephan-inbound (ver migration 20260821140000):
 *   - 'needs_confirmation' — o match achou reuniões plausíveis do mesmo closer
 *     no mesmo horário e quer confirmação de qual delas era a call. As
 *     candidatas aparecem prontas para um clique.
 *   - 'pending' — não achou nada; o closer busca o negócio na mão.
 *
 * Escopo: quem não é super admin só vê (e resolve) as calls que gravou.
 */

import { useState } from 'react';
import { Bot, Calendar, Check, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ALTIORA_REUNIAO_NOME_CURTO } from '@/constants/altioraReunioes';
import {
  useElephanPendencias,
  useLinkElephanPendencia,
  useIgnoreElephanPendencia,
  useSearchNegocios,
  useCandidateMeetings,
  type ElephanPendencia,
} from '@/hooks/useElephanPendencias';

/** O que o closer escolheu: uma reunião que já existe, ou um negócio novo. */
type Escolha =
  | { kind: 'candidate'; meetingId: string; leadId: string; leadPeopleId: string | null }
  | { kind: 'negocio'; leadId: string; leadPeopleId: string | null };

function LinkDialog({
  pendencia,
  onClose,
}: {
  pendencia: ElephanPendencia;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const { data: results = [], isFetching } = useSearchNegocios(search);
  const { data: candidatas = [], isLoading: loadingCandidatas } = useCandidateMeetings(
    pendencia.candidate_meeting_ids,
  );
  const linkMutation = useLinkElephanPendencia();

  const handleConfirm = async () => {
    if (!escolha || !user?.profile?.id) return;
    try {
      await linkMutation.mutateAsync({
        pendenciaId: pendencia.id,
        transcribeId: pendencia.transcribe_id,
        leadId: escolha.leadId,
        leadPeopleId: escolha.leadPeopleId,
        // Candidata = reunião que já está na agenda; anexa nela em vez de criar
        // uma segunda reunião para o mesmo encontro.
        meetingId: escolha.kind === 'candidate' ? escolha.meetingId : null,
        closerUserId: pendencia.closer_user_id,
        callDate: pendencia.call_date,
        title: pendencia.title,
        summary: pendencia.summary,
        durationSeconds: pendencia.duration_seconds,
        recordingUrl: pendencia.recording_url,
        transcriptText: pendencia.transcript_text,
        linkedBy: user.profile.id,
        // Score card guardado no payload cru quando a call não casou sozinha.
        answers: pendencia.raw_payload?.answers ?? null,
        scorecardPrompt: pendencia.raw_payload?.prompt ?? null,
      });
      toast.success('Call vinculada ao contato');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">De qual contato era essa call?</DialogTitle>
          <DialogDescription className="text-[12px]">
            {candidatas.length > 0
              ? 'Escolha a reunião correspondente ou busque outro negócio.'
              : 'Busque pelo nome do negócio ou do cliente para vincular esta gravação.'}
          </DialogDescription>
        </DialogHeader>

        {(loadingCandidatas || candidatas.length > 0) && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground/60">
              Reuniões desse horário
            </p>
            {loadingCandidatas && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
              </div>
            )}
            <div className="space-y-1">
              {candidatas.map((c) => {
                const selected = escolha?.kind === 'candidate' && escolha.meetingId === c.meeting_id;
                const tipo = c.altiora_tipo
                  ? ALTIORA_REUNIAO_NOME_CURTO[c.altiora_tipo as keyof typeof ALTIORA_REUNIAO_NOME_CURTO]
                  : null;
                return (
                  <button
                    key={c.meeting_id}
                    type="button"
                    onClick={() =>
                      setEscolha({
                        kind: 'candidate',
                        meetingId: c.meeting_id,
                        leadId: c.lead_id,
                        leadPeopleId: c.lead_people_id,
                      })
                    }
                    className={`w-full text-left px-2.5 py-2 rounded-[4px] border text-[13px] transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    <p className="font-medium truncate">
                      {c.pessoa_nome || c.lead_title || 'Negócio sem título'}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 truncate">
                      {format(new Date(c.start_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      {tipo ? ` · ${tipo}` : ''}
                      {c.pessoa_nome && c.lead_title ? ` · ${c.lead_title}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setEscolha(null);
            }}
            placeholder="Buscar outro negócio ou cliente..."
            className="h-[34px] text-[13px] pl-8"
            autoFocus={candidatas.length === 0}
          />
        </div>

        {search.trim().length >= 2 && (
          <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-[4px] p-1 min-h-[60px]">
            {isFetching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
              </div>
            )}
            {!isFetching && results.length === 0 && (
              <p className="text-[12px] text-muted-foreground/50 text-center py-4">
                Nenhum negócio encontrado
              </p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  setEscolha({ kind: 'negocio', leadId: r.id, leadPeopleId: r.people_id })
                }
                className={`w-full text-left px-2.5 py-2 rounded-[4px] text-[13px] transition-colors ${
                  escolha?.kind === 'negocio' && escolha.leadId === r.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent/50'
                }`}
              >
                <p className="font-medium truncate">{r.title || 'Sem título'}</p>
                {r.pessoa_nome && (
                  <p className="text-[11px] text-muted-foreground/60 truncate">{r.pessoa_nome}</p>
                )}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!escolha || linkMutation.isPending} onClick={handleConfirm}>
            {linkMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 mr-1.5" />
            )}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ElephanPendenciasConfig() {
  const { user } = useAuth();
  const isSuperAdmin = user?.profile?.super_adm === true;
  // Closer comum resolve só as próprias calls; super admin enxerga o time todo.
  const { data: pendencias = [], isLoading } = useElephanPendencias(
    isSuperAdmin ? null : user?.profile?.id ?? null,
  );
  const ignoreMutation = useIgnoreElephanPendencia();
  const [linkTarget, setLinkTarget] = useState<ElephanPendencia | null>(null);

  const handleIgnore = async (id: string) => {
    try {
      await ignoreMutation.mutateAsync(id);
      toast.success('Pendência ignorada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ignorar');
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-[15px] font-semibold text-foreground">Calls sem contato definido</h2>
      </div>
      <p className="text-[13px] text-muted-foreground mb-4">
        Calls gravadas pela Elephan que o CRM não conseguiu vincular sozinho a um contato — porque
        não achou a reunião, ou porque achou mais de uma no mesmo horário. Escolha o contato certo
        ou ignore.
        {isSuperAdmin && ' Você está vendo as calls de todo o time.'}
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
        </div>
      )}

      {!isLoading && pendencias.length === 0 && (
        <div className="border border-dashed border-border rounded-[6px] py-10 text-center">
          <p className="text-[13px] text-muted-foreground/50">Nenhuma pendência — tudo vinculado</p>
        </div>
      )}

      <div className="space-y-2">
        {pendencias.map((p) => (
          <div
            key={p.id}
            className="border border-border rounded-[6px] p-3.5 flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[13px] font-medium text-foreground truncate">
                  {p.title || 'Reunião sem título'}
                </p>
                {p.status === 'needs_confirmation' ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 rounded-[3px] border-amber-500/40 text-amber-600"
                  >
                    Confirmar contato
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                    Sem reunião
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 mb-1.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" strokeWidth={1.5} />
                  {format(new Date(p.call_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                {p.closer_name && <span>Consultor: {p.closer_name}</span>}
                {!p.closer_name && p.closer_email && <span>E-mail: {p.closer_email}</span>}
              </div>
              {p.summary && (
                <p className="text-[12px] text-muted-foreground line-clamp-2">{p.summary}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setLinkTarget(p)}
              >
                {p.status === 'needs_confirmation' ? 'Escolher contato' : 'Vincular'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
                onClick={() => handleIgnore(p.id)}
                aria-label="Ignorar"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {linkTarget && <LinkDialog pendencia={linkTarget} onClose={() => setLinkTarget(null)} />}
    </div>
  );
}
