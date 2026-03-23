
-- task_attachments table
CREATE TABLE public.task_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_by_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ta_select" ON public.task_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ta_insert" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','sales','project_manager']));
CREATE POLICY "ta_delete" ON public.task_attachments FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','sales','project_manager']));

-- task_links table
CREATE TABLE public.task_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  created_by_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tl_select" ON public.task_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "tl_insert" ON public.task_links FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','sales','project_manager']));
CREATE POLICY "tl_update" ON public.task_links FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','sales','project_manager']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','sales','project_manager']));
CREATE POLICY "tl_delete" ON public.task_links FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','sales','project_manager']));

-- Storage bucket for task files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-files',
  'task-files',
  false,
  20971520,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/png','image/jpeg','image/jpg','text/plain']
);

-- Storage policies
CREATE POLICY "task_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-files');
CREATE POLICY "task_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files');
CREATE POLICY "task_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-files');
