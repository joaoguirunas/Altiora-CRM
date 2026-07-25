/**
 * ALTIORA-17 UC26: Seção "Resultado da R2" na ficha do referral.
 *
 * AC1: Campos: produto apresentado, objeções, nível de interesse, resultado geral, data prevista R3
 * AC2: Contexto da R1 (read-only) exibido acima do formulário
 * AC3: Alerta quando Análise Finvity não registrada
 * AC4: Persiste em altiora_r2_data + next_action_due_at
 * AC5: Visível apenas em etapa >= R2 realizada (position 8)
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
import {
  Edit2, Check, X, Loader2, Clock, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useR1Data, type DiagnosticoR1 } from '@/hooks/useAltioraR1Data';
import { useR2Data, useSaveR2Data, type ResultadoR2 } from '@/hooks/useAltioraR2Data';
import { useFinvityAnalise } from '@/hooks/useAltioraFinvity';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const R2_REALIZADA_MIN_POSITION = 8;

const PRODUTOS_R2 = [
  { value: 'previdencia',          label: 'Previdência' },
  { value: 'seguro_vida',          label: 'Seguro de vida' },
  { value: 'investimentos',        label: 'Investimentos' },
  { value: 'protecao_patrimonial', label: 'Proteção patrimonial' },
  { value: 'combo',                label: 'Combo' },
];

const NIVEIS_INTERESSE = [
  { value: 'alto',           label: 'Alto' },
  { value: 'medio',          label: 'Médio' },
  { value: 'baixo',          label: 'Baixo' },
  { value: 'sem_interesse',  label: 'Sem interesse' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface AltioraR2SectionProps {
  leadId: string;
  currentStagePosition?: number;
}

const AltioraR2Section = ({ leadId, currentStagePosition = 0 }: AltioraR2SectionProps) => {
  const { user } = useAuth();
  const { data: r1Data } = useR1Data(leadId);
  const { data: r2Data, isLoading } = useR2Data(leadId);
  const { data: finvityData } = useFinvityAnalise(leadId);
  const saveR2 = useSaveR2Data();

  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [produtoApresentado, setProdutoApresentado] = useState('');
  const [objecoes, setObjecoes] = useState('');
  const [nivelInteresse, setNivelInteresse] = useState('');
  const [resultadoGeral, setResultadoGeral] = useState('');
  const [dataR3Prevista, setDataR3Prevista] = useState('');

  const resultado = r2Data?.resultado as ResultadoR2 | undefined;
  const r1Diagnostico = r1Data?.diagnostico as DiagnosticoR1 | undefined;
  const finvityPreenchida = !!(finvityData?.finvity_link || finvityData?.finvity_arquivo_url);
  const isFilled = !!(resultado?.produto_apresentado || resultado?.resultado_geral);

  // AC5: hide if stage < R2 realizada
  if (currentStagePosition < R2_REALIZADA_MIN_POSITION) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Resultado da R2</p>
        <div className="flex items-center gap-2 p-3 rounded-[4px] border border-dashed border-border/40 text-muted-foreground/50">
          <Clock className="w-4 h-4 flex-none" strokeWidth={1.5} />
          <span className="text-[12px]">Preencher após a R2</span>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setProdutoApresentado(resultado?.produto_apresentado ?? '');
    setObjecoes(resultado?.objecoes ?? '');
    setNivelInteresse(resultado?.nivel_interesse ?? '');
    setResultadoGeral(resultado?.resultado_geral ?? '');
    setDataR3Prevista(r2Data?.data_r3_prevista ?? '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const needsR3 = nivelInteresse === 'alto' || nivelInteresse === 'medio';
    if (needsR3 && !dataR3Prevista) {
      return; // prazo da R3 obrigatório quando interesse alto/médio
    }
    await saveR2.mutateAsync({
      leadId,
      actorId: user.id,
      resultado: {
        produto_apresentado: produtoApresentado || undefined,
        objecoes:            objecoes.trim() || undefined,
        nivel_interesse:     nivelInteresse || undefined,
        resultado_geral:     resultadoGeral.trim() || undefined,
      },
      dataR3Prevista: dataR3Prevista || undefined,
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Resultado da R2</p>
        <div className="flex justify-center py-5"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" /></div>
      </div>
    );
  }

  const needsR3 = nivelInteresse === 'alto' || nivelInteresse === 'medio';
  const canSave = resultadoGeral.trim().length > 0 && (!needsR3 || dataR3Prevista) && !saveR2.isPending;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">Resultado da R2</p>
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

      {/* AC3: Alerta Finvity pendente */}
      {!finvityPreenchida && (
        <div className="flex items-center gap-2 p-2.5 rounded-[4px] border border-amber-500/30 bg-amber-500/5 text-amber-600">
          <AlertTriangle className="w-4 h-4 flex-none" strokeWidth={1.5} />
          <p className="text-[11px]">Análise Finvity pendente — preencha antes de prosseguir.</p>
        </div>
      )}

      {/* AC2: Contexto R1 (read-only) */}
      {r1Diagnostico && (r1Diagnostico.situacao_patrimonial || r1Diagnostico.perfil_risco) && (
        <div className="border border-border/50 rounded-[2px] overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-3 py-1.5 bg-muted/20">
            Contexto R1
          </p>
          <div className="divide-y divide-border/30">
            {r1Diagnostico.situacao_patrimonial && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[11px] text-muted-foreground/60">Situação patrimonial</span>
                <span className="text-[11px] font-medium">{r1Diagnostico.situacao_patrimonial}</span>
              </div>
            )}
            {r1Diagnostico.perfil_risco && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[11px] text-muted-foreground/60">Perfil risco</span>
                <span className="text-[11px] font-medium capitalize">{r1Diagnostico.perfil_risco}</span>
              </div>
            )}
            {r1Diagnostico.score_interesse && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[11px] text-muted-foreground/60">Score de interesse R1</span>
                <span className="text-[11px] font-medium">{r1Diagnostico.score_interesse}/5</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View mode */}
      {!isEditing && (
        <div className="border border-border rounded-[2px] overflow-hidden">
          {isFilled ? (
            <div className="divide-y divide-border/50">
              {resultado?.produto_apresentado && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Produto apresentado</span>
                  <span className="text-[12px] font-medium">
                    {PRODUTOS_R2.find(p => p.value === resultado.produto_apresentado)?.label ?? resultado.produto_apresentado}
                  </span>
                </div>
              )}
              {resultado?.nivel_interesse && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Nível de interesse</span>
                  <span className="text-[12px] font-medium">
                    {NIVEIS_INTERESSE.find(n => n.value === resultado.nivel_interesse)?.label ?? resultado.nivel_interesse}
                  </span>
                </div>
              )}
              {resultado?.resultado_geral && (
                <div className="px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60 block mb-1">Resultado geral</span>
                  <p className="text-[12px]">{resultado.resultado_geral}</p>
                </div>
              )}
              {r2Data?.data_r3_prevista && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-muted-foreground/60">Data prevista R3</span>
                  <span className="text-[12px] font-medium">
                    {new Date(r2Data.data_r3_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-5 gap-2">
              <p className="text-[12px] text-muted-foreground/50">Resultado da R2 não registrado</p>
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
          {/* Produto apresentado */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Produto apresentado</Label>
            <Select value={produtoApresentado} onValueChange={setProdutoApresentado}>
              <SelectTrigger className="h-8 rounded-[4px] text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {PRODUTOS_R2.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Objeções */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Objeções levantadas</Label>
            <Textarea value={objecoes} onChange={e => setObjecoes(e.target.value)} placeholder="Descreva as objeções..." className="min-h-[70px] text-xs rounded-[4px]" />
          </div>

          {/* Nível de interesse */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nível de interesse</Label>
            <Select value={nivelInteresse} onValueChange={setNivelInteresse}>
              <SelectTrigger className="h-8 rounded-[4px] text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-[4px]">
                {NIVEIS_INTERESSE.map(n => (
                  <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resultado geral */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Resultado geral <span className="text-destructive">*</span>
            </Label>
            <Textarea value={resultadoGeral} onChange={e => setResultadoGeral(e.target.value)} placeholder="Descreva o resultado..." className="min-h-[80px] text-xs rounded-[4px]" />
          </div>

          {/* Data prevista R3 — obrigatória se interesse alto/médio */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Data prevista da R3
              {needsR3 && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              type="date"
              value={dataR3Prevista}
              onChange={e => setDataR3Prevista(e.target.value)}
              className={cn('h-8 rounded-[4px] text-xs', needsR3 && !dataR3Prevista && 'border-destructive')}
            />
            {needsR3 && !dataR3Prevista && (
              <p className="text-[11px] text-destructive mt-1">Obrigatório quando nível de interesse é alto ou médio</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saveR2.isPending} className="h-7 px-3 text-xs rounded-[4px] gap-1">
              <X className="w-3 h-3" />Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave} className="h-7 px-3 text-xs rounded-[4px] gap-1">
              {saveR2.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AltioraR2Section;
