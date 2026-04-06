
-- Tighten the "Team can view system emails" policy to admin/sales roles only
DROP POLICY IF EXISTS "Team can view system emails linked to entities" ON public.email_messages;

CREATE POLICY "Team can view system emails linked to entities"
ON public.email_messages
FOR SELECT
TO authenticated
USING (
  (provider = 'resend' AND (contact_id IS NOT NULL OR deal_id IS NOT NULL))
  AND get_user_role(auth.uid()) IN ('admin', 'sales')
);
