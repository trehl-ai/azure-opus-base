
-- Fix campaigns RLS policies to use public user ID mapping
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;

CREATE POLICY "Users can view own campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can insert own campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can update own campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()))
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
  FOR DELETE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

-- Fix email_messages RLS policies to use public user ID mapping
DROP POLICY IF EXISTS "Users can view own messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.email_messages;

CREATE POLICY "Users can view own messages" ON public.email_messages
  FOR SELECT TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can insert own messages" ON public.email_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can update own messages" ON public.email_messages
  FOR UPDATE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()))
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

CREATE POLICY "Users can delete own messages" ON public.email_messages
  FOR DELETE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));
