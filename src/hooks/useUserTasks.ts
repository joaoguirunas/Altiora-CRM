import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// `user_tasks` foi criada depois da última geração de src/integrations/supabase/types.ts.
// Cast contido aqui para não espalhar casts pelos call sites.
const untyped = supabase as unknown as SupabaseClient;
const table = () => untyped.from('user_tasks');

const BUCKET = 'task-attachments';
const SIGNED_URL_TTL = 60 * 60; // 1h — anexos são lidos na sessão, não linkados externamente

export interface TaskAttachment {
  name: string;
  path: string;
  mime: string;
  size: number;
  is_image: boolean;
  /** Signed URL resolvida no client; não é persistida. */
  url?: string;
}

export interface UserTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string;          // YYYY-MM-DD
  due_time: string | null;   // HH:MM(:SS)
  done: boolean;
  done_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  attachments: TaskAttachment[];
  created_at: string;
  updated_at: string;
  /** Derivado: atribuída por outra pessoa (gestor) vs. criada por mim. */
  isFromTeam: boolean;
}

/** Linha crua de `user_tasks` (due_time vem como HH:MM:SS, attachments como jsonb). */
type UserTaskRow = Omit<UserTask, 'attachments' | 'isFromTeam'> & {
  attachments: TaskAttachment[] | null;
};

const normalize = (row: UserTaskRow, currentUserId: string | null): UserTask => ({
  ...row,
  due_time: row.due_time ? String(row.due_time).slice(0, 5) : null,
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  isFromTeam: !!row.created_by && !!currentUserId && row.created_by !== currentUserId,
});

/** Resolve signed URLs para todos os anexos de uma leva de tarefas (1 request). */
const resolveAttachmentUrls = async (tasks: UserTask[]): Promise<UserTask[]> => {
  const paths = tasks.flatMap(t => t.attachments.map(a => a.path)).filter(Boolean);
  if (paths.length === 0) return tasks;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  // Falha ao assinar não deve derrubar a lista — só perde o preview.
  if (error || !data) return tasks;

  const byPath = new Map(data.map(d => [d.path, d.signedUrl]));
  return tasks.map(t => ({
    ...t,
    attachments: t.attachments.map(a => ({ ...a, url: byPath.get(a.path) ?? undefined })),
  }));
};

/**
 * Tarefas de um usuário num intervalo de datas (inclusivo, YYYY-MM-DD).
 * A tela de Tarefas carrega a semana inteira de uma vez e filtra o dia em memória.
 */
export const useUserTasks = (userId: string | null, from: string, to: string) => {
  return useQuery<UserTask[]>({
    queryKey: ['user-tasks', userId, from, to],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await table()
        .select('*')
        .eq('assigned_to', userId)
        .gte('due_date', from)
        .lte('due_date', to)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false });

      if (error) throw error;
      const rows = (data ?? []) as UserTaskRow[];
      return resolveAttachmentUrls(rows.map(r => normalize(r, userId)));
    },
    staleTime: 30 * 1000,
  });
};

/** Tarefas pendentes com prazo anterior a `today` — alimenta o card "Atrasadas". */
export const useOverdueTaskCount = (userId: string | null, today: string) => {
  return useQuery<number>({
    queryKey: ['user-tasks-overdue', userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await table()
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('done', false)
        .lt('due_date', today);

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30 * 1000,
  });
};

/** Sobe arquivos para o bucket e devolve os metadados prontos para persistir. */
export const uploadTaskAttachments = async (
  files: File[],
  userId: string,
): Promise<TaskAttachment[]> => {
  const uploaded = await Promise.all(files.map(async (file) => {
    // Nome sanitizado + prefixo único: evita colisão e caracteres inválidos na key.
    const safeName = file.name.replace(/[^\w.-]+/g, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;

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
    } satisfies TaskAttachment;
  }));

  return uploaded.filter((a): a is TaskAttachment => a !== null);
};

interface CreateTaskInput {
  title: string;
  due_date: string;
  due_time?: string | null;
  description?: string | null;
  attachments?: TaskAttachment[];
  /** Default: o próprio usuário. Admin/gestor pode atribuir a outra pessoa. */
  assigned_to?: string;
  /** Só para a mensagem de confirmação — não é persistido. */
  assigneeName?: string;
}

export const useUserTaskMutations = (userId: string | null) => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['user-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['user-tasks-overdue'] });
  };

  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (!userId) throw new Error('Usuário não identificado');

      const { data, error } = await table()
        .insert({
          // assigneeName é descartado de propósito: só alimenta o toast.
          title: input.title.trim(),
          description: input.description ?? null,
          due_date: input.due_date,
          due_time: input.due_time || null,
          // `url` é signed e expira — persistimos só o metadado durável.
          attachments: (input.attachments ?? []).map(({ url, ...rest }) => rest),
          assigned_to: input.assigned_to ?? userId,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      invalidate();
      // Atribuir a outra pessoa tira a tarefa da lista de quem criou — a
      // confirmação precisa dizer para quem foi, senão parece que sumiu.
      const paraOutro = input.assigned_to && input.assigned_to !== userId;
      toast.success(
        paraOutro
          ? `Tarefa atribuída a ${input.assigneeName ?? 'outro usuário'}`
          : 'Tarefa criada',
      );
    },
    onError: (e: Error) => toast.error(`Erro ao criar tarefa: ${e.message}`),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await table()
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(`Erro ao atualizar tarefa: ${e.message}`),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<CreateTaskInput>) => {
      const payload: Record<string, unknown> = {};
      if (fields.title !== undefined) payload.title = fields.title.trim();
      if (fields.due_date !== undefined) payload.due_date = fields.due_date;
      if (fields.due_time !== undefined) payload.due_time = fields.due_time || null;
      if (fields.attachments !== undefined) {
        payload.attachments = fields.attachments.map(({ url, ...rest }) => rest);
      }

      const { error } = await table().update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(`Erro ao atualizar tarefa: ${e.message}`),
  });

  const deleteTask = useMutation({
    mutationFn: async (task: UserTask) => {
      const { error } = await table().delete().eq('id', task.id);
      if (error) throw error;
      // Best-effort: órfãos no bucket não quebram nada, mas limpamos quando dá.
      const paths = task.attachments.map(a => a.path).filter(Boolean);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    },
    onSuccess: () => { invalidate(); toast.success('Tarefa excluída'); },
    onError: (e: Error) => toast.error(`Erro ao excluir tarefa: ${e.message}`),
  });

  /** Anexa arquivos a uma tarefa já existente (botão de clipe no item da lista). */
  const attachFiles = useMutation({
    mutationFn: async ({ task, files }: { task: UserTask; files: File[] }) => {
      if (!userId) throw new Error('Usuário não identificado');
      const novos = await uploadTaskAttachments(files, userId);
      if (!novos.length) return;

      const merged = [...task.attachments, ...novos].map(({ url, ...rest }) => rest);
      const { error } = await table().update({ attachments: merged }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(`Erro ao anexar arquivo: ${e.message}`),
  });

  return { createTask, toggleTask, updateTask, deleteTask, attachFiles };
};
