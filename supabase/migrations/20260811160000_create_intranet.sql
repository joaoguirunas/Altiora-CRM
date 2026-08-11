-- Aba INTRANET (/intranet).
--
-- Biblioteca interna publicada pelo admin: treinamentos, modelos de contrato,
-- links úteis. Duas tabelas:
--
--   intranet_categories — seções da página, criadas/reordenadas pelo admin.
--   intranet_items      — conteúdo dentro de uma categoria. Cada item tem
--                         título, descrição, uma URL opcional e uma lista de
--                         anexos. Link e anexo coexistem no mesmo item.
--
-- attachments: jsonb array de { name, path, mime, size, is_image } — mesmo
-- formato de user_tasks.attachments. Arquivo mora no bucket `intranet-files`
-- (bloco de storage abaixo); o metadado fica inline.
--
-- RLS: leitura para qualquer autenticado, escrita restrita a is_admin() —
-- já existe neste schema (20260507160901_fix_usr_01_settings_users_rls_writes.sql),
-- não é redefinida aqui.

CREATE TABLE IF NOT EXISTS public.intranet_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  -- Ícone lucide (nome da chave em CATEGORY_ICONS no frontend). Livre no banco
  -- para não precisar de migration a cada ícone novo; o frontend faz fallback.
  icon text,
  -- Ordem manual na página. Gap de 10 entre itens deixa espaço para inserir
  -- no meio sem reescrever a coluna toda.
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intranet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.intranet_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  -- Link externo (Drive, Notion, YouTube...). Opcional: o item pode ser só anexo.
  url text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  -- Rascunho: admin monta o item e só depois publica para o time.
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Item sem link e sem anexo não tem para onde levar o usuário.
ALTER TABLE public.intranet_items
  DROP CONSTRAINT IF EXISTS intranet_items_has_content;
ALTER TABLE public.intranet_items
  ADD CONSTRAINT intranet_items_has_content
  CHECK (url IS NOT NULL OR jsonb_array_length(attachments) > 0);

-- Consulta dominante: itens de uma categoria na ordem de exibição.
CREATE INDEX IF NOT EXISTS idx_intranet_items_category
  ON public.intranet_items (category_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_intranet_categories_order
  ON public.intranet_categories (sort_order);

ALTER TABLE public.intranet_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intranet_items      ENABLE ROW LEVEL SECURITY;

-- ── RLS: leitura para todos, escrita só admin ────────────────────────────────

DROP POLICY IF EXISTS "intranet_categories_select" ON public.intranet_categories;
CREATE POLICY "intranet_categories_select" ON public.intranet_categories
  FOR SELECT USING (is_authenticated());

DROP POLICY IF EXISTS "intranet_categories_insert" ON public.intranet_categories;
CREATE POLICY "intranet_categories_insert" ON public.intranet_categories
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "intranet_categories_update" ON public.intranet_categories;
CREATE POLICY "intranet_categories_update" ON public.intranet_categories
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "intranet_categories_delete" ON public.intranet_categories;
CREATE POLICY "intranet_categories_delete" ON public.intranet_categories
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "intranet_items_select" ON public.intranet_items;
CREATE POLICY "intranet_items_select" ON public.intranet_items
  FOR SELECT USING (is_authenticated());

DROP POLICY IF EXISTS "intranet_items_insert" ON public.intranet_items;
CREATE POLICY "intranet_items_insert" ON public.intranet_items
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "intranet_items_update" ON public.intranet_items;
CREATE POLICY "intranet_items_update" ON public.intranet_items
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "intranet_items_delete" ON public.intranet_items;
CREATE POLICY "intranet_items_delete" ON public.intranet_items
  FOR DELETE USING (is_admin());

-- updated_at automático (mesma função usada pelas demais tabelas do schema).
DROP TRIGGER IF EXISTS update_intranet_categories_updated_at ON public.intranet_categories;
CREATE TRIGGER update_intranet_categories_updated_at
  BEFORE UPDATE ON public.intranet_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_intranet_items_updated_at ON public.intranet_items;
CREATE TRIGGER update_intranet_items_updated_at
  BEFORE UPDATE ON public.intranet_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Storage: anexos da intranet ─────────────────────────────────────────────
-- Bucket privado com leitura via signed URL, igual a `task-attachments`.
-- Escrita/remoção só para admin — o SELECT aberto a authenticated é o que
-- permite o time gerar signed URL e baixar.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intranet-files',
  'intranet-files',
  false,
  52428800, -- 50 MB: cabe treinamento em vídeo curto e PDF de manual
  ARRAY[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'text/plain','text/csv',
    'video/mp4','video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "intranet_files_authenticated_read" ON storage.objects;
CREATE POLICY "intranet_files_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'intranet-files');

DROP POLICY IF EXISTS "intranet_files_admin_upload" ON storage.objects;
CREATE POLICY "intranet_files_admin_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'intranet-files' AND public.is_admin());

DROP POLICY IF EXISTS "intranet_files_admin_update" ON storage.objects;
CREATE POLICY "intranet_files_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'intranet-files' AND public.is_admin());

DROP POLICY IF EXISTS "intranet_files_admin_delete" ON storage.objects;
CREATE POLICY "intranet_files_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'intranet-files' AND public.is_admin());

NOTIFY pgrst, 'reload schema';
