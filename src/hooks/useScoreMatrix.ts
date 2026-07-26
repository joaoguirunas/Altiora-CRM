import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ScoreCategory, ScoreCategoryItem } from './useScoreCategories';

export interface ScoreMatrixResolvedCategory {
  categoryId: string;
  categoryName: string;
  itemNames: string[];
}

export interface ScoreMatrix {
  id: string;
  name?: string;
  // Dynamic format — { cat_id: [item_id, ...] }
  category_selections: Record<string, string[]>;
  score_number: number;
  detail_score?: string;
  profile_score?: string;
  pre_description_score?: string;
  created_at: string;
  updated_at: string;
  // Computed fields populated by hooks
  resolved_categories?: ScoreMatrixResolvedCategory[];
}

// Loads all categories + items then resolves display names for a list of matrices
const resolveMatrixNames = async (matrices: ScoreMatrix[]): Promise<ScoreMatrix[]> => {
  if (matrices.length === 0) return [];

  const [catsRes, itemsRes] = await Promise.all([
    supabase.from('score_categories').select('id, name').order('order_index', { ascending: true }),
    supabase.from('score_category_items').select('id, name, category_id'),
  ]);

  const categories = (catsRes.data || []) as ScoreCategory[];
  const items = (itemsRes.data || []) as ScoreCategoryItem[];

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const itemMap = new Map(items.map((i) => [i.id, i.name]));

  return matrices.map((m) => {
    const selections = m.category_selections || {};
    const resolved: ScoreMatrixResolvedCategory[] = categories
      .filter((c) => (selections[c.id]?.length ?? 0) > 0)
      .map((c) => ({
        categoryId: c.id,
        categoryName: catMap.get(c.id) ?? c.id,
        itemNames: (selections[c.id] || [])
          .map((iid) => itemMap.get(iid))
          .filter(Boolean) as string[],
      }));
    return { ...m, resolved_categories: resolved };
  });
};

// ─── useScoreMatrix (list + filter) ──────────────────────────────────────────

// filters: { [category_id]: item_id } — one active item per filter
export const useScoreMatrix = (filters?: Record<string, string>) => {
  return useQuery({
    queryKey: ['score-matrix', filters],
    queryFn: async () => {
      let query = supabase
        .from('score_matrix')
        .select('*')
        .order('score_number', { ascending: false });

      if (filters) {
        for (const [catId, itemId] of Object.entries(filters)) {
          if (itemId) {
            // JSONB containment: { cat_id: [item_id] } ⊂ category_selections
            query = query.contains('category_selections', { [catId]: [itemId] });
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return resolveMatrixNames((data || []) as ScoreMatrix[]);
    },
  });
};

// ─── useScoreMatrixById ───────────────────────────────────────────────────────

export const useScoreMatrixById = (matrixId?: string | null) => {
  return useQuery({
    queryKey: ['score-matrix-by-id', matrixId],
    queryFn: async () => {
      if (!matrixId) return null;
      const { data, error } = await supabase
        .from('score_matrix')
        .select('*')
        .eq('id', matrixId)
        .single();
      if (error) throw error;
      const [resolved] = await resolveMatrixNames([data as unknown as ScoreMatrix]);
      return resolved;
    },
    enabled: !!matrixId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ─── useFindScoreMatrix ───────────────────────────────────────────────────────
// Legacy signature preserved for PersonScoreSection / NegocioScoreSection

export const useFindScoreMatrix = (
  objective_id?: string,
  investment_id?: string,
  framing_id?: string
) => {
  return useQuery({
    queryKey: ['score-matrix-find', objective_id, investment_id, framing_id],
    queryFn: async () => {
      if (!objective_id || !investment_id || !framing_id) return null;

      // Resolve category IDs from base slugs
      const { data: cats } = await supabase
        .from('score_categories')
        .select('id, slug')
        .in('slug', ['objectives', 'investments', 'framings']);

      const catList = (cats || []) as { id: string; slug: string }[];
      const objCatId = catList.find((c) => c.slug === 'objectives')?.id;
      const invCatId = catList.find((c) => c.slug === 'investments')?.id;
      const frmCatId = catList.find((c) => c.slug === 'framings')?.id;

      if (!objCatId || !invCatId || !frmCatId) return null;

      const { data, error } = await supabase
        .from('score_matrix')
        .select('*')
        .contains('category_selections', {
          [objCatId]: [objective_id],
          [invCatId]: [investment_id],
          [frmCatId]: [framing_id],
        });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Prioritise: most specific (fewer total items) → highest score → most recent
      const sorted = (data as unknown as ScoreMatrix[]).sort((a, b) => {
        const totalA = Object.values(a.category_selections || {}).reduce(
          (s, arr) => s + (arr?.length || 0),
          0
        );
        const totalB = Object.values(b.category_selections || {}).reduce(
          (s, arr) => s + (arr?.length || 0),
          0
        );
        if (totalA !== totalB) return totalA - totalB;
        if (a.score_number !== b.score_number) return b.score_number - a.score_number;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const [resolved] = await resolveMatrixNames([sorted[0]]);
      return resolved;
    },
    enabled: !!objective_id && !!investment_id && !!framing_id,
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useCreateScoreMatrix = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      matrix: Omit<ScoreMatrix, 'id' | 'created_at' | 'updated_at' | 'resolved_categories'>
    ) => {
      const { data, error } = await supabase
        .from('score_matrix')
        .insert({
          name: matrix.name,
          category_selections: matrix.category_selections,
          score_number: matrix.score_number,
          detail_score: matrix.detail_score,
          profile_score: matrix.profile_score,
          pre_description_score: matrix.pre_description_score,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      toast.success('Combinação criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar combinação:', error);
      toast.error(error.message || 'Erro ao criar combinação');
    },
  });
};

export const useUpdateScoreMatrix = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScoreMatrix> & { id: string }) => {
      // Strip computed fields before sending to DB
      const { resolved_categories: _rc, ...clean } = updates;
      const { data, error } = await supabase
        .from('score_matrix')
        .update({
          name: clean.name,
          category_selections: clean.category_selections,
          score_number: clean.score_number,
          detail_score: clean.detail_score,
          profile_score: clean.profile_score,
          pre_description_score: clean.pre_description_score,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix-find'] });
      // AC3: async re-evaluation — keep persons linked to this matrix in sync
      supabase.functions
        .invoke('score-re-evaluate', { body: { matrix_id: variables.id } })
        .then(({ error }) => {
          if (error) console.error('score-re-evaluate (update) failed:', error);
        });
      toast.success('Combinação atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar combinação'),
  });
};

export const useDeleteScoreMatrix = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('score_matrix').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['score-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['score-matrix-find'] });
      // AC3: async re-evaluation — clear score for persons that had this matrix
      supabase.functions
        .invoke('score-re-evaluate', { body: { deleted_matrix_ids: [id] } })
        .then(({ error }) => {
          if (error) console.error('score-re-evaluate (delete) failed:', error);
        });
      toast.success('Combinação excluída com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir combinação'),
  });
};
