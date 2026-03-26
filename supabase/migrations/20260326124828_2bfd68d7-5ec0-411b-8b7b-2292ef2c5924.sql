
-- Table: main_project_resources
CREATE TABLE public.main_project_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  main_project_id uuid NOT NULL REFERENCES public.main_projects(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('website', 'landingpage', 'presentation')),
  display_name text NOT NULL,
  url text,
  file_path text,
  file_name text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.main_project_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpr_select" ON public.main_project_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "mpr_insert" ON public.main_project_resources FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text]));
CREATE POLICY "mpr_update" ON public.main_project_resources FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text])) WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text]));
CREATE POLICY "mpr_delete" ON public.main_project_resources FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('main-project-resources', 'main-project-resources', false);

-- Storage RLS: read for authenticated
CREATE POLICY "mpr_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'main-project-resources');
CREATE POLICY "mpr_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'main-project-resources' AND get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text]));
CREATE POLICY "mpr_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'main-project-resources' AND get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text]));
CREATE POLICY "mpr_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'main-project-resources' AND get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'project_manager'::text]));
