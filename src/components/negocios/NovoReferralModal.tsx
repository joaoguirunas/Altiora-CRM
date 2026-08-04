/**
 * NovoReferralModal — Modal de cadastro manual de referral Altiora
 *
 * ALTIORA-06 / UC11 — Cadastrar Referral Manualmente
 *
 * ACs implementados:
 *   AC1: campos nome, e-mail, telefone, origem, data handoff, observações
 *   AC2: deduplicação por e-mail/telefone + dialog de confirmação
 *   AC3: referral criado em "Novo referral" com source='manual' e created_by
 *   AC4: controle de exibição por perfil (gestor_comercial | admin)
 *   AC5: validação inline de e-mail e telefone
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ExternalLink, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

// Tabelas Altiora não estão nos tipos gerados — usar cliente não tipado
const sbUntyped = supabase as unknown as SupabaseClient;
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ── Constants — migration 20260725100000_altiora_pipeline.sql ───────────────

const ALTIORA_PIPELINE_ID = 'a1000000-0000-0000-0000-000000000001';
const ALTIORA_STAGE_NOVO_REFERRAL = 'a1000000-0000-0000-0001-000000000001';

// ── Types ────────────────────────────────────────────────────────────────────

interface DuplicateResult {
  id: string;
  pessoa?: { name: string; email?: string; whatsapp?: string };
}

interface NovoReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

// ── Validation helpers ───────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  if (!email) return 'E-mail é obrigatório';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'E-mail inválido';
}

function validatePhone(phone: string): string | null {
  if (!phone) return 'Telefone é obrigatório';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? null : 'Telefone deve ter pelo menos 10 dígitos';
}

function formatPhoneForStorage(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Adiciona +55 se não tiver código de país
  if (!phone.startsWith('+')) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const NovoReferralModal = ({ isOpen, onClose, currentUserId }: NovoReferralModalProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [origem, setOrigem] = useState<string>('');
  const [dataHandoff, setDataHandoff] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deduplication state (AC2)
  const [duplicados, setDuplicados] = useState<DuplicateResult[]>([]);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [justificativaDup, setJustificativaDup] = useState('');

  // ── Validate form ──────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) newErrors.nome = 'Nome é obrigatório';

    const emailErr = validateEmail(email);
    if (emailErr) newErrors.email = emailErr;

    const phoneErr = validatePhone(telefone);
    if (phoneErr) newErrors.telefone = phoneErr;

    if (!origem) newErrors.origem = 'Origem é obrigatória';
    if (!dataHandoff) newErrors.dataHandoff = 'Data do handoff é obrigatória';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Check duplicates (AC2) ─────────────────────────────────────────────────

  const checkDuplicates = async (): Promise<DuplicateResult[]> => {
    const phoneFormatted = formatPhoneForStorage(telefone);

    const { data, error } = await sbUntyped
      .from('leads')
      .select(`
        id,
        pessoa:clients_people!leads_people_id_fkey (name, email, whatsapp)
      `)
      .eq('leads_pipelines_id', ALTIORA_PIPELINE_ID)
      .neq('status', 'lost')
      .or(
        `pessoa.email.eq.${email.trim()},pessoa.whatsapp.eq.${phoneFormatted}`
      )
      .limit(5);

    if (error) {
      console.error('Erro ao verificar duplicatas:', error);
      return [];
    }

    return (data ?? []) as unknown as DuplicateResult[];
  };

  // ── Create referral ────────────────────────────────────────────────────────

  const createReferral = async (justificativa?: string) => {
    setIsSubmitting(true);
    try {
      // 1. Criar pessoa
      const { data: pessoaCriada, error: pessoaErr } = await supabase
        .from('clients_people')
        .insert({
          name: nome.trim(),
          email: email.trim() || null,
          whatsapp: formatPhoneForStorage(telefone) || null,
          status: 'active',
          ai_enabled: false,
          notes: observacoes.trim() || null,
        })
        .select()
        .single();

      if (pessoaErr) throw pessoaErr;

      // 2. Criar lead no pipeline Altiora (AC3)
      type LeadInsert = {
        people_id: string;
        leads_pipelines_id: string;
        leads_stages_id: string;
        status: string;
        value: number;
        title: string;
        altiora_origem: string;
        altiora_data_handoff: string | null;
        users_id: string | null;
        metadata?: Record<string, string>;
      };
      const leadPayload: LeadInsert = {
        people_id: pessoaCriada.id,
        leads_pipelines_id: ALTIORA_PIPELINE_ID,
        leads_stages_id: ALTIORA_STAGE_NOVO_REFERRAL,
        status: 'in_progress',
        value: 0,
        title: `Referral — ${pessoaCriada.name}`,
        // Campos Altiora — migration 20260725120000_altiora_leads_referral.sql
        altiora_origem: 'manual',
        altiora_data_handoff: dataHandoff
          ? new Date(dataHandoff).toISOString()
          : null,
        // AC3: registra usuário criador
        users_id: currentUserId ?? null,
      };

      // Metadados de deduplicação quando criado com justificativa
      if (justificativa) {
        leadPayload.metadata = {
          duplicata_justificativa: justificativa,
          duplicata_confirmado_em: new Date().toISOString(),
        };
      }

      const { data: leadCriado, error: leadErr } = await sbUntyped
        .from('leads')
        .insert(leadPayload)
        .select()
        .single();

      if (leadErr) {
        // Compensação: remover pessoa criada se lead falhou
        await supabase.from('clients_people').delete().eq('id', pessoaCriada.id);
        throw leadErr;
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['negocios-por-etapa'] });
      queryClient.invalidateQueries({ queryKey: ['pessoas'] });

      toast.success(`Referral "${pessoaCriada.name}" criado com sucesso!`);
      handleClose();

      // Navegar para o referral criado
      navigate(`/crm/kanban/${leadCriado.id}`);
    } catch (error) {
      console.error('Erro ao criar referral:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao criar referral. Tente novamente.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;

    // AC2: verificar duplicatas
    const dups = await checkDuplicates();
    if (dups.length > 0) {
      setDuplicados(dups);
      setShowDupDialog(true);
      return;
    }

    await createReferral();
  };

  // ── Close / Reset ──────────────────────────────────────────────────────────

  const handleClose = () => {
    setNome('');
    setEmail('');
    setTelefone('');
    setOrigem('');
    setDataHandoff('');
    setObservacoes('');
    setErrors({});
    setDuplicados([]);
    setShowDupDialog(false);
    setJustificativaDup('');
    onClose();
  };

  // ── Duplicate resolution dialog (AC2) ─────────────────────────────────────

  if (showDupDialog) {
    return (
      <Dialog open={isOpen} onOpenChange={() => { setShowDupDialog(false); }}>
        <DialogContent className="sm:max-w-md rounded-[2px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              Referrals similares encontrados
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Encontramos {duplicados.length} referral(s) com e-mail ou telefone semelhante no pipeline Altiora.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[200px] overflow-y-auto">
            {duplicados.map((dup) => (
              <div
                key={dup.id}
                className="flex items-center justify-between p-3 border border-border rounded-[2px] text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{dup.pessoa?.name}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {dup.pessoa?.email ?? ''} {dup.pessoa?.whatsapp ?? ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[30px] text-xs gap-1 rounded-[4px]"
                  onClick={() => {
                    setShowDupDialog(false);
                    handleClose();
                    navigate(`/crm/kanban/${dup.id}`);
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground/70">
              Justificativa para criar mesmo assim (obrigatória)
            </Label>
            <Textarea
              value={justificativaDup}
              onChange={(e) => setJustificativaDup(e.target.value)}
              placeholder="Ex: Cliente foi referenciado novamente por outra pessoa..."
              className="min-h-[70px] rounded-[4px] text-[13px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDupDialog(false)}
              className="h-[30px] text-xs rounded-[4px]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!justificativaDup.trim()) {
                  toast.error('Informe a justificativa para criar o referral mesmo assim.');
                  return;
                }
                setShowDupDialog(false);
                await createReferral(justificativaDup.trim());
              }}
              disabled={isSubmitting}
              className="h-[30px] text-xs rounded-[4px] gap-1.5"
            >
              {isSubmitting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando...</>
              ) : (
                'Criar mesmo assim'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Novo Referral Manual
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Cadastro manual de referral no pipeline Altiora. Preencha os dados do cliente enviado pela Avenue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground/70">
              Nome do cliente <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className={cn("h-[30px] rounded-[4px] text-[13px]", errors.nome && "border-destructive")}
              disabled={isSubmitting}
            />
            {errors.nome && <p className="text-[11px] text-destructive">{errors.nome}</p>}
          </div>

          {/* E-mail + Telefone em grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className={cn("h-[30px] rounded-[4px] text-[13px]", errors.email && "border-destructive")}
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className={cn("h-[30px] rounded-[4px] text-[13px]", errors.telefone && "border-destructive")}
                disabled={isSubmitting}
              />
              {errors.telefone && <p className="text-[11px] text-destructive">{errors.telefone}</p>}
            </div>
          </div>

          {/* Origem + Data handoff em grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                Origem do referral <span className="text-destructive">*</span>
              </Label>
              {/* migration: altiora_origem IN ('avenue_email', 'manual', 'outros') */}
              <Select value={origem} onValueChange={setOrigem} disabled={isSubmitting}>
                <SelectTrigger className={cn("h-[30px] rounded-[4px] text-[13px]", errors.origem && "border-destructive")}>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avenue_email" className="text-[13px]">Avenue (e-mail)</SelectItem>
                  <SelectItem value="manual" className="text-[13px]">Indicação interna</SelectItem>
                  <SelectItem value="outros" className="text-[13px]">Outros</SelectItem>
                </SelectContent>
              </Select>
              {errors.origem && <p className="text-[11px] text-destructive">{errors.origem}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground/70">
                Data do handoff <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={dataHandoff}
                onChange={(e) => setDataHandoff(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className={cn("h-[30px] rounded-[4px] text-[13px]", errors.dataHandoff && "border-destructive")}
                disabled={isSubmitting}
              />
              {errors.dataHandoff && <p className="text-[11px] text-destructive">{errors.dataHandoff}</p>}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground/70">
              Observações iniciais (opcional)
            </Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Contexto do referral, informações relevantes..."
              className="min-h-[80px] rounded-[4px] text-[13px]"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-[4px] h-[30px] text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-[4px] h-[30px] text-xs gap-1.5"
          >
            {isSubmitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando...</>
            ) : (
              <><UserPlus className="w-3.5 h-3.5" /> Criar Referral</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovoReferralModal;
