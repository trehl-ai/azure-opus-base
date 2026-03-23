CREATE OR REPLACE FUNCTION public.get_public_user_id(_auth_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  JOIN auth.users au
    ON lower(au.email) = lower(u.email)
  WHERE au.id = _auth_user_id
    AND u.is_active = true
  ORDER BY u.created_at ASC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM public.users u
  LEFT JOIN auth.users au
    ON lower(au.email) = lower(u.email)
  WHERE u.is_active = true
    AND (
      u.id = _user_id
      OR au.id = _user_id
    )
  ORDER BY u.created_at ASC
  LIMIT 1
$$;

DROP POLICY IF EXISTS ij_insert ON public.import_jobs;
DROP POLICY IF EXISTS ij_update ON public.import_jobs;

CREATE POLICY ij_insert
ON public.import_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text])
  AND started_by_user_id = public.get_public_user_id(auth.uid())
);

CREATE POLICY ij_update
ON public.import_jobs
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text])
  AND started_by_user_id = public.get_public_user_id(auth.uid())
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'sales'::text])
  AND started_by_user_id = public.get_public_user_id(auth.uid())
);