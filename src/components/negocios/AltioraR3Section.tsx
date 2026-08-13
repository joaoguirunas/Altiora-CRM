/**
 * ALTIORA-18 UC27: Seção "Resultado da R3" na ficha do referral.
 *
 * AC1: Campos: estrutura confirmada, valor estimado, comparecimento, resultado geral, decisão cliente
 * AC2: "Avançar para contratação" → auto move para "Em contratação"
 * AC3: "Não avançar" → abre MotivoPerdasModal (callback para pai)
 * AC4: "Continuar negociação" → salva + solicita próxima ação (callback)
 * AC5: Campos obrigatórios validados (resultado geral, decisão)
 * Visível apenas em etapa >= R3 realizada (position 10)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Edit2, Check, X, Loader2, Clock, Trophy, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useR3Data, useSaveR3Data, type ResultadoR3 } from '@/hooks/useAltioraR2Data';

// ── Constants ─────────────────────────────────────────────────────────────────

const R3_REALIZADA_MIN_POSITION = 10;

// Stage "Em contratação"
const STAGE_EM_CONTRATACAO = 'a1000000-0000-0000-0001-000000000011';

const ESTRUTURAS_CONFIRMADAS = [
  { value: 'previdencia',          label: 'Previdência' },
  { value: 'seguro_vida',          label: 'Seguro de vida' },
  { value: 'investimentos',        label: 'Investimentos' },
  { value: 'combo',                label: 'Combo' },
  { value: 'pendente',             label: 'Pendente' },
];

const DECISOES = [
  { value: 'avançar',   label: 'Avançar para contratação' },
  { value: 'continuar', label: 'Continuar negociação' },
  { value: 'nao_avançar', label: 'Não avançar' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface AltioraR3SectionProps {
  leadId: string;
  currentStagePosition?: number;
  /** Callback AC2: avançar para contratação — atualiza etapa no pai */
  onAvancarContratacao?: () => void;
  /** Callback AC3: não avançar — abre MotivoPerdasModal no pai */
  onNaoAvancar?: () => void;
  /** Callback AC4: continuar negociação — abre ProximaAcaoModal no pai */
  onContinuarNegociacao?: () => void;
}

const AltioraR3Section = ({
  leadId,
  currentStagePosition = 0,
  onAvancarContratacao,
  onNaoAvancar,
  onContinuarNegociacao,
}: AltioraR3SectionProps) => {
  const { user } = useAuth();
  const { data: r3Data, isLoading } = useR3Data(leadId);
  const saveR3 = useSaveR3Data();

  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [estrutura, setEstrutura] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [compareceu, setCompareceu] = useState(true);
  const [resultadoGeral, setResultadoGeral] = useState('');
  const [decisao, setDecisao] = useState('');

  const resultado = r3Data?.resultado as ResultadoR3 | undefined;
  const isFilled = !!(resultado?.resultado_geral || resultado?.decisao_cliente);

  // AC5: hide if stage < R3 realizada
  if (currentStagePosition < R3_REALIZADA_MIN_POSITION) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Resultado — IUL Implementation</p>
        <div className="flex items-center gap-2 p-3 rounded-[4px] border border-dashed border-border/40 text-muted-foreground/50">
          <Clock className="w-4 h-4 flex-none" strokeWidth={1.5} />
          <span className="text-[12px]">Preencher após a R3</span>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setEstrutura(resultado?.estrutura_confirmada ?? '');
    setValorEstimado(resultado?.valor_estimado?.toString() ?? '');
    setCompareceu(resultado?.compareceu ?? true);
    setResultadoGeral(resultado?.resultado_geral ?? '');
    setDecisao(resultado?.decisao_cliente ?? r3Data?.decisao_cliente ?? '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!user?.id || !resultadoGeral.trim() || !decisao) return;

    await saveR3.mutateAsync({
      leadId,
      actorId: user.id,
      resultado: {
        estrutura_confirmada: estrutura || undefined,
        valor_estimado:       valorEstimado ? parseFloat(valorEstimado) : undefined,
        compareceu,
        resultado_geral:      resultadoGeral.trim(),
        decisao_cliente:      decisao,
      },
      decisaoCliente: decisao,
    });

    setIsEditing(false);

    // AC2/AC3/AC4: disparar callback baseado na decisão
    if (decisao === 'avançar') {
      onAvancarContratacao?.();
    } else if (decisao === 'nao_avançar') {
      onNaoAvancar?.();
    } else if (decisao === 'continuar') {
      onContinuarNegociacao?.();
    }
  };

  const canSave = resultadoGeral.trim().length > 0 && decisao.length > 0 && !saveR3.isPending;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Resultado — IUL Implementation</p>
        <div className="flex justify-center py-5"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Resultado — IUL Implementation</p>
        <div className="flex items-center gap-2">
          {isFilled && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 rounded-[2px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
              Preenchido
            </Badge>
          )}
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={startEditing} className="h-6 px-2 text-[11px] gap-1 rounded-[2px]">
              <Edit2 className="w-3 h-3" />
              {isFilled ? 'Editar' : 'Preencher'}
            </Button>
          )}
        </div>
      </div>

      {/* View mode */}
      {!isEditing && (
        <div className="border border-border rounded-[2px] overflow-hidden">
          {isFilled ? (
            <div className="divide-y divide-border/50">
              {resultado?.estrutura_confirmada && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Estrutura</span>
                  <span className="text-[12px] font-medium">
                    {ESTRUTURAS_CONFIRMADAS.find(e => e.value === resultado.estrutura_confirmada)?.label ?? resultado.estrutura_confirmada}
                  </span>
                </div>
              )}
              {resultado?.valor_estimado && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Valor estimado</span>
                  <span className="text-[12px] font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(resultado.valor_estimado)}
                  </span>
                </div>
              )}
              {resultado?.resultado_geral && (
                <div className="px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60 block mb-1">Resultado geral</span>
                  <p className="text-[12px]">{resultado.resultado_geral}</p>
                </div>
              )}
              {resultado?.decisao_cliente && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Decisão</span>
                  <Badge
                    variant="outline"
                    className={
                      resultado.decisao_cliente === 'avançar'
                        ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                        : resultado.decisao_cliente === 'nao_avançar'
                        ? 'text-destructive border-destructive/30 bg-destructive/10'
                        : 'text-amber-600 border-amber-500/30 bg-amber-500/10'
                    }
                  >
                    {DECISOES.find(d => d.value === resultado.decisao_cliente)?.label ?? resultado.decisao_cliente}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-5 gap-2">
              <p className="text-[12px] text-muted-foreground/50">Resultado da IUL Implementation não registrado</p>
              <Button variant="outline" size="sm" onClick={startEditing} className="h-7 px-3 text-xs rounded-[4px]">
                Preencher
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="border border-border rounded-[2px] p-4 space-y-4">
          {/* Estrutura confirmada */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estrutura confirmada</Label>
            <Select value={estrutura} onValueChange={setEstrutura}>
              <SelectTrigger className="h-8 rounded-[4px] text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {ESTRUTURAS_CONFIRMADAS.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor estimado */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor estimado (R$)</Label>
            <Input type="number" min={0} value={valorEstimado} onChange={e => setValorEstimado(e.target.value)} placeholder="Ex: 50000" className="h-8 rounded-[4px] text-xs" />
          </div>

          {/* Comparecimento */}
          <div className="flex items-center gap-3">
            <Switch checked={compareceu} onCheckedChange={setCompareceu} />
            <Label className="text-xs text-muted-foreground">Cliente compareceu</Label>
          </div>

          {/* Resultado geral */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Resultado geral <span className="text-destructive">*</span>
            </Label>
            <Textarea value={resultadoGeral} onChange={e => setResultadoGeral(e.target.value)} placeholder="Descreva o resultado da reunião..." className="min-h-[80px] text-xs rounded-[4px]" />
          </div>

          {/* Decisão do cliente */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Decisão do cliente <span className="text-destructive">*</span>
            </Label>
            <Select value={decisao} onValueChange={setDecisao}>
              <SelectTrigger className="h-8 rounded-[4px] text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {DECISOES.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Avisos contextuais por decisão */}
            {decisao === 'avançar' && (
              <p className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
                <Trophy className="w-3 h-3" />
                Referral moverá para "Em contratação"
              </p>
            )}
            {decisao === 'nao_avançar' && (
              <p className="flex items-center gap-1 text-[11px] text-destructive mt-1">
                <AlertTriangle className="w-3 h-3" />
                Abrirá o fluxo de encerramento como Perdido
              </p>
            )}
            {decisao === 'continuar' && (
              <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                <ArrowRight className="w-3 h-3" />
                Solicitará definição de próxima ação
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saveR3.isPending} className="h-7 px-3 text-xs rounded-[4px] gap-1">
              <X className="w-3 h-3" />Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave} className="h-7 px-3 text-xs rounded-[4px] gap-1">
              {saveR3.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Salvar e aplicar decisão
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export { STAGE_EM_CONTRATACAO };
export default AltioraR3Section;
