/**
 * AltioraFinvitySection — Seção "Análise Finvity" na ficha do referral
 *
 * ALTIORA-16 / UC25 — Registrar Análise do Finvity
 *
 * ACs implementados:
 *   AC1: campos link (URL https://) ou upload PDF (<5MB), dores, necessidades, produtos
 *   AC2: validação de URL inline
 *   AC3: persistência em altiora_finvity_analise + badge verde quando preenchido
 *   AC4: alerta laranja quando R2+ sem Finvity
 *   AC5: upload via Supabase Storage bucket referral-docs/{lead_id}/finvity/
 */
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Link2, Upload, CheckCircle2, AlertTriangle, FileText,
  Save, X, Plus, Trash2, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFinvityAnalise,
  useSaveFinvityAnalise,
  useUploadFinvityArquivo,
} from '@/hooks/useAltioraFinvity';

// ── Constants ─────────────────────────────────────────────────────────────────

// Etapas Altiora onde o Finvity é relevante/obrigatório (UC25)
// position >= 7 significa R2 agendada ou posterior (AC4)
const R2_STAGE_MIN_POSITION = 7;

// Produtos Altiora disponíveis (expandir conforme o playbook)
const PRODUTOS_ALTIORA = [
  'Seguro de vida',
  'Previdência privada',
  'Seguro de saúde',
  'Seguro residencial',
  'Seguro empresarial',
  'Plano odontológico',
  'Seguro auto',
  'Seguro viagem',
  'Consórcio',
  'Capitalização',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return 'URL inválida — use https://';
    }
    if (!parsed.hostname) return 'URL inválida';
    return null;
  } catch {
    return 'URL inválida';
  }
}

// AC2: preferimos https://
function validateHttpsUrl(url: string): string | null {
  if (!url) return null;
  const base = validateUrl(url);
  if (base) return base;
  if (!url.startsWith('https://')) return 'URL inválida — use https://';
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AltioraFinvitySectionProps {
  leadId: string;
  /** Índice da etapa atual no pipeline (1-based) para controle de alerta AC4 */
  currentStagePosition?: number;
}

const AltioraFinvitySection = ({ leadId, currentStagePosition }: AltioraFinvitySectionProps) => {
  const { data: analise, isLoading } = useFinvityAnalise(leadId);
  const save = useSaveFinvityAnalise();
  const uploadArquivo = useUploadFinvityArquivo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [finvityLink, setFinvityLink] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dores, setDores] = useState<string[]>([]);
  const [dorInput, setDorInput] = useState('');
  const [necessidades, setNecessidades] = useState<string[]>([]);
  const [necessidadeInput, setNecessidadeInput] = useState('');
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [notas, setNotas] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Sync form from persisted data
  useEffect(() => {
    if (analise) {
      setFinvityLink(analise.finvity_link ?? '');
      setDores(analise.dores ?? []);
      setNecessidades(analise.necessidades ?? []);
      setProdutosSelecionados(analise.produtos_sugeridos ?? []);
      setNotas(analise.notas ?? '');
    }
  }, [analise]);

  const isPreenchido = !!(analise?.finvity_link || analise?.finvity_arquivo_url);

  // AC4: alerta quando R2+ sem Finvity
  const showAlert = !!(
    currentStagePosition &&
    currentStagePosition >= R2_STAGE_MIN_POSITION &&
    !isPreenchido
  );

  const handleUrlChange = (val: string) => {
    setFinvityLink(val);
    setUrlError(val ? validateHttpsUrl(val) : null);
  };

  const handleAddDor = () => {
    const trimmed = dorInput.trim();
    if (trimmed && !dores.includes(trimmed)) {
      setDores(prev => [...prev, trimmed]);
    }
    setDorInput('');
  };

  const handleAddNecessidade = () => {
    const trimmed = necessidadeInput.trim();
    if (trimmed && !necessidades.includes(trimmed)) {
      setNecessidades(prev => [...prev, trimmed]);
    }
    setNecessidadeInput('');
  };

  const toggleProduto = (produto: string) => {
    setProdutosSelecionados(prev =>
      prev.includes(produto) ? prev.filter(p => p !== produto) : [...prev, produto]
    );
  };

  const handleSave = async () => {
    // AC2: valida URL antes de salvar
    if (finvityLink) {
      const err = validateHttpsUrl(finvityLink);
      if (err) {
        setUrlError(err);
        return;
      }
    }

    await save.mutateAsync({
      lead_id: leadId,
      finvity_link: finvityLink || null,
      dores,
      necessidades,
      produtos_sugeridos: produtosSelecionados,
      notas: notas || null,
    });
    setIsEditing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const publicUrl = await uploadArquivo.mutateAsync({ file, leadId });
      // Após upload, salva a URL pública em finvity_arquivo_url (AC5)
      await save.mutateAsync({
        lead_id: leadId,
        finvity_arquivo_url: publicUrl,
        dores,
        necessidades,
        produtos_sugeridos: produtosSelecionados,
        notas: notas || null,
      });
    } catch {
      // errors handled inside hook
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelEdit = () => {
    // Revert to persisted state
    if (analise) {
      setFinvityLink(analise.finvity_link ?? '');
      setDores(analise.dores ?? []);
      setNecessidades(analise.necessidades ?? []);
      setProdutosSelecionados(analise.produtos_sugeridos ?? []);
      setNotas(analise.notas ?? '');
    }
    setUrlError(null);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-[2px] p-4 flex items-center gap-2 text-muted-foreground/50 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando análise Finvity...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header com badge de preenchido (AC3) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Análise Finvity
          </p>
          {isPreenchido && (
            <Badge variant="outline" className="h-[18px] text-[10px] px-1.5 gap-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/8">
              <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
              Preenchido
            </Badge>
          )}
        </div>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-[30px] px-2 text-xs text-muted-foreground/60 hover:text-foreground gap-1 rounded-[4px]"
          >
            {isPreenchido ? 'Editar' : 'Preencher'}
          </Button>
        )}
      </div>

      {/* AC4: alerta laranja quando R2+ sem Finvity */}
      {showAlert && (
        <div className="flex items-start gap-2 p-3 rounded-[4px] border border-orange-500/30 bg-orange-500/8 text-orange-600 dark:text-orange-400">
          <AlertTriangle className="w-4 h-4 flex-none mt-0.5" strokeWidth={1.5} />
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Análise Finvity não registrada</span> — referral já está em etapa R2 ou posterior.
            Preencha o relatório para embasar a reunião.
          </p>
        </div>
      )}

      {/* Conteúdo */}
      <div className="border border-border rounded-[2px] overflow-hidden">
        {!isEditing ? (
          /* ── Modo visualização ── */
          isPreenchido ? (
            <div className="divide-y divide-border">
              {/* Link */}
              {analise?.finvity_link && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link2 className="w-4 h-4 text-muted-foreground/50 flex-none" strokeWidth={1.5} />
                  <a
                    href={analise.finvity_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-primary hover:underline truncate"
                  >
                    {analise.finvity_link}
                  </a>
                </div>
              )}
              {/* Arquivo PDF */}
              {analise?.finvity_arquivo_url && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <FileText className="w-4 h-4 text-muted-foreground/50 flex-none" strokeWidth={1.5} />
                  <a
                    href={analise.finvity_arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-primary hover:underline truncate"
                  >
                    Relatório Finvity (PDF)
                  </a>
                </div>
              )}
              {/* Dores */}
              {analise?.dores && analise.dores.length > 0 && (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground/50 uppercase font-semibold tracking-wide">Dores identificadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analise.dores.map((d, i) => (
                      <Badge key={i} variant="secondary" className="text-[11px] rounded-[2px]">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Necessidades */}
              {analise?.necessidades && analise.necessidades.length > 0 && (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground/50 uppercase font-semibold tracking-wide">Necessidades mapeadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analise.necessidades.map((n, i) => (
                      <Badge key={i} variant="secondary" className="text-[11px] rounded-[2px]">{n}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Produtos */}
              {analise?.produtos_sugeridos && analise.produtos_sugeridos.length > 0 && (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground/50 uppercase font-semibold tracking-wide">Produtos sugeridos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analise.produtos_sugeridos.map((p, i) => (
                      <Badge key={i} className="text-[11px] rounded-[2px] bg-primary/10 text-primary border-primary/20">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Notas */}
              {analise?.notas && (
                <div className="px-4 py-3 space-y-1">
                  <p className="text-[11px] text-muted-foreground/50 uppercase font-semibold tracking-wide">Notas</p>
                  <p className="text-[13px] text-foreground/80 whitespace-pre-wrap">{analise.notas}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1} />
              <p className="text-[13px] text-muted-foreground/50">Análise Finvity não registrada</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="mt-3 h-[30px] px-3 text-xs rounded-[4px]"
              >
                Registrar agora
              </Button>
            </div>
          )
        ) : (
          /* ── Modo edição ── */
          <div className="p-4 space-y-5">

            {/* Link URL (AC1, AC2) */}
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                Link do relatório Finvity (https://)
              </Label>
              <Input
                value={finvityLink}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://app.finvity.com.br/relatorio/..."
                className={cn("h-[30px] rounded-[4px] text-[13px]", urlError && "border-destructive")}
              />
              {urlError && (
                <p className="text-[11px] text-destructive">{urlError}</p>
              )}
            </div>

            {/* Upload PDF (AC1, AC5) */}
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                Ou anexar PDF do relatório (máx. 5MB)
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadArquivo.isPending}
                  className="h-[30px] text-xs rounded-[4px] gap-1.5"
                >
                  {uploadArquivo.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" /> Selecionar PDF</>
                  )}
                </Button>
                {analise?.finvity_arquivo_url && (
                  <span className="text-[12px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    PDF anexado
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Dores identificadas (AC1) */}
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">Dores identificadas</Label>
              <div className="flex gap-2">
                <Input
                  value={dorInput}
                  onChange={(e) => setDorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDor())}
                  placeholder="Ex: Falta de proteção financeira..."
                  className="h-[30px] rounded-[4px] text-[13px] flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddDor}
                  className="h-[30px] w-[30px] p-0 rounded-[4px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {dores.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {dores.map((d, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px] rounded-[2px] gap-1 pr-1">
                      {d}
                      <button
                        onClick={() => setDores(prev => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Necessidades mapeadas (AC1) */}
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">Necessidades mapeadas</Label>
              <div className="flex gap-2">
                <Input
                  value={necessidadeInput}
                  onChange={(e) => setNecessidadeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNecessidade())}
                  placeholder="Ex: Cobertura de renda por incapacidade..."
                  className="h-[30px] rounded-[4px] text-[13px] flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddNecessidade}
                  className="h-[30px] w-[30px] p-0 rounded-[4px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {necessidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {necessidades.map((n, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px] rounded-[2px] gap-1 pr-1">
                      {n}
                      <button
                        onClick={() => setNecessidades(prev => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Produtos sugeridos — multiselect (AC1) */}
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">Produtos sugeridos pela análise</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRODUTOS_ALTIORA.map((produto) => (
                  <button
                    key={produto}
                    type="button"
                    onClick={() => toggleProduto(produto)}
                    className={cn(
                      "inline-flex items-center h-[28px] px-2.5 text-[11px] rounded-[2px] border transition-colors",
                      produtosSelecionados.includes(produto)
                        ? "bg-primary/15 border-primary/40 text-primary font-medium"
                        : "bg-transparent border-border text-muted-foreground/60 hover:border-muted-foreground/40 hover:text-foreground/70"
                    )}
                  >
                    {produto}
                  </button>
                ))}
              </div>
            </div>

            {/* Notas adicionais */}
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">Notas adicionais</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observações do Closer sobre a análise..."
                className="min-h-[80px] rounded-[4px] text-[13px]"
              />
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={save.isPending}
                className="h-[30px] px-3 text-xs rounded-[4px]"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={save.isPending || !!urlError}
                className="h-[30px] px-3 text-xs rounded-[4px] gap-1.5"
              >
                {save.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="w-3.5 h-3.5" /> Salvar</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AltioraFinvitySection;
