-- create_task_statuses: backfill missing public.task_statuses table queried by useTaskStatuses
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text,
  position int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.task_statuses (name, color, position, is_active) VALUES
  ('Offen', '#6B7280', 1, true),
  ('In Bearbeitung', '#3B82F6', 2, true),
  ('Erledigt', '#10B981', 3, true),
  ('Blockiert', '#EF4444', 4, true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read" ON public.task_statuses;
CREATE POLICY "authenticated_read" ON public.task_statuses
  FOR SELECT
  USING (auth.role() = 'authenticated');
