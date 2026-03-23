-- Allow all authenticated users to see system-sent emails (provider='resend')
-- that are linked to a contact or deal, enabling team-wide CRM visibility.
CREATE POLICY "Team can view system emails linked to entities"
ON public.email_messages
FOR SELECT
TO authenticated
USING (
  provider = 'resend'
  AND (contact_id IS NOT NULL OR deal_id IS NOT NULL)
);