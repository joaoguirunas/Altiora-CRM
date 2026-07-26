/**
 * ALTIORA-11: Hooks para registrar primeiro contato e próxima ação.
 *
 * useRegistrarContato — insere em altiora_lead_interactions (type='first_contact')
 *                       e move lead para etapa "Contato iniciado" se ainda em
 *                       "Encaminhado ao comercial".
 *
 * useSalvarProximaAcao — salva next_action_* em leads (via sbUntyped, campos
 *                        adicionados na migration 20260725201000) e registra
 *                        altiora_lead_interactions (type='next_action_set').
 *
 * useAltioraInteracoes — lista interações de um lead (leitura).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// sbUntyped: acesso sem geração de tipos (campos novos da migration 20260725201000)
const sbUntyped = supabase as unknown as SupabaseClient;

// ── Constantes de etapas Altiora ───────────────────────────────────────────────

const STAGE_ENCAMINHADO_COMERCIAL = 'a1000000-0000-0000-0001-000000000002';
const STAGE_CONTATO_INICIADO      = 'a1000000-0000-0000-0001-000000000003';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContatoPayload {
  leadId: string;
  actorId: string;
  /** Estágio atual do lead (para decidir se muda para "Contato iniciado") */
  currentStageId: string;
  /** Data/hora do contato (ISO 8601) */
  dataContato: string;
  /** Canal: WhatsApp | Ligação | E-mail */
  canal: string;
  /** Resposta: Respondeu | Não respondeu | Número errado */
  resposta: string;
  /** Texto livre */
  resultado?: string;
}

export interface ProximaAcaoPayload {
  leadId: string;
  actorId: string;
  /** Tipo: Ligação | Reunião | E-mail | Tarefa */
  tipo: string;
  descricao: string;
  responsavelId?: string;
  /** ISO datetime string */
  prazo?: string;
}

export interface AltioraInteracao {
  id: string;
  lead_id: string;
  type: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
  actor?: { id: string; name: string } | null;
}

// ── Hook: registrar primeiro contato ──────────────────────────────────────────

export const useRegistrarContato = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ContatoPayload) => {
      const {
        leadId, actorId, currentStageId,
        dataContato, canal, resposta, resultado,
      } = payload;

      // 1. Registrar interação (first_contact)
      const { error: interacaoError } = await supabase
        .from('altiora_lead_interactions')
        .insert({
          lead_id: leadId,
          actor_id: actorId,
          type: 'first_contact',
          description: `Contato via ${canal} — ${resposta}${resultado ? `: ${resultado}` : ''}`,
          payload: { canal, resposta, resultado, data_contato: dataContato },
        });

      if (interacaoError) throw interacaoError;

      // 2. Se ainda em "Encaminhado ao comercial", mover para "Contato iniciado"
      if (currentStageId === STAGE_ENCAMINHADO_COMERCIAL) {
        const { error: stageError } = await supabase
          .from('leads')
          .update({ leads_stages_id: STAGE_CONTATO_INICIADO })
          .eq('id', leadId);

        if (stageError) throw stageError;

        // Registrar a mudança de etapa no histórico de interações
        await supabase.from('altiora_lead_interactions').insert({
          lead_id: leadId,
          actor_id: actorId,
          type: 'stage_changed',
          description: 'Etapa avançada para "Contato iniciado" automaticamente após primeiro contato',
          payload: {
            stage_from: STAGE_ENCAMINHADO_COMERCIAL,
            stage_to: STAGE_CONTATO_INICIADO,
          },
        });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      toast.success('Contato registrado!');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao registrar contato';
      toast.error(msg);
    },
  });
};

// ── Hook: salvar próxima ação ─────────────────────────────────────────────────

export const useSalvarProximaAcao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProximaAcaoPayload) => {
      const { leadId, actorId, tipo, descricao, responsavelId, prazo } = payload;

      // 1. Atualizar campos next_action_* em leads
      // Campos adicionados via migration 20260725201000 — usar sbUntyped pois
      // não estão nos tipos gerados pelo Supabase ainda.
      const { error: leadError } = await sbUntyped
        .from('leads')
        .update({
          next_action_type:           tipo,
          next_action_description:    descricao,
          next_action_due_at:         prazo ?? null,
          next_action_responsavel_id: responsavelId ?? actorId,
        })
        .eq('id', leadId);

      if (leadError) throw leadError;

      // 2. Registrar interação (next_action_set)
      const { error: interacaoError } = await supabase
        .from('altiora_lead_interactions')
        .insert({
          lead_id: leadId,
          actor_id: actorId,
          type: 'next_action_set',
          description: `Próxima ação: ${tipo} — ${descricao}${prazo ? ` (prazo: ${new Date(prazo).toLocaleDateString('pt-BR')})` : ''}`,
          payload: { tipo, descricao, prazo, responsavel_id: responsavelId },
        });

      if (interacaoError) throw interacaoError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['negocio', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['altiora-interacoes', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['negocios-pipeline'], exact: false });
      toast.success('Próxima ação salva!');
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar próxima ação';
      toast.error(msg);
    },
  });
};

// ── Hook: listar interações de um lead ────────────────────────────────────────

export const useAltioraInteracoes = (leadId: string) => {
  return useQuery<AltioraInteracao[]>({
    queryKey: ['altiora-interacoes', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('altiora_lead_interactions')
        .select(`
          id, lead_id, type, description, payload, actor_id, created_at,
          actor:settings_users!actor_id ( id, name )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AltioraInteracao[];
    },
    enabled: !!leadId,
    staleTime: 60_000,
  });
};
