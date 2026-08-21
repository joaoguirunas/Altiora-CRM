import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SmartSlotPicker } from '@/components/reunioes/SmartSlotPicker';
import { useCriarAgendamento } from '@/hooks/useAgendamentos';
import { useBookingRuleSets } from '@/hooks/useBookingRuleSets';
import {
  Loader2, CalendarPlus, CheckCircle2, Briefcase, Link2, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildInvitePreview } from '@/lib/invitePreview';

interface AgendamentoInlineTabProps {
  personId: string | null;
  personName: string | null;
  userId: string | null;
  linkedLeadId: string | null;
  onSendLink?: (url: string) => void;
}

export function AgendamentoInlineTab({
  personId, personName, userId, linkedLeadId, onSendLink,
}: AgendamentoInlineTabProps) {
  const criarAgendamento = useCriarAgendamento();
  const { data: ruleSets = [] } = useBookingRuleSets();
  const [title, setTitle]         = useState(`Follow-up — ${personName || 'Cliente'}`);
  const [notes, setNotes]         = useState('');
  const [date, setDate]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [done, setDone]           = useState(false);
  // Convite enviado ao cliente. Vem pré-preenchido pelo mesmo modelo que a edge
  // function usa; enquanto não for editado (`*Dirty` false) acompanha o
  // formulário e nada é gravado — o servidor segue montando o texto sozinho.
  // Editado, é o texto daqui que o cliente recebe (meetings.invite_*).
  const [inviteTitle, setInviteTitle] = useState('');
  const [inviteBody, setInviteBody]   = useState('');
  const [inviteTitleDirty, setInviteTitleDirty] = useState(false);
  const [inviteBodyDirty, setInviteBodyDirty]   = useState(false);

  const invitePreview = useMemo(
    () => buildInvitePreview({ clientName: personName, notes }),
    [personName, notes],
  );

  useEffect(() => {
    if (!inviteTitleDirty) setInviteTitle(invitePreview.title);
    if (!inviteBodyDirty) setInviteBody(invitePreview.description);
  }, [invitePreview, inviteTitleDirty, inviteBodyDirty]);

  const inviteCustomizado = inviteTitleDirty || inviteBodyDirty;

  const restaurarConvitePadrao = () => {
    setInviteTitleDirty(false);
    setInviteBodyDirty(false);
    setInviteTitle(invitePreview.title);
    setInviteBody(invitePreview.description);
  };

  const canCreate = !!date && !!startTime && !!endTime && !!title.trim();

  const activeRuleSet = ruleSets.find(rs => rs.is_active && rs.url_id);
  const bookingUrl = activeRuleSet
    ? `${window.location.origin}/agendar/${activeRuleSet.url_id}`
    : null;

  const handleCreate = () => {
    if (!canCreate || !userId) return;
    criarAgendamento.mutate(
      {
        people_id: personId || undefined,
        lead_id: linkedLeadId || undefined,
        user_id: userId,
        title,
        date,
        start_time: startTime,
        end_time: endTime,
        notes,
        status: 'agendado',
        // Só vai override do que o usuário de fato editou.
        invite_title: inviteTitleDirty ? inviteTitle : null,
        invite_description: inviteBodyDirty ? inviteBody : null,
      },
      {
        onSuccess: () => { toast.success('Agendamento criado'); setDone(true); },
        onError: () => toast.error('Erro ao criar agendamento'),
      },
    );
  };

  const handleSendLink = () => {
    if (!bookingUrl) {
      toast.error('Configure um conjunto de regras de agendamento em Configurações');
      return;
    }
    if (onSendLink) {
      onSendLink(bookingUrl);
    } else {
      navigator.clipboard.writeText(bookingUrl);
      toast.success('Link copiado!');
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={1.5} />
        </div>
        <p className="text-[14px] font-semibold text-foreground">Agendamento criado!</p>
        <p className="text-[12px] text-muted-foreground">O compromisso foi salvo com sucesso</p>
        {linkedLeadId && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Vinculado ao negócio selecionado</p>
        )}
        <Button variant="outline" size="sm" onClick={() => {
          setDone(false); setDate(''); setStartTime(''); setEndTime('');
          setInviteTitleDirty(false); setInviteBodyDirty(false);
        }} className="mt-1 h-[30px] text-xs rounded-[4px]">
          Criar outro agendamento
        </Button>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="p-6 text-center text-[13px] text-muted-foreground">
        Usuário não autenticado
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Context */}
      {(personName || linkedLeadId) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-muted border border-white/[0.06] text-[11px]">
          {personName && (
            <span className="text-muted-foreground">Para: <strong className="text-foreground">{personName}</strong></span>
          )}
          {linkedLeadId && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 ml-auto">
              <Briefcase className="w-3 h-3" strokeWidth={1.5} /> Negócio vinculado
            </span>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10px] text-white/40">Título</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs" />
      </div>

      <SmartSlotPicker
        consultorId={userId}
        onSelect={(d, st, et) => { setDate(d); setStartTime(st); setEndTime(et); }}
      />

      <div className="space-y-1">
        <Label className="text-[10px] text-white/40">Notas</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="O que será discutido?"
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      {/* Convite — o que o cliente recebe por e-mail */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[10px] text-white/40">Título do e-mail (convite)</Label>
          {inviteCustomizado && (
            <button
              type="button"
              onClick={restaurarConvitePadrao}
              className="text-[10px] text-white/40 hover:text-foreground underline underline-offset-2"
            >
              Restaurar padrão
            </button>
          )}
        </div>
        <Input
          value={inviteTitle}
          onChange={e => { setInviteTitle(e.target.value); setInviteTitleDirty(true); }}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-white/40">Corpo do e-mail (convite)</Label>
        <Textarea
          value={inviteBody}
          onChange={e => { setInviteBody(e.target.value); setInviteBodyDirty(true); }}
          rows={6}
          className="text-xs"
        />
        <p className="text-[10px] text-white/40">
          {inviteCustomizado
            ? 'Convite personalizado — substitui o modelo padrão.'
            : 'Preenchido pelo modelo padrão. Edite só se precisar.'}
        </p>
      </div>

      <Button
        onClick={handleCreate}
        disabled={!canCreate || criarAgendamento.isPending}
        className="w-full h-[30px] text-xs rounded-[4px] gap-1.5"
      >
        {criarAgendamento.isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <CalendarPlus className="w-3.5 h-3.5" strokeWidth={1.5} />}
        Confirmar agendamento
      </Button>

      {/* Send booking link */}
      <div className="border-t border-white/[0.06] pt-3">
        <Button
          variant="outline"
          onClick={handleSendLink}
          className="w-full h-[30px] text-xs rounded-[4px] gap-1.5"
        >
          {onSendLink ? (
            <><Link2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Enviar link de agendamento</>
          ) : (
            <><Copy className="w-3.5 h-3.5" strokeWidth={1.5} /> Copiar link de agendamento</>
          )}
        </Button>
        {bookingUrl && (
          <p className="text-[10px] text-white/40 mt-1 text-center truncate" title={bookingUrl}>
            {bookingUrl}
          </p>
        )}
      </div>
    </div>
  );
}
