
-- Fix: restrict user_email_signatures SELECT to own rows only
DROP POLICY IF EXISTS "ues_select_profile_image_all" ON public.user_email_signatures;

CREATE POLICY "ues_select_own" ON public.user_email_signatures
FOR SELECT TO authenticated
USING (user_id = public.get_public_user_id(auth.uid()));

-- Function for cross-user profile image access (needed for signature display)
CREATE OR REPLACE FUNCTION public.get_user_profile_image(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT profile_image_path
  FROM public.user_email_signatures
  WHERE user_id = p_user_id
    AND is_active = true
  LIMIT 1;
$$;
