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
import {
  useElephanPendencias,
  useLinkElephanPendencia,
  useIgnoreElephanPendencia,
  useSearchNegocios,
  type ElephanPendencia,
} from '@/hooks/useElephanPendencias';

function LinkDialog({
  pendencia,
  onClose,
}: {
  pendencia: ElephanPendencia;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: results = [], isFetching } = useSearchNegocios(search);
  const linkMutation = useLinkElephanPendencia();

  const selected = results.find((r) => r.id === selectedId);

  const handleConfirm = async () => {
    if (!selected || !user?.profile?.id) return;
    try {
      await linkMutation.mutateAsync({
        pendenciaId: pendencia.id,
        transcribeId: pendencia.transcribe_id,
        leadId: selected.id,
        leadPeopleId: selected.people_id,
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
      toast.success('Reunião vinculada ao negócio');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Vincular call da Elephan a um negócio</DialogTitle>
          <DialogDescription className="text-[12px]">
            Busque pelo nome do negócio ou do cliente para vincular esta gravação.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedId(null);
            }}
            placeholder="Nome do negócio ou do cliente..."
            className="h-[34px] text-[13px] pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded-[4px] p-1 min-h-[60px]">
          {isFetching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
            </div>
          )}
          {!isFetching && search.trim().length >= 2 && results.length === 0 && (
            <p className="text-[12px] text-muted-foreground/50 text-center py-4">
              Nenhum negócio encontrado
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={`w-full text-left px-2.5 py-2 rounded-[4px] text-[13px] transition-colors ${
                selectedId === r.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
              }`}
            >
              <p className="font-medium truncate">{r.title || 'Sem título'}</p>
              {r.pessoa_nome && (
                <p className="text-[11px] text-muted-foreground/60 truncate">{r.pessoa_nome}</p>
              )}
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!selected || linkMutation.isPending}
            onClick={handleConfirm}
          >
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
  const { data: pendencias = [], isLoading } = useElephanPendencias();
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
        <h2 className="text-[15px] font-semibold text-foreground">Pendências Elephan.ai</h2>
      </div>
      <p className="text-[13px] text-muted-foreground mb-4">
        Calls gravadas pela Elephan que não conseguimos vincular automaticamente a um negócio
        (consultor ou reunião não encontrados na janela de tempo). Vincule manualmente ou ignore.
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
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-[3px]">
                  Elephan
                </Badge>
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
                Vincular
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
