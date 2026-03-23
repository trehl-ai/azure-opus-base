
-- Add contact_id and deal_id columns to email_messages
ALTER TABLE public.email_messages
  ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_email_messages_contact_id ON public.email_messages(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_email_messages_deal_id ON public.email_messages(deal_id) WHERE deal_id IS NOT NULL;
