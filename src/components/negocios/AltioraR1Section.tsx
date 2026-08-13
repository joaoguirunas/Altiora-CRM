/**
 * ALTIORA-15 UC24: Seção "Diagnóstico R1" na ficha do referral.
 *
 * Campos do playbook Altiora pós-R1:
 *  - Situação patrimonial, Renda mensal, Perfil de risco
 *  - Produtos de interesse (multiselect)
 *  - Objeções identificadas, Score de interesse (1-5 stars), Data prevista da R2
 *  - Observações adicionais
 *
 * AC5: Visível apenas quando stage >= posição 5 (R1 realizada).
 *      Nas etapas anteriores, exibe "Preencher após a R1".
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ClipboardList, Edit2, Check, X, Star, Loader2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useR1Data, useSaveR1Data, type DiagnosticoR1 } from '@/hooks/useAltioraR1Data';

// ── Constants ─────────────────────────────────────────────────────────────────

const R1_REALIZADA_MIN_POSITION = 5;

const SITUACOES_PATRIMONIAIS = [
  { value: 'acima_300k', label: 'Acima de R$300k' },
  { value: '150k_300k', label: 'R$150k – R$300k' },
  { value: 'abaixo_150k', label: 'Abaixo de R$150k' },
];

const PERFIS_RISCO = [
  { value: 'conservador', label: 'Conservador' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'arrojado', label: 'Arrojado' },
];

const PRODUTOS_ALTIORA_R1 = [
  'Previdência',
  'Seguro de vida',
  'Investimentos',
  'Proteção patrimonial',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getLabelPatrimonial = (v?: string) =>
  SITUACOES_PATRIMONIAIS.find(s => s.value === v)?.label ?? v ?? '—';

const getLabelRisco = (v?: string) =>
  PERFIS_RISCO.find(p => p.value === v)?.label ?? v ?? '—';

// ── Component ─────────────────────────────────────────────────────────────────

interface AltioraR1SectionProps {
  leadId: string;
  currentStagePosition?: number;
}

const AltioraR1Section = ({ leadId, currentStagePosition = 0 }: AltioraR1SectionProps) => {
  const { user } = useAuth();
  const { data: r1Data, isLoading } = useR1Data(leadId);
  const saveR1Data = useSaveR1Data();

  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [situacaoPatrimonial, setSituacaoPatrimonial] = useState('');
  const [rendaMensal, setRendaMensal] = useState('');
  const [perfilRisco, setPerfilRisco] = useState('');
  const [produtosInteresse, setProdutosInteresse] = useState<string[]>([]);
  const [objecoes, setObjecoes] = useState('');
  const [scoreInteresse, setScoreInteresse] = useState(0);
  const [dataR2Prevista, setDataR2Prevista] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const diagnostico = r1Data?.diagnostico as DiagnosticoR1 | undefined;
  const isFilled = !!diagnostico && (
    !!diagnostico.situacao_patrimonial ||
    !!diagnostico.perfil_risco ||
    (diagnostico.produtos_interesse?.length ?? 0) > 0
  );

  const startEditing = () => {
    setSituacaoPatrimonial(diagnostico?.situacao_patrimonial ?? '');
    setRendaMensal(diagnostico?.renda_mensal_estimada?.toString() ?? '');
    setPerfilRisco(diagnostico?.perfil_risco ?? '');
    setProdutosInteresse(diagnostico?.produtos_interesse ?? []);
    setObjecoes(diagnostico?.objecoes ?? '');
    setScoreInteresse(diagnostico?.score_interesse ?? 0);
    setDataR2Prevista(r1Data?.data_r2_prevista ?? '');
    setObservacoes(diagnostico?.observacoes ?? '');
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const handleSave = async () => {
    if (!user?.id) return;
    await saveR1Data.mutateAsync({
      leadId,
      actorId: user.id,
      diagnostico: {
        situacao_patrimonial:   situacaoPatrimonial || undefined,
        renda_mensal_estimada:  rendaMensal ? parseFloat(rendaMensal) : undefined,
        perfil_risco:           perfilRisco || undefined,
        produtos_interesse:     produtosInteresse.length > 0 ? produtosInteresse : undefined,
        objecoes:               objecoes.trim() || undefined,
        score_interesse:        scoreInteresse > 0 ? scoreInteresse : undefined,
        observacoes:            observacoes.trim() || undefined,
      },
      dataR2Prevista:           dataR2Prevista || undefined,
    });
    setIsEditing(false);
  };

  const toggleProduto = (produto: string) => {
    setProdutosInteresse(prev =>
      prev.includes(produto) ? prev.filter(p => p !== produto) : [...prev, produto],
    );
  };

  // AC5: etapas anteriores a R1 realizada
  if (currentStagePosition < R1_REALIZADA_MIN_POSITION) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Diagnóstico — Wealth Planning Discovery
        </p>
        <div className="flex items-center gap-2 p-3 rounded-[4px] border border-dashed border-border/40 text-muted-foreground/50">
          <Clock className="w-4 h-4 flex-none" strokeWidth={1.5} />
          <span className="text-[12px]">Preencher após a Wealth Planning Discovery</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Diagnóstico — Wealth Planning Discovery
        </p>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Diagnóstico — Wealth Planning Discovery
        </p>
        <div className="flex items-center gap-2">
          {isFilled && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 rounded-[2px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
            >
              Preenchido
            </Badge>
          )}
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditing}
              className="h-6 px-2 text-[11px] gap-1 rounded-[2px]"
            >
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
              {diagnostico?.situacao_patrimonial && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Situação patrimonial</span>
                  <span className="text-[12px] font-medium">{getLabelPatrimonial(diagnostico.situacao_patrimonial)}</span>
                </div>
              )}
              {diagnostico?.renda_mensal_estimada && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Renda mensal</span>
                  <span className="text-[12px] font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(diagnostico.renda_mensal_estimada)}
                  </span>
                </div>
              )}
              {diagnostico?.perfil_risco && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Perfil de risco</span>
                  <span className="text-[12px] font-medium capitalize">{getLabelRisco(diagnostico.perfil_risco)}</span>
                </div>
              )}
              {(diagnostico?.produtos_interesse?.length ?? 0) > 0 && (
                <div className="flex items-start justify-between px-4 py-2 gap-3">
                  <span className="text-[12px] text-muted-foreground/60 shrink-0">Produtos</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {diagnostico?.produtos_interesse?.map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-[2px]">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {diagnostico?.score_interesse && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Score de interesse</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={cn('w-3.5 h-3.5', n <= diagnostico.score_interesse! ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20')}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </div>
              )}
              {r1Data?.data_r2_prevista && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Data prevista da Wealth Planning Presentation</span>
                  <span className="text-[12px] font-medium">
                    {new Date(r1Data.data_r2_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
              {diagnostico?.objecoes && (
                <div className="px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60 block mb-1">Objeções</span>
                  <p className="text-[12px]">{diagnostico.objecoes}</p>
                </div>
              )}
              {diagnostico?.observacoes && (
                <div className="px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60 block mb-1">Observações</span>
                  <p className="text-[12px]">{diagnostico.observacoes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground/20" strokeWidth={1.5} />
              <p className="text-[12px] text-muted-foreground/50">
                Diagnóstico da Wealth Planning Discovery não registrado
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                className="h-7 px-3 text-xs rounded-[4px] mt-1"
              >
                Preencher diagnóstico
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="border border-border rounded-[2px] p-4 space-y-4">
          {/* Situação patrimonial */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Situação patrimonial
            </Label>
            <Select value={situacaoPatrimonial} onValueChange={setSituacaoPatrimonial}>
              <SelectTrigger className="h-8 rounded-[4px] text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {SITUACOES_PATRIMONIAIS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Renda mensal */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Renda mensal estimada (R$)
            </Label>
            <Input
              type="number"
              min={0}
              value={rendaMensal}
              onChange={e => setRendaMensal(e.target.value)}
              placeholder="Ex: 15000"
              className="h-8 rounded-[4px] text-xs"
            />
          </div>

          {/* Perfil de risco */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Perfil de risco
            </Label>
            <Select value={perfilRisco} onValueChange={setPerfilRisco}>
              <SelectTrigger className="h-8 rounded-[4px] text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {PERFIS_RISCO.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Produtos de interesse */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Produtos de interesse
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRODUTOS_ALTIORA_R1.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProduto(p)}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border transition-colors',
                    produtosInteresse.includes(p)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Objeções */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Objeções identificadas
            </Label>
            <Textarea
              value={objecoes}
              onChange={e => setObjecoes(e.target.value)}
              placeholder="Descreva as objeções levantadas..."
              className="min-h-[70px] text-xs rounded-[4px]"
            />
          </div>

          {/* Score de interesse */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Score de interesse
            </Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScoreInteresse(scoreInteresse === n ? 0 : n)}
                  className="p-0.5 hover:scale-110 transition-transform"
                >
                  <Star
                    className={cn('w-5 h-5 transition-colors',
                      n <= scoreInteresse ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20',
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
              {scoreInteresse > 0 && (
                <span className="text-[11px] text-muted-foreground/60 ml-1">{scoreInteresse}/5</span>
              )}
            </div>
          </div>

          {/* Data prevista da Wealth Planning Presentation */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Data prevista da Wealth Planning Presentation
            </Label>
            <Input
              type="date"
              value={dataR2Prevista}
              onChange={e => setDataR2Prevista(e.target.value)}
              className="h-8 rounded-[4px] text-xs"
            />
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Observações adicionais
            </Label>
            <Textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Observações gerais sobre a R1..."
              className="min-h-[70px] text-xs rounded-[4px]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={saveR1Data.isPending}
              className="h-7 px-3 text-xs rounded-[4px] gap-1"
            >
              <X className="w-3 h-3" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveR1Data.isPending}
              className="h-7 px-3 text-xs rounded-[4px] gap-1"
            >
              {saveR1Data.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AltioraR1Section;
