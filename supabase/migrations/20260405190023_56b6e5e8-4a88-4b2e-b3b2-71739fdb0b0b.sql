
-- 1. Restrict direct users table SELECT
DROP POLICY IF EXISTS "users_select" ON public.users;

-- Admins can read all rows
CREATE POLICY "users_select_admin" ON public.users
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- Non-admins can only read their own row
CREATE POLICY "users_select_own" ON public.users
FOR SELECT TO authenticated
USING (id = public.get_public_user_id(auth.uid()));

-- 2. Recreate users_public view WITHOUT security_invoker so all authenticated users
-- can list team members through it (only safe columns exposed)
DROP VIEW IF EXISTS public.users_public;
CREATE VIEW public.users_public AS
  SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
  FROM public.users;

-- Grant access to the view
GRANT SELECT ON public.users_public TO authenticated;
