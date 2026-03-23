
-- Drop existing policies on import_jobs
DROP POLICY IF EXISTS "ij_select" ON public.import_jobs;
DROP POLICY IF EXISTS "ij_insert" ON public.import_jobs;
DROP POLICY IF EXISTS "ij_update" ON public.import_jobs;

-- SELECT: authenticated users with admin or sales role can see all import jobs
CREATE POLICY "ij_select" ON public.import_jobs
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
  );

-- INSERT: admin/sales, must set started_by_user_id to own uid
CREATE POLICY "ij_insert" ON public.import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
    AND started_by_user_id = auth.uid()
  );

-- UPDATE: admin/sales, only own jobs
CREATE POLICY "ij_update" ON public.import_jobs
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
    AND started_by_user_id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
    AND started_by_user_id = auth.uid()
  );

-- Also tighten import_rows: only creator of the job can insert/update
DROP POLICY IF EXISTS "ir_select" ON public.import_rows;
DROP POLICY IF EXISTS "ir_insert" ON public.import_rows;
DROP POLICY IF EXISTS "ir_update" ON public.import_rows;

CREATE POLICY "ir_select" ON public.import_rows
  FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
  );

CREATE POLICY "ir_insert" ON public.import_rows
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
  );

CREATE POLICY "ir_update" ON public.import_rows
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('admin', 'sales')
  );
