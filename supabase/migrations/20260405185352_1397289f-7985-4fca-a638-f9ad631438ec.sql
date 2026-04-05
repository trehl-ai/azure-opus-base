
-- 1. PRIVILEGE ESCALATION FIX: Prevent non-admin users from changing their own role
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  caller_role text;
BEGIN
  -- If role is not being changed, allow
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Check if the caller is admin
  caller_role := public.get_user_role(auth.uid());
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 2. USERS TABLE EXPOSURE FIX: Create a public view hiding sensitive columns
CREATE OR REPLACE VIEW public.users_public
WITH (security_invoker = on)
AS
  SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
  FROM public.users;

-- 3. TASK-FILES STORAGE FIX: Drop and recreate storage policies with role checks
DROP POLICY IF EXISTS "task_files_select" ON storage.objects;
DROP POLICY IF EXISTS "task_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_files_delete" ON storage.objects;

CREATE POLICY "task_files_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-files'
  AND public.get_user_role(auth.uid()) IN ('admin', 'sales', 'project_manager', 'management', 'read_only')
);

CREATE POLICY "task_files_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-files'
  AND public.get_user_role(auth.uid()) IN ('admin', 'sales', 'project_manager')
);

CREATE POLICY "task_files_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-files'
  AND public.get_user_role(auth.uid()) IN ('admin', 'project_manager')
);
