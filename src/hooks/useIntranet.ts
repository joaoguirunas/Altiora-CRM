import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// `intranet_categories`/`intranet_items` foram criadas depois da última geração
// de src/integrations/supabase/types.ts. Cast contido aqui para não espalhar
// casts pelos call sites (mesma abordagem de useUserTasks).
const untyped = supabase as unknown as SupabaseClient;
const categories = () => untyped.from('intranet_categories');
const items = () => untyped.from('intranet_items');

const BUCKET = 'intranet-files';
const SIGNED_URL_TTL = 60 * 60; // 1h — anexo é aberto na sessão, não linkado externamente
const SORT_GAP = 10;            // espaço entre sort_order para permitir inserção no meio

export interface IntranetAttachment {
  name: string;
  path: string;
  mime: string;
  size: number;
  is_image: boolean;
  /** Signed URL resolvida no client; não é persistida. */
  url?: string;
}

export interface IntranetCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface IntranetItem {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  url: string | null;
  attachments: IntranetAttachment[];
  sort_order: number;
  published: boolean;
  created_at: string;
}

type IntranetItemRow = Omit<IntranetItem, 'attachments'> & {
  attachments: IntranetAttachment[] | null;
};

/** Resolve signed URLs para os anexos de uma leva de itens (1 request). */
const resolveAttachmentUrls = async (list: IntranetItem[]): Promise<IntranetItem[]> => {
  const paths = list.flatMap(i => i.attachments.map(a => a.path)).filter(Boolean);
  if (paths.length === 0) return list;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  // Falha ao assinar não deve derrubar a página — só perde o download.
  if (error || !data) return list;

  const byPath = new Map(data.map(d => [d.path, d.signedUrl]));
  return list.map(i => ({
    ...i,
    attachments: i.attachments.map(a => ({ ...a, url: byPath.get(a.path) ?? undefined })),
  }));
};

export const useIntranetCategories = () => {
  return useQuery<IntranetCategory[]>({
    queryKey: ['intranet-categories'],
    queryFn: async () => {
      const { data, error } = await categories()
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as IntranetCategory[];
    },
    staleTime: 5 * 60 * 1000, // conteúdo muda raramente
  });
};

/**
 * Todos os itens da intranet de uma vez. O volume é pequeno (dezenas) e a
 * página renderiza todas as categorias juntas — paginar por categoria só
 * multiplicaria requests.
 *
 * `includeUnpublished` só deve vir true para admin: rascunhos não aparecem
 * para o time. A RLS não filtra isso (SELECT é aberto a autenticados), então o
 * corte é feito na query.
 */
export const useIntranetItems = (includeUnpublished: boolean) => {
  return useQuery<IntranetItem[]>({
    queryKey: ['intranet-items', includeUnpublished],
    queryFn: async () => {
      let query = items()
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!includeUnpublished) query = query.eq('published', true);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as IntranetItemRow[];
      return resolveAttachmentUrls(rows.map(r => ({
        ...r,
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
      })));
    },
    staleTime: 5 * 60 * 1000,
  });
};

/** Sobe arquivos para o bucket e devolve os metadados prontos para persistir. */
export const uploadIntranetFiles = async (files: File[]): Promise<IntranetAttachment[]> => {
  const uploaded = await Promise.all(files.map(async (file) => {
    // Nome sanitizado + prefixo único: evita colisão e caracteres inválidos na key.
    const safeName = file.name.replace(/[^\w.-]+/g, '_');
    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream' });

    if (error) {
      toast.error(`Falha ao anexar "${file.name}": ${error.message}`);
      return null;
    }

    return {
      name: file.name,
      path,
      mime: file.type,
      size: file.size,
      is_image: file.type.startsWith('image/'),
    } satisfies IntranetAttachment;
  }));

  return uploaded.filter((a): a is IntranetAttachment => a !== null);
};

export interface CategoryInput {
  name: string;
  description?: string | null;
  icon?: string | null;
}

export interface ItemInput {
  category_id: string;
  title: string;
  description?: string | null;
  url?: string | null;
  attachments?: IntranetAttachment[];
  published?: boolean;
}

/** `url` é signed e expira — persistimos só o metadado durável. */
const stripUrls = (list: IntranetAttachment[]) =>
  list.map(({ url, ...rest }) => rest);

/** Normaliza a URL digitada pelo admin: "vivaamerica.com" → "https://vivaamerica.com". */
export const normalizeUrl = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
};

export const useIntranetMutations = (userId: string | null) => {
  const queryClient = useQueryClient();
  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: ['intranet-categories'] });
  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: ['intranet-items'] });

  const createCategory = useMutation({
    mutationFn: async (input: CategoryInput & { afterCount: number }) => {
      const { error } = await categories().insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        icon: input.icon ?? null,
        sort_order: input.afterCount * SORT_GAP,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateCategories(); toast.success('Categoria criada'); },
    onError: (e: Error) => toast.error(`Erro ao criar categoria: ${e.message}`),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<CategoryInput>) => {
      const payload: Record<string, unknown> = {};
      if (fields.name !== undefined) payload.name = fields.name.trim();
      if (fields.description !== undefined) payload.description = fields.description?.trim() || null;
      if (fields.icon !== undefined) payload.icon = fields.icon ?? null;

      const { error } = await categories().update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateCategories(); toast.success('Categoria atualizada'); },
    onError: (e: Error) => toast.error(`Erro ao atualizar categoria: ${e.message}`),
  });

  /** Remove a categoria e, em cascata (FK), os itens dentro dela. */
  const deleteCategory = useMutation({
    mutationFn: async ({ id, itemPaths }: { id: string; itemPaths: string[] }) => {
      const { error } = await categories().delete().eq('id', id);
      if (error) throw error;
      // Best-effort: órfãos no bucket não quebram nada, mas limpamos quando dá.
      if (itemPaths.length) await supabase.storage.from(BUCKET).remove(itemPaths);
    },
    onSuccess: () => {
      invalidateCategories();
      invalidateItems();
      toast.success('Categoria excluída');
    },
    onError: (e: Error) => toast.error(`Erro ao excluir categoria: ${e.message}`),
  });

  /** Troca o sort_order de duas categorias (botões de subir/descer). */
  const swapCategoryOrder = useMutation({
    mutationFn: async ({ a, b }: { a: IntranetCategory; b: IntranetCategory }) => {
      // sort_order pode estar empatado em 0 (default) para linhas antigas —
      // nesse caso um swap puro não muda nada. Reindexamos pelo índice na lista.
      const [orderA, orderB] = a.sort_order === b.sort_order
        ? [b.sort_order + SORT_GAP, b.sort_order]
        : [b.sort_order, a.sort_order];

      const results = await Promise.all([
        categories().update({ sort_order: orderA }).eq('id', a.id),
        categories().update({ sort_order: orderB }).eq('id', b.id),
      ]);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: invalidateCategories,
    onError: (e: Error) => toast.error(`Erro ao reordenar: ${e.message}`),
  });

  const createItem = useMutation({
    mutationFn: async (input: ItemInput & { afterCount: number }) => {
      const { error } = await items().insert({
        category_id: input.category_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        url: input.url || null,
        attachments: stripUrls(input.attachments ?? []),
        published: input.published ?? true,
        sort_order: input.afterCount * SORT_GAP,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateItems(); toast.success('Item publicado'); },
    onError: (e: Error) => toast.error(`Erro ao criar item: ${e.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<ItemInput>) => {
      const payload: Record<string, unknown> = {};
      if (fields.category_id !== undefined) payload.category_id = fields.category_id;
      if (fields.title !== undefined) payload.title = fields.title.trim();
      if (fields.description !== undefined) payload.description = fields.description?.trim() || null;
      if (fields.url !== undefined) payload.url = fields.url || null;
      if (fields.attachments !== undefined) payload.attachments = stripUrls(fields.attachments);
      if (fields.published !== undefined) payload.published = fields.published;

      const { error } = await items().update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateItems(); toast.success('Item atualizado'); },
    onError: (e: Error) => toast.error(`Erro ao atualizar item: ${e.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (item: IntranetItem) => {
      const { error } = await items().delete().eq('id', item.id);
      if (error) throw error;
      const paths = item.attachments.map(a => a.path).filter(Boolean);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    },
    onSuccess: () => { invalidateItems(); toast.success('Item excluído'); },
    onError: (e: Error) => toast.error(`Erro ao excluir item: ${e.message}`),
  });

  return {
    createCategory,
    updateCategory,
    deleteCategory,
    swapCategoryOrder,
    createItem,
    updateItem,
    deleteItem,
  };
};
