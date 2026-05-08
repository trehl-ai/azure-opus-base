-- create_import_jobs: backfill missing public.import_jobs table queried by Import.tsx
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status text DEFAULT 'pending',
  type text,
  total_rows int DEFAULT 0,
  processed_rows int DEFAULT 0,
  error_log jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_only_import_jobs" ON public.import_jobs;
CREATE POLICY "admin_only_import_jobs" ON public.import_jobs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
