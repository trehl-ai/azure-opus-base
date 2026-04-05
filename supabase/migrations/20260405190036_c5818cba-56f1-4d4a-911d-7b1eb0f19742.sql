
-- Fix the view to use security_invoker
DROP VIEW IF EXISTS public.users_public;
CREATE VIEW public.users_public
WITH (security_invoker = on)
AS
  SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
  FROM public.users;

GRANT SELECT ON public.users_public TO authenticated;

-- Create a SECURITY DEFINER function for safe team member listing
CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active
  FROM public.users u
  WHERE u.is_active = true
  ORDER BY u.first_name, u.last_name;
$$;
