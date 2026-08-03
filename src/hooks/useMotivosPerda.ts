import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MotivoPerda {
  id: string;
  name: string;
  category: string | null;
  order_index: number | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['leads_loss_reasons'];

/**
 * @param category - Quando informada, retorna só os motivos dessa categoria
 * (ex: 'pre_venda' | 'reprovacao' | 'pos_r2' — ver `motivoPerdaCategoria.ts`).
 * Quando omitida/undefined, retorna os motivos genéricos (category IS NULL) —
 * comportamento usado por pipelines fora do Altiora.
 */
export const useMotivosPerda = (category?: string | null) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, category ?? 'generic'],
    queryFn: async () => {
      let queryBuilder = supabase.from('leads_loss_reasons').select('*');
      queryBuilder = category
        ? queryBuilder.eq('category', category)
        : queryBuilder.is('category', null);

      const { data, error } = await queryBuilder
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('name');

      if (error) throw error;
      return (data || []) as MotivoPerda[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('leads_loss_reasons')
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;
      return data as MotivoPerda;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar motivo de perda: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('leads_loss_reasons')
        .update({ name })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar motivo de perda: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads_loss_reasons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error('Erro ao deletar motivo de perda: ' + error.message);
    },
  });

  return {
    motivos: query.data ?? [],
    loading: query.isLoading,
    addMotivo: (name: string) => addMutation.mutateAsync(name),
    updateMotivo: (id: string, name: string) => updateMutation.mutateAsync({ id, name }),
    deleteMotivo: (id: string) => deleteMutation.mutateAsync(id),
    refetch: query.refetch,
  };
};
