-- Add company_name to users so each signature can carry the user's
-- company line between full-name and job-title.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name text;
