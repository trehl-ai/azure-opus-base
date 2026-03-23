
-- Create task_statuses table
CREATE TABLE public.task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  color text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "ts_select" ON public.task_statuses FOR SELECT TO authenticated USING (true);

-- Only admins can manage
CREATE POLICY "ts_insert" ON public.task_statuses FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "ts_update" ON public.task_statuses FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "ts_delete" ON public.task_statuses FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Seed default statuses
INSERT INTO public.task_statuses (name, slug, position, is_active, is_default) VALUES
  ('To Do', 'todo', 1, true, true),
  ('In Progress', 'in_progress', 2, true, false),
  ('Review', 'review', 3, true, false),
  ('Done', 'done', 4, true, false);
