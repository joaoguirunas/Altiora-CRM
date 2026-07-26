/**
 * ALTIORA-20 UC28/UC29: Hooks para acompanhamento de contratação e registro de Ganho.
 *
 * Tabela: altiora_contratacao (nos tipos gerados — migration 20260725160000)
 *
 * Schema:
 *   documentos_status  (jsonb) → { status, data?, nao_aplicavel? }
 *   exames_status      (jsonb) → { status, data?, nao_aplicavel? }
 *   entrevista_financeira_status (text) → 'pendente'|'agendada'|'realizada'|'nao_aplicavel'
 *   underwriting_status          (text) → 'pendente'|'em_analise'|'aprovado'|'recusado'|'nao_aplicavel'
 *   data_emissao, parceiro_emissor, premio_confirmado, valor_final
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Stage UUID ────────────────────────────────────────────────────────────────

export const STAGE_GANHO = 'a1000000-0000-0000-0001-000000000012';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Status simples para campos JSONB (documentos_status, exames_status) */
export interface JsonChecklistStatus {
  status: 'pendente' | 'concluido' | 'nao_aplicavel';
  data?: string | null;       // YYYY-MM-DD quando concluído
  nao_aplicavel?: boolean;    // true = marcado como N/A
  observacao?: string | null;
}

export type EntrevistaStatus = 'pendente' | 'agendada' | 'realizada' | 'nao_aplicavel';
export type UnderwritingStatus = 'pendente' | 'em_analise' | 'aprovado' | 'recusado' | 'nao_aplicavel';

export interface ContratacaoRow {
  id:                           string;
  lead_id:                      string;
  parceiro_emissor:             string | null;
  data_emissao:                 string | null;
  data_confirmacao_emissao:     string | null;
  valor_final:                  number | null;
  premio_confirmado:            number | null;
  documentos_status:            JsonChecklistStatus;
  exames_status:                JsonChecklistStatus;
  entrevista_financeira_status: EntrevistaStatus;
  underwriting_status:          UnderwritingStatus;
  notas:                        string | null;
  created_at:                   string;
  updated_at:                   string;
}

export interface RegistrarGanhoPayload {
  leadId:          string;
  actorId:         string;
  parceiroEmissor: string;
  dataEmissao:     string; // YYYY-MM-DD
  valorPremio:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verifica se algum item do checklist está concluído ou nao_aplicavel */
export const isChecklistReady = (row: ContratacaoRow | null): boolean => {
  if (!row) return false;
  const docOk = row.documentos_status?.status === 'concluido' || row.documentos_status?.status === 'nao_aplicavel';
  const exmOk = row.exames_status?.status  === 'concluido' || row.exames_status?.status  === 'nao_aplicavel';
  const entOk = row.entrevista_financeira_status === 'realizada' || row.entrevista_financeira_status === 'nao_aplicavel';
  const uwOk  = row.underwriting_status === 'aprovado' || row.underwriting_status === 'recusado' || row.underwriting_status === 'nao_aplicavel';
  // Pelo menos 1 item concluído ou N/A (AC3)
  return docOk || exmOk || entOk || uwOk;
};

// ── useAltioraContratacao: lê dados de contratação ───────────────────────────

export const useAltioraContratacao = (leadId: string | undefined) => {
  return useQuery<ContratacaoRow | null>({
    queryKey: ['altiora-contratacao', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('altiora_contratacao')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;
      return data as ContratacaoRow | null;
    },
    enabled: !!leadId,
    staleTime: 2 * 60 * 1000,
  });
};

// ── useSaveDocumentos ─────────────────────────────────────────────────────────

interface SaveDocPayload {
  leadId:   string;
  actorId:  string;
  status:   JsonChecklistStatus;
}

export const useSaveDocumentos = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, actorId, status }: SaveDocPayload) => {
      const { error } = await supabase
        .from('altiora_contratacao')
        .upsert(
          { lead_id: leadId, updated_by: actorId, documentos_status: status as unknown as never },
          { onConflict: 'lead_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-contratacao', v.leadId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar documentos');
    },
  });
};

// ── useSaveExames ─────────────────────────────────────────────────────────────

export const useSaveExames = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, actorId, status }: SaveDocPayload) => {
      const { error } = await supabase
        .from('altiora_contratacao')
        .upsert(
          { lead_id: leadId, updated_by: actorId, exames_status: status as unknown as never },
          { onConflict: 'lead_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-contratacao', v.leadId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar exames');
    },
  });
};

// ── useSaveEntrevista ─────────────────────────────────────────────────────────

interface SaveEntrevistaPayload {
  leadId:   string;
  actorId:  string;
  status:   EntrevistaStatus;
}

export const useSaveEntrevista = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, actorId, status }: SaveEntrevistaPayload) => {
      const { error } = await supabase
        .from('altiora_contratacao')
        .upsert(
          { lead_id: leadId, updated_by: actorId, entrevista_financeira_status: status },
          { onConflict: 'lead_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-contratacao', v.leadId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar entrevista');
    },
  });
};

// ── useSaveUnderwriting ───────────────────────────────────────────────────────

interface SaveUWPayload {
  leadId:   string;
  actorId:  string;
  status:   UnderwritingStatus;
}

export const useSaveUnderwriting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, actorId, status }: SaveUWPayload) => {
      const { error } = await supabase
        .from('altiora_contratacao')
        .upsert(
          { lead_id: leadId, updated_by: actorId, underwriting_status: status },
          { onConflict: 'lead_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['altiora-contratacao', v.leadId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar underwriting');
    },
  });
};

// ── useRegistrarGanho ─────────────────────────────────────────────────────────

export const useRegistrarGanho = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegistrarGanhoPayload) => {
      const { leadId, actorId, parceiroEmissor, dataEmissao, valorPremio } = payload;

      // 1. Salvar dados de emissão na contratação
      const { error: c1 } = await supabase
        .from('altiora_contratacao')
        .upsert(
          {
            lead_id:                    leadId,
            updated_by:                 actorId,
            parceiro_emissor:           parceiroEmissor,
            data_emissao:               dataEmissao,
            data_confirmacao_emissao:   new Date().toISOString().split('T')[0],
            premio_confirmado:          valorPremio,
            valor_final:                valorPremio,
          },
          { onConflict: 'lead_id' },
        );
      if (c1) throw c1;

      // 2. Mover lead: status=won, stage=Ganho, value=valorPremio
      const { error: c2 } = await supabase
        .from('leads')
        .update({
          status:          'won',
          leads_stages_id: STAGE_GANHO,
          value:           valorPremio,
        })
        .eq('id', leadId);
      if (c2) throw c2;

      // 3. Registrar interação referral_won
      const { error: c3 } = await supabase
        .from('altiora_lead_interactions')
        .insert({
          lead_id:     leadId,
          actor_id:    actorId,
          type:        'referral_won',
          description: `Ganho — ${parceiroEmissor} — emissão ${new Date(dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR')}`,
          payload: {
            parceiro_emissor: parceiroEmissor,
            data_emissao:     dataEmissao,
            valor_premio:     valorPremio,
          },
        });
      if (c3) throw c3;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['negocio', v.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-contratacao', v.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', v.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      toast.success('🏆 Referral registrado como Ganho!');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar ganho');
    },
  });
};
