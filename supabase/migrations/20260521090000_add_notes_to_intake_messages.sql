-- Add notes column + 'archived' status value to intake_messages.
--
-- Free-text bug-report emails sent to sales@trehl-ai.com are misclassified as
-- 'rejected' by the structured-data parser (which only knows how to extract
-- contact/deal payloads). An admin then needs to (a) record why the message
-- was cleared and (b) move it out of the 'rejected' bucket so it stops
-- showing up in health-check alerts. The existing status enum had no slot
-- for "manually triaged, no further action" — 'archived' fills that gap.

ALTER TABLE public.intake_messages
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.intake_messages
  DROP CONSTRAINT IF EXISTS intake_messages_status_check;

ALTER TABLE public.intake_messages
  ADD CONSTRAINT intake_messages_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'parsed'::text, 'review_required'::text, 'approved'::text, 'imported'::text, 'rejected'::text, 'archived'::text]));

NOTIFY pgrst, 'reload schema';
