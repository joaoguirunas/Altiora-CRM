/**
 * ALTIORA-12: Validação de transição de etapa com campos obrigatórios.
 *
 * useAltioraStageCheck — verifica se a etapa destino tem pré-requisitos
 *                         não atendidos (meetings, resultado R1/R2, etc.)
 *
 * useConfirmarTransicao — executa a transição: atualiza leads_stages_id
 *                          e insere registro em lead_stage_history.
 *
 * STAGE_REQUIREMENTS — mapa de requisitos por etapa destino (AC2).
 * isSkippingStages    — detecta salto de etapas (AC3).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const sbUntyped = supabase as unknown as SupabaseClient;

// ── Stage UUIDs ───────────────────────────────────────────────────────────────

export const ALTIORA_STAGE = {
  NOVO_REFERRAL:         'a1000000-0000-0000-0001-000000000001',
  ENCAMINHADO:           'a1000000-0000-0000-0001-000000000002',
  CONTATO_INICIADO:      'a1000000-0000-0000-0001-000000000003',
  R1_AGENDADA:           'a1000000-0000-0000-0001-000000000004',
  R1_REALIZADA:          'a1000000-0000-0000-0001-000000000005',
  ANALISE_FINVITY:       'a1000000-0000-0000-0001-000000000006',
  R2_AGENDADA:           'a1000000-0000-0000-0001-000000000007',
  R2_REALIZADA:          'a1000000-0000-0000-0001-000000000008',
  R3_AGENDADA:           'a1000000-0000-0000-0001-000000000009',
  R3_REALIZADA:          'a1000000-0000-0000-0001-000000000010',
  EM_CONTRATACAO:        'a1000000-0000-0000-0001-000000000011',
  GANHO:                 'a1000000-0000-0000-0001-000000000012',
  PERDIDO:               'a1000000-0000-0000-0001-000000000013',
} as const;

// Stage order for skip detection
export const ALTIORA_STAGE_ORDER: Record<string, number> = {
  [ALTIORA_STAGE.NOVO_REFERRAL]:    1,
  [ALTIORA_STAGE.ENCAMINHADO]:      2,
  [ALTIORA_STAGE.CONTATO_INICIADO]: 3,
  [ALTIORA_STAGE.R1_AGENDADA]:      4,
  [ALTIORA_STAGE.R1_REALIZADA]:     5,
  [ALTIORA_STAGE.ANALISE_FINVITY]:  6,
  [ALTIORA_STAGE.R2_AGENDADA]:      7,
  [ALTIORA_STAGE.R2_REALIZADA]:     8,
  [ALTIORA_STAGE.R3_AGENDADA]:      9,
  [ALTIORA_STAGE.R3_REALIZADA]:    10,
  [ALTIORA_STAGE.EM_CONTRATACAO]:  11,
  [ALTIORA_STAGE.GANHO]:           12,
  [ALTIORA_STAGE.PERDIDO]:         13,
};

// ── Requirement types ─────────────────────────────────────────────────────────

export interface StageRequirement {
  /** Human-readable label for this requirement */
  label: string;
  /** Async check — returns true if requirement is already met */
  check: (leadId: string) => Promise<boolean>;
  /** Friendly message when requirement is missing */
  missing: string;
}

// ── Stage requirements map (AC2) ─────────────────────────────────────────────

export const STAGE_REQUIREMENTS: Record<string, StageRequirement[]> = {
  [ALTIORA_STAGE.R1_AGENDADA]: [
    {
      label: 'R1 agendada',
      check: async (leadId) => {
        const { count } = await supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('leads_id', leadId)
          .eq('altiora_tipo', 'R1')
          .neq('status', 'cancelada');
        return (count ?? 0) > 0;
      },
      missing: 'Agende a R1 na aba "Reuniões" antes de mover para esta etapa.',
    },
  ],
  [ALTIORA_STAGE.R1_REALIZADA]: [
    {
      label: 'R1 realizada',
      check: async (leadId) => {
        const { count } = await supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('leads_id', leadId)
          .eq('altiora_tipo', 'R1')
          .eq('altiora_compareceu', true);
        return (count ?? 0) > 0;
      },
      missing: 'Registre o resultado da R1 como "Realizada" na aba "Reuniões".',
    },
  ],
  [ALTIORA_STAGE.ANALISE_FINVITY]: [
    {
      label: 'Diagnóstico R1 preenchido',
      check: async (leadId) => {
        const { data } = await supabase
          .from('altiora_r1_data')
          .select('lead_id')
          .eq('lead_id', leadId)
          .maybeSingle();
        return !!data;
      },
      missing: 'Preencha o Diagnóstico R1 na aba "Qualificação".',
    },
  ],
  [ALTIORA_STAGE.R2_AGENDADA]: [
    {
      label: 'R2 agendada',
      check: async (leadId) => {
        const { count } = await supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('leads_id', leadId)
          .eq('altiora_tipo', 'R2')
          .neq('status', 'cancelada');
        return (count ?? 0) > 0;
      },
      missing: 'Agende a R2 na aba "Reuniões".',
    },
  ],
  [ALTIORA_STAGE.R2_REALIZADA]: [
    {
      label: 'R2 realizada',
      check: async (leadId) => {
        const { count } = await supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('leads_id', leadId)
          .eq('altiora_tipo', 'R2')
          .eq('altiora_compareceu', true);
        return (count ?? 0) > 0;
      },
      missing: 'Registre o resultado da R2 como "Realizada" na aba "Reuniões".',
    },
  ],
  [ALTIORA_STAGE.R3_AGENDADA]: [
    {
      label: 'R3 agendada',
      check: async (leadId) => {
        const { count } = await supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('leads_id', leadId)
          .eq('altiora_tipo', 'R3')
          .neq('status', 'cancelada');
        return (count ?? 0) > 0;
      },
      missing: 'Agende a R3 na aba "Reuniões".',
    },
  ],
  [ALTIORA_STAGE.R3_REALIZADA]: [
    {
      label: 'R3 realizada',
      check: async (leadId) => {
        const { count } = await supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('leads_id', leadId)
          .eq('altiora_tipo', 'R3')
          .eq('altiora_compareceu', true);
        return (count ?? 0) > 0;
      },
      missing: 'Registre o resultado da R3 como "Realizada" na aba "Reuniões".',
    },
  ],
  [ALTIORA_STAGE.GANHO]: [
    {
      label: 'Data de emissão registrada',
      check: async (leadId) => {
        const { data } = await supabase
          .from('altiora_contratacao')
          .select('data_emissao')
          .eq('lead_id', leadId)
          .maybeSingle();
        return !!data?.data_emissao;
      },
      missing: 'Registre a data de emissão no painel "Contratação" antes de marcar como Ganho.',
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Retorna true se o usuário está pulando etapas forward (AC3) */
export function isSkippingStages(fromStageId: string, toStageId: string): boolean {
  const fromPos = ALTIORA_STAGE_ORDER[fromStageId] ?? 0;
  const toPos   = ALTIORA_STAGE_ORDER[toStageId]   ?? 0;
  return toPos - fromPos > 1;
}

/** Verifica todos os requisitos da etapa destino; retorna lista dos não atendidos */
export async function checkStageRequirements(
  leadId: string,
  toStageId: string,
): Promise<StageRequirement[]> {
  const requirements = STAGE_REQUIREMENTS[toStageId];
  if (!requirements || requirements.length === 0) return [];

  const results = await Promise.all(
    requirements.map(async (req) => {
      const met = await req.check(leadId);
      return met ? null : req;
    }),
  );

  return results.filter((r): r is StageRequirement => r !== null);
}

// ── Mutation types ────────────────────────────────────────────────────────────

export interface TransicaoParams {
  leadId: string;
  fromStageId: string;
  toStageId: string;
  actorId: string;
  skipConfirmed?: boolean;
  notes?: string;
}

// ── Hook: confirmar transição de etapa ───────────────────────────────────────

export const useConfirmarTransicao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TransicaoParams) => {
      const { leadId, fromStageId, toStageId, actorId, skipConfirmed, notes } = params;

      // 1. Atualizar etapa do lead
      const { error: leadError } = await supabase
        .from('leads')
        .update({ leads_stages_id: toStageId })
        .eq('id', leadId);

      if (leadError) throw leadError;

      // 2. Registrar no histórico (AC4)
      const { error: historyError } = await sbUntyped
        .from('lead_stage_history')
        .insert({
          lead_id:       leadId,
          from_stage_id: fromStageId || null,
          to_stage_id:   toStageId,
          actor_id:      actorId,
          skip_confirmed: skipConfirmed ?? false,
          notes:         notes ?? null,
        });

      if (historyError) {
        // Histórico é auditoria — não bloquear se falhar
        console.warn('[ALTIORA-12] lead_stage_history insert failed:', historyError.message);
      }

      // 3. Registrar interação (stage_changed)
      await supabase.from('altiora_lead_interactions').insert({
        lead_id:     leadId,
        actor_id:    actorId,
        type:        'stage_changed',
        description: `Etapa atualizada${skipConfirmed ? ' (salto confirmado)' : ''}`,
        payload: {
          from_stage_id:  fromStageId,
          to_stage_id:    toStageId,
          skip_confirmed: skipConfirmed ?? false,
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      toast.success('Etapa atualizada!');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar etapa';
      toast.error(msg);
    },
  });
};
