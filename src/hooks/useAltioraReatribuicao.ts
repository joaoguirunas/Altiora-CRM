/**
 * ALTIORA-22: Hook para reatribuição de Closer e correção de dados críticos.
 *
 * useReatribuirCloser — atualiza altiora_closer_id, registra interação
 *                       type='closer_reassigned' e notifica ambos os Closers.
 *
 * useCorrigirCampo    — corrige dado crítico em leads (origem, data handoff,
 *                       valor do prêmio) e registra interação type='field_changed'
 *                       com motivo de correção (AC4).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// sbUntyped: campos altiora_* em leads não estão todos nos tipos gerados
const sbUntyped = supabase as unknown as SupabaseClient;

// ── Motivos de reatribuição ────────────────────────────────────────────────────

export const MOTIVOS_REATRIBUICAO = [
  { value: 'redistribuicao',      label: 'Redistribuição de carteira' },
  { value: 'erro_atribuicao',     label: 'Erro de atribuição inicial' },
  { value: 'ausencia_closer',     label: 'Ausência do Closer' },
  { value: 'pedido_cliente',      label: 'Pedido do cliente' },
] as const;

export type MotivoReatribuicao = typeof MOTIVOS_REATRIBUICAO[number]['value'];

// ── Campos corrigíveis ────────────────────────────────────────────────────────

export const CAMPOS_CORRIGIVEIS = [
  { value: 'altiora_origem',         label: 'Origem' },
  { value: 'altiora_data_handoff',   label: 'Data de handoff' },
  { value: 'value',                  label: 'Valor do prêmio' },
] as const;

export type CampoCorrigivel = typeof CAMPOS_CORRIGIVEIS[number]['value'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReatribuirCloserParams {
  leadId: string;
  fromCloserId: string | null;
  fromCloserName: string;
  toCloserId: string;
  toCloserName: string;
  motivo: MotivoReatribuicao;
  /** Se true, reuniões futuras NÃO são transferidas ao novo Closer (AC3) */
  manterAtividadesComAnterior: boolean;
  actorId: string;
}

export interface CorrigirCampoParams {
  leadId: string;
  campo: CampoCorrigivel;
  campoLabel: string;
  valorAntigo: string;
  valorNovo: string;
  motivo: string;
  actorId: string;
}

// ── Hook: reatribuir Closer ───────────────────────────────────────────────────

export const useReatribuirCloser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReatribuirCloserParams) => {
      const {
        leadId, fromCloserId, fromCloserName, toCloserId, toCloserName,
        motivo, manterAtividadesComAnterior, actorId,
      } = params;

      // AC5: validação de usuário inativo — a query useAltioraClosers já filtra
      // por active=true, mas revalidamos aqui para segurança
      const { data: targetUser, error: userError } = await supabase
        .from('settings_users')
        .select('id, active')
        .eq('id', toCloserId)
        .single() as unknown as { data: { id: string; active: boolean } | null; error: { message: string } | null };

      if (userError) throw new Error(userError.message);
      if (!targetUser?.active) {
        throw new Error('O Closer selecionado está inativo. Selecione um Closer ativo.');
      }

      const now = new Date().toISOString();

      // 1. Atualizar altiora_closer_id no lead
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          altiora_closer_id:       toCloserId,
          altiora_data_atribuicao: now,
        })
        .eq('id', leadId);

      if (leadError) throw new Error(leadError.message);

      // 2. Registrar interação (AC2)
      const { error: interacaoError } = await supabase
        .from('altiora_lead_interactions')
        .insert({
          lead_id:     leadId,
          actor_id:    actorId,
          type:        'closer_reassigned',
          description: `Closer reatribuído: ${fromCloserName} → ${toCloserName}. Motivo: ${MOTIVOS_REATRIBUICAO.find(m => m.value === motivo)?.label ?? motivo}`,
          payload: {
            from_closer_id:               fromCloserId,
            to_closer_id:                 toCloserId,
            motivo,
            atividades_transferidas:      !manterAtividadesComAnterior,
          },
        });

      if (interacaoError) throw new Error(interacaoError.message);

      // 3. Notificar Closer anterior (se existia)
      if (fromCloserId) {
        await supabase.from('altiora_notifications').insert({
          user_id: fromCloserId,
          type:    'closer_removed',
          title:   'Referral reatribuído',
          message: `Um referral foi transferido da sua carteira para ${toCloserName}.`,
          payload: { lead_id: leadId, motivo },
        });
      }

      // 4. Notificar novo Closer
      await supabase.from('altiora_notifications').insert({
        user_id: toCloserId,
        type:    'closer_assigned',
        title:   'Referral atribuído a você',
        message: `Um referral foi reatribuído para você por ${fromCloserName ? `${fromCloserName} → ` : ''}${toCloserName}.`,
        payload: { lead_id: leadId, motivo },
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(`Closer reatribuído para ${variables.toCloserName}`);
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-timeline', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao reatribuir Closer';
      toast.error(msg);
    },
  });
};

// ── Hook: corrigir campo crítico (AC4) ───────────────────────────────────────

export const useCorrigirCampo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CorrigirCampoParams) => {
      const { leadId, campo, campoLabel, valorAntigo, valorNovo, motivo, actorId } = params;

      // Converter valor para o tipo correto antes de salvar
      const valorParaSalvar = campo === 'value' ? parseFloat(valorNovo) || 0 : valorNovo;

      // 1. Atualizar campo no lead (sbUntyped para campos altiora_*)
      const { error: updateError } = await sbUntyped
        .from('leads')
        .update({ [campo]: valorParaSalvar })
        .eq('id', leadId);

      if (updateError) throw new Error(updateError.message);

      // 2. Registrar correção em altiora_lead_interactions
      const { error: logError } = await supabase
        .from('altiora_lead_interactions')
        .insert({
          lead_id:     leadId,
          actor_id:    actorId,
          type:        'manual_action',
          description: `Campo "${campoLabel}" corrigido: "${valorAntigo}" → "${valorNovo}". Motivo: ${motivo}`,
          payload: {
            campo,
            valor_antigo:      valorAntigo,
            valor_novo:        valorNovo,
            corrected_by:      actorId,
            correction_reason: motivo,
          },
        });

      if (logError) throw new Error(logError.message);
    },
    onSuccess: (_data, variables) => {
      toast.success('Campo corrigido com sucesso');
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-timeline', variables.leadId] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao corrigir campo';
      toast.error(msg);
    },
  });
};
