
-- 1. main_projects table
CREATE TABLE public.main_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366F1',
  image_path text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.main_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "main_projects_select" ON public.main_projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "main_projects_insert" ON public.main_projects
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "main_projects_update" ON public.main_projects
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "main_projects_delete" ON public.main_projects
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Seed data
INSERT INTO public.main_projects (name, color) VALUES
  ('Werteraum', '#6366F1'),
  ('Viktoria Rebensburg', '#EC4899');

-- 2. Add main_project_id FK to projects
ALTER TABLE public.projects
  ADD COLUMN main_project_id uuid REFERENCES public.main_projects(id) ON DELETE SET NULL;

-- 3. project_resources table
CREATE TABLE public.project_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('website', 'landingpage', 'presentation')),
  display_name text NOT NULL,
  url text,
  file_path text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select" ON public.project_resources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pr_insert" ON public.project_resources
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']));

CREATE POLICY "pr_update" ON public.project_resources
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']));

CREATE POLICY "pr_delete" ON public.project_resources
  FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']));

-- 4. Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('main-project-images', 'main-project-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-resources', 'project-resources', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for main-project-images (public read, admin write)
CREATE POLICY "main_proj_img_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'main-project-images');

CREATE POLICY "main_proj_img_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'main-project-images' AND get_user_role(auth.uid()) = 'admin');

CREATE POLICY "main_proj_img_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'main-project-images' AND get_user_role(auth.uid()) = 'admin');

CREATE POLICY "main_proj_img_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'main-project-images' AND get_user_role(auth.uid()) = 'admin');

-- Storage policies for project-resources
CREATE POLICY "proj_res_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-resources');

CREATE POLICY "proj_res_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-resources' AND get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']));

CREATE POLICY "proj_res_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-resources' AND get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']));

CREATE POLICY "proj_res_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-resources' AND get_user_role(auth.uid()) = ANY (ARRAY['admin', 'project_manager']));
