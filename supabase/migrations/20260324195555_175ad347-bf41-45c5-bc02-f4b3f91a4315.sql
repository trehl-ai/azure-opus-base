-- Allow all authenticated users to read profile_image_path from user_email_signatures
-- This is needed so profile images can be displayed in the sidebar and user lists
CREATE POLICY "ues_select_profile_image_all"
ON public.user_email_signatures
FOR SELECT
TO authenticated
USING (true);
