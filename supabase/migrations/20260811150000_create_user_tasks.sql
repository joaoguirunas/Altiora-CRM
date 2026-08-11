-- Aba TAREFAS (/tarefas).
--
-- Tabela de tarefas pessoais do usuário. A tela de Tarefas une, numa única
-- timeline por dia, as reuniões da Agenda (tabela `meetings`, não duplicadas
-- aqui) com as tarefas desta tabela.
--
-- assigned_to  = quem precisa executar (dono da tarefa; é quem vê na sua aba).
-- created_by   = quem criou. Quando created_by <> assigned_to a tarefa é
--                exibida com o badge "Equipe" (atribuída por um gestor/admin).
--
-- attachments: jsonb array de { name, path, url, mime, is_image, size }.
-- Arquivo fica no bucket `task-attachments` (bloco de storage abaixo);
-- guardamos o metadado inline porque a lista é curta e sempre lida junto
-- com a tarefa — não justifica tabela filha.

-- `is_authenticated()` não existe ainda neste schema (só is_admin() e
-- update_updated_at_column()). Helper simples reutilizável por outras
-- tabelas que só precisam de "usuário logado", sem checar role.
CREATE OR REPLACE FUNCTION public.is_authenticated()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
$function$;

CREATE TABLE IF NOT EXISTS public.user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  due_time time,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  assigned_to uuid REFERENCES public.settings_users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Consulta dominante: tarefas de um usuário num intervalo de datas (dia/semana).
CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_due
  ON public.user_tasks (assigned_to, due_date);

-- Atrasadas: pendentes com prazo vencido.
CREATE INDEX IF NOT EXISTS idx_user_tasks_pending
  ON public.user_tasks (assigned_to, due_date)
  WHERE done = false;

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tasks_select" ON public.user_tasks;
CREATE POLICY "user_tasks_select" ON public.user_tasks
  FOR SELECT USING (is_authenticated());

DROP POLICY IF EXISTS "user_tasks_insert" ON public.user_tasks;
CREATE POLICY "user_tasks_insert" ON public.user_tasks
  FOR INSERT WITH CHECK (is_authenticated());

DROP POLICY IF EXISTS "user_tasks_update" ON public.user_tasks;
CREATE POLICY "user_tasks_update" ON public.user_tasks
  FOR UPDATE USING (is_authenticated());

DROP POLICY IF EXISTS "user_tasks_delete" ON public.user_tasks;
CREATE POLICY "user_tasks_delete" ON public.user_tasks
  FOR DELETE USING (is_authenticated());

-- updated_at automático (mesma função usada pelas demais tabelas do schema).
DROP TRIGGER IF EXISTS update_user_tasks_updated_at ON public.user_tasks;
CREATE TRIGGER update_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Storage: anexos das tarefas ──────────────────────────────────────────────
-- Bucket privado: os anexos podem conter documentos de cliente (contrato,
-- proposta, print de conversa). Leitura via signed URL gerada pelo frontend.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "task_attachments_authenticated_read" ON storage.objects;
CREATE POLICY "task_attachments_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "task_attachments_authenticated_upload" ON storage.objects;
CREATE POLICY "task_attachments_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "task_attachments_authenticated_update" ON storage.objects;
CREATE POLICY "task_attachments_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "task_attachments_authenticated_delete" ON storage.objects;
CREATE POLICY "task_attachments_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-attachments');

NOTIFY pgrst, 'reload schema';
