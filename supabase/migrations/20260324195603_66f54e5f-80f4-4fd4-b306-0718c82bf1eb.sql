-- Drop the old restrictive SELECT policy since the new broader one replaces it
DROP POLICY IF EXISTS "ues_select" ON public.user_email_signatures;