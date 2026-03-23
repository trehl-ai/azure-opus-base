
-- Fix email_accounts RLS policies to use public user ID mapping
DROP POLICY IF EXISTS "Users can view own accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.email_accounts;

CREATE POLICY "Users can view own accounts" ON public.email_accounts
  FOR SELECT TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can insert own accounts" ON public.email_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can update own accounts" ON public.email_accounts
  FOR UPDATE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()))
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can delete own accounts" ON public.email_accounts
  FOR DELETE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));
