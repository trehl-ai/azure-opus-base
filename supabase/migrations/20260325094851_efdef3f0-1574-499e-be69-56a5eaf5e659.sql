DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = get_public_user_id(auth.uid()))
  WITH CHECK (id = get_public_user_id(auth.uid()));