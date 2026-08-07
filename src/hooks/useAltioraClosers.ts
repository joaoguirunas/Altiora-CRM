/**
 * ALTIORA-07: Hook para listar Closers ativos e atribuir ao referral
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AltioraCloser {
  id: string;
  name: string;
  email: string;
  fuso_horario?: string | null;
}

export interface AtribuirCloserParams {
  leadId: string;
  closerId: string;
  closerName: string;
  actorId?: string; // quem está fazendo a atribuição
}

// ── Hook: listar Closers ativos ───────────────────────────────────────────────

export const useAltioraClosers = () => {
  return useQuery<AltioraCloser[]>({
    queryKey: ['altiora-closers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_users')
        .select('id, name, email, fuso_horario')
        .eq('user_type', 'closer')
        .eq('active', true)
        .is('deleted_at', null)
        .order('name') as unknown as {
          data: AltioraCloser[] | null;
          error: { message: string } | null;
        };

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

// ── Hook: listar usuários internos ativos (ALTIORA-27) ────────────────────────
// Mesma query de useAltioraClosers, sem o filtro `user_type='closer'` — usado
// pelo Super Admin para escolher livremente organizador/colaboradores de uma
// reunião (qualquer settings_users ativo, incluindo outro Super Admin).
// Ver ADR-ALTIORA-01.

export const useAltioraInternalUsers = (options?: { enabled?: boolean }) => {
  return useQuery<AltioraCloser[]>({
    queryKey: ['altiora-internal-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings_users')
        .select('id, name, email, fuso_horario')
        .eq('active', true)
        .is('deleted_at', null)
        .order('name') as unknown as {
          data: AltioraCloser[] | null;
          error: { message: string } | null;
        };

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

// ── Hook: atribuir Closer ao referral ────────────────────────────────────────

export const useAtribuirCloser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, closerId, closerName, actorId }: AtribuirCloserParams) => {
      const now = new Date().toISOString();

      // 1. Buscar stage atual para verificar se precisa mover
      const { data: lead } = await supabase
        .from('leads')
        .select('leads_stages_id, altiora_closer_id')
        .eq('id', leadId)
        .single();

      // Etapa "Novo referral" — mover para "Encaminhado ao comercial" se ainda estiver lá
      const STAGE_NOVO      = 'a1000000-0000-0000-0001-000000000001';
      const STAGE_ENCAMINHADO = 'a1000000-0000-0000-0001-000000000002';

      const updateData: Record<string, unknown> = {
        altiora_closer_id:         closerId,
        altiora_origem_atribuicao: 'manual',
        altiora_data_atribuicao:   now,
      };

      // Mover para "Encaminhado ao comercial" se ainda em "Novo referral"
      if (lead?.leads_stages_id === STAGE_NOVO) {
        updateData.leads_stages_id = STAGE_ENCAMINHADO;
      }

      // 2. Atualizar lead
      const { error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (updateError) throw new Error(updateError.message);

      // 3. Registrar interação
      const interactionType = lead?.altiora_closer_id ? 'closer_reassigned' : 'closer_assigned';
      await supabase.from('altiora_lead_interactions').insert({
        lead_id:     leadId,
        type:        interactionType,
        actor_id:    actorId ?? null,
        description: `Atribuído manualmente a ${closerName}`,
        payload:     {
          closer_id:   closerId,
          closer_name: closerName,
          stage_moved: lead?.leads_stages_id === STAGE_NOVO,
        },
      });

      // 4. Notificar Closer
      await supabase.from('altiora_notifications').insert({
        user_id: closerId,
        type:    'closer_assigned',
        title:   'Novo referral atribuído a você',
        message: `Novo referral atribuído a você. Acesse o pipeline para ver os detalhes.`,
        payload: { lead_id: leadId },
      });

      return { leadId, closerId };
    },
    onSuccess: (_data, variables) => {
      toast.success(`Closer ${variables.closerName} atribuído com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['negocios'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atribuir Closer: ${error.message}`);
    },
  });
};

// ── Hook: notificações não lidas do usuário ───────────────────────────────────

export const useAltioraNotificationsCount = (userId?: string) => {
  return useQuery<number>({
    queryKey: ['altiora-notifications-unread', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('altiora_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30s
    refetchInterval: 60 * 1000, // polling 1 min
  });
};
