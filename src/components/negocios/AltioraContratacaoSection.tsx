/**
 * ALTIORA-20 UC28/UC29: Seção de Acompanhamento de Contratação e Registro de Ganho.
 *
 * AC1: Checklist com 4 categorias: documentos, exames, entrevista, underwriting.
 * AC2: Qualquer item pode ser marcado como "Não aplicável" com observação.
 * AC3: Botão "Registrar Ganho" disponível após pelo menos 1 item marcado/N/A.
 * AC4: Ao confirmar Ganho: move para etapa "Ganho", status='won', atualiza value.
 * AC5: Sem data_emissao → bloqueia botão "Confirmar Ganho".
 *
 * Visível apenas quando referral está na etapa "Em contratação" (position 11) ou posterior.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2, Circle, XCircle, Trophy, Loader2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  useAltioraContratacao,
  useSaveDocumentos,
  useSaveExames,
  useSaveEntrevista,
  useSaveUnderwriting,
  useRegistrarGanho,
  isChecklistReady,
  type JsonChecklistStatus,
  type EntrevistaStatus,
  type UnderwritingStatus,
} from '@/hooks/useAltioraContratacao';

// ── Constants ─────────────────────────────────────────────────────────────────

const EM_CONTRATACAO_MIN_POSITION = 11;

// ── Component ─────────────────────────────────────────────────────────────────

interface AltioraContratacaoSectionProps {
  leadId:               string;
  currentStagePosition?: number;
}

// ── Checklist Row ─────────────────────────────────────────────────────────────

interface JsonChecklistRowProps {
  label:       string;
  value:       JsonChecklistStatus;
  onChange:    (v: JsonChecklistStatus) => void;
  isSaving?:   boolean;
}

const JsonChecklistRow = ({ label, value, onChange, isSaving }: JsonChecklistRowProps) => {
  const status = value.status;

  const cycle = () => {
    const next = status === 'pendente' ? 'concluido' : status === 'concluido' ? 'nao_aplicavel' : 'pendente';
    onChange({ ...value, status: next as JsonChecklistStatus['status'] });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={cycle} disabled={isSaving} className="flex-shrink-0 disabled:opacity-40">
          {status === 'concluido' ? (
            <CheckCircle2 className="w-[18px] h-[18px] text-emerald-500" strokeWidth={1.5} />
          ) : status === 'nao_aplicavel' ? (
            <XCircle className="w-[18px] h-[18px] text-muted-foreground/40" strokeWidth={1.5} />
          ) : (
            <Circle className="w-[18px] h-[18px] text-muted-foreground/30" strokeWidth={1.5} />
          )}
        </button>

        <span className={cn(
          'text-[12px] flex-1',
          status === 'nao_aplicavel' && 'line-through text-muted-foreground/40',
          status === 'concluido' && 'text-foreground',
        )}>
          {label}
        </span>

        {status === 'concluido' && (
          <Input
            type="date"
            value={value.data ?? ''}
            onChange={e => onChange({ ...value, data: e.target.value || null })}
            className="h-6 w-34 text-[11px] rounded-[3px] px-1.5"
          />
        )}

        {status === 'nao_aplicavel' && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 rounded-[3px] border-muted text-muted-foreground/40">
            N/A
          </Badge>
        )}
      </div>

      {status === 'nao_aplicavel' && (
        <Input
          value={value.observacao ?? ''}
          onChange={e => onChange({ ...value, observacao: e.target.value || null })}
          placeholder="Motivo (opcional)..."
          className="h-6 text-[11px] rounded-[3px] ml-7"
        />
      )}
    </div>
  );
};

// ── EntrevistaRow ─────────────────────────────────────────────────────────────

interface EntrevistaRowProps {
  value:     EntrevistaStatus;
  onChange:  (v: EntrevistaStatus) => void;
  isSaving?: boolean;
}

const EntrevistaRow = ({ value, onChange, isSaving }: EntrevistaRowProps) => (
  <div className="flex items-center gap-2.5">
    <div className="flex-1">
      <span className={cn(
        'text-[12px]',
        value === 'nao_aplicavel' && 'line-through text-muted-foreground/40',
        (value === 'realizada') && 'text-foreground',
      )}>
        Entrevista financeira
      </span>
    </div>
    <Select value={value} onValueChange={v => onChange(v as EntrevistaStatus)} disabled={isSaving}>
      <SelectTrigger className="h-6 w-36 text-[11px] rounded-[3px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-[3px]">
        <SelectItem value="pendente">Pendente</SelectItem>
        <SelectItem value="agendada">Agendada</SelectItem>
        <SelectItem value="realizada">Realizada ✓</SelectItem>
        <SelectItem value="nao_aplicavel">N/A</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

// ── UnderwritingRow ───────────────────────────────────────────────────────────

interface UnderwritingRowProps {
  value:     UnderwritingStatus;
  onChange:  (v: UnderwritingStatus) => void;
  isSaving?: boolean;
}

const UnderwritingRow = ({ value, onChange, isSaving }: UnderwritingRowProps) => (
  <div className="flex items-center gap-2.5">
    <div className="flex-1">
      <span className={cn(
        'text-[12px]',
        value === 'nao_aplicavel' && 'line-through text-muted-foreground/40',
        (value === 'aprovado') && 'text-foreground',
        (value === 'recusado') && 'text-destructive',
      )}>
        Underwriting
      </span>
    </div>
    <Select value={value} onValueChange={v => onChange(v as UnderwritingStatus)} disabled={isSaving}>
      <SelectTrigger className="h-6 w-36 text-[11px] rounded-[3px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-[3px]">
        <SelectItem value="pendente">Pendente</SelectItem>
        <SelectItem value="em_analise">Em análise</SelectItem>
        <SelectItem value="aprovado">Aprovado ✓</SelectItem>
        <SelectItem value="recusado">Recusado</SelectItem>
        <SelectItem value="nao_aplicavel">N/A</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const AltioraContratacaoSection = ({
  leadId,
  currentStagePosition = 0,
}: AltioraContratacaoSectionProps) => {
  const { user } = useAuth();
  const { data: contratacao, isLoading } = useAltioraContratacao(leadId);
  const saveDocumentos  = useSaveDocumentos();
  const saveExames      = useSaveExames();
  const saveEntrevista  = useSaveEntrevista();
  const saveUnderwriting = useSaveUnderwriting();
  const registrarGanho  = useRegistrarGanho();

  // Modal state
  const [ganhoOpen, setGanhoOpen]             = useState(false);
  const [parceiroEmissor, setParceiroEmissor] = useState('');
  const [dataEmissao, setDataEmissao]         = useState('');
  const [valorPremio, setValorPremio]         = useState('');

  if (currentStagePosition < EM_CONTRATACAO_MIN_POSITION) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Acompanhamento de Contratação
        </p>
        <div className="flex items-center gap-2 p-3 rounded-[4px] border border-dashed border-border/40 text-muted-foreground/50">
          <Clock className="w-4 h-4 flex-none" strokeWidth={1.5} />
          <span className="text-[12px]">Disponível a partir de "Em contratação"</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Acompanhamento de Contratação</p>
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>
      </div>
    );
  }

  const docStatus   = (contratacao?.documentos_status ?? { status: 'pendente' }) as JsonChecklistStatus;
  const examStatus  = (contratacao?.exames_status     ?? { status: 'pendente' }) as JsonChecklistStatus;
  const entStatus   = (contratacao?.entrevista_financeira_status ?? 'pendente') as EntrevistaStatus;
  const uwStatus    = (contratacao?.underwriting_status           ?? 'pendente') as UnderwritingStatus;

  const canRegisterGanho = isChecklistReady(contratacao ?? null);

  const handleDocChange = (v: JsonChecklistStatus) => {
    if (!user?.id) return;
    saveDocumentos.mutate({ leadId, actorId: user.id, status: v });
  };

  const handleExamChange = (v: JsonChecklistStatus) => {
    if (!user?.id) return;
    saveExames.mutate({ leadId, actorId: user.id, status: v });
  };

  const handleEntrevistaChange = (v: EntrevistaStatus) => {
    if (!user?.id) return;
    saveEntrevista.mutate({ leadId, actorId: user.id, status: v });
  };

  const handleUnderwritingChange = (v: UnderwritingStatus) => {
    if (!user?.id) return;
    saveUnderwriting.mutate({ leadId, actorId: user.id, status: v });
  };

  const handleConfirmarGanho = async () => {
    if (!user?.id || !parceiroEmissor.trim() || !dataEmissao || !valorPremio) return;
    await registrarGanho.mutateAsync({
      leadId,
      actorId:        user.id,
      parceiroEmissor: parceiroEmissor.trim(),
      dataEmissao,
      valorPremio:    parseFloat(valorPremio),
    });
    setGanhoOpen(false);
  };

  const canConfirmGanho =
    parceiroEmissor.trim().length > 0 &&
    dataEmissao.length > 0 &&
    valorPremio.length > 0 &&
    parseFloat(valorPremio) > 0 &&
    !registrarGanho.isPending;

  const isSaving = saveDocumentos.isPending || saveExames.isPending || saveEntrevista.isPending || saveUnderwriting.isPending;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Acompanhamento de Contratação
          </p>

          {/* AC3: Botão Registrar Ganho */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  disabled={!canRegisterGanho}
                  onClick={() => {
                    setParceiroEmissor(contratacao?.parceiro_emissor ?? '');
                    setDataEmissao(contratacao?.data_emissao ?? '');
                    setValorPremio(contratacao?.premio_confirmado?.toString() ?? '');
                    setGanhoOpen(true);
                  }}
                  className={cn(
                    'h-7 px-3 text-[11px] gap-1.5 rounded-[3px]',
                    canRegisterGanho ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : '',
                  )}
                >
                  <Trophy className="w-3 h-3" />
                  Registrar Ganho
                </Button>
              </span>
            </TooltipTrigger>
            {!canRegisterGanho && (
              <TooltipContent className="text-[11px] max-w-[200px] text-center">
                Marque pelo menos 1 item como concluído ou N/A para habilitar.
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Checklist */}
        <div className="border border-border rounded-[4px] p-3 space-y-3">
          <JsonChecklistRow
            label="Documentos coletados"
            value={docStatus}
            onChange={handleDocChange}
            isSaving={isSaving}
          />
          <JsonChecklistRow
            label="Exames médicos"
            value={examStatus}
            onChange={handleExamChange}
            isSaving={isSaving}
          />
          <EntrevistaRow
            value={entStatus}
            onChange={handleEntrevistaChange}
            isSaving={isSaving}
          />
          <UnderwritingRow
            value={uwStatus}
            onChange={handleUnderwritingChange}
            isSaving={isSaving}
          />
        </div>

        {/* Emissão confirmada */}
        {contratacao?.data_emissao && (
          <div className="border border-emerald-500/20 rounded-[4px] p-3 bg-emerald-500/5">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-widest mb-2">
              Emissão Confirmada
            </p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <span className="text-muted-foreground/60">Parceiro</span>
                <p className="font-medium">{contratacao.parceiro_emissor ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground/60">Data emissão</span>
                <p className="font-medium">
                  {new Date(contratacao.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              {contratacao.premio_confirmado != null && (
                <div className="col-span-2">
                  <span className="text-muted-foreground/60">Prêmio</span>
                  <p className="font-semibold text-emerald-600 text-[14px]">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contratacao.premio_confirmado)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Registrar Ganho */}
      <Dialog open={ganhoOpen} onOpenChange={setGanhoOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[4px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-emerald-500" />
              Registrar Ganho
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Parceiro emissor <span className="text-destructive">*</span>
              </Label>
              <Input
                value={parceiroEmissor}
                onChange={e => setParceiroEmissor(e.target.value)}
                placeholder="Ex: Icatu, Prudential, Zurich..."
                className="rounded-[4px]"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Data de emissão <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={dataEmissao}
                onChange={e => setDataEmissao(e.target.value)}
                className="rounded-[4px]"
              />
              {!dataEmissao && (
                <p className="text-[11px] text-destructive mt-1">Data de emissão obrigatória</p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Valor do prêmio (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={valorPremio}
                onChange={e => setValorPremio(e.target.value)}
                placeholder="Ex: 1500.00"
                className="rounded-[4px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setGanhoOpen(false)}
              disabled={registrarGanho.isPending}
              className="rounded-[4px] h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarGanho}
              disabled={!canConfirmGanho}
              className="rounded-[4px] h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {registrarGanho.isPending ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Registrando...</>
              ) : (
                <><Trophy className="w-3 h-3" />Confirmar Ganho</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default AltioraContratacaoSection;
