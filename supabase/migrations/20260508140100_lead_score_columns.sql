-- Add lead_score columns to companies (aggregated/manual score) and add the
-- lead_score_reason text column to both contacts and companies so the
-- LeadScoreBadge can carry tooltip rationale later.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS lead_score integer;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS lead_score_reason text;
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS lead_score_reason text;

COMMENT ON COLUMN public.companies.lead_score IS 'Aggregated lead score 0-100. Higher = hotter.';
COMMENT ON COLUMN public.companies.lead_score_reason IS 'Free-text rationale behind the score.';
COMMENT ON COLUMN public.contacts.lead_score_reason  IS 'Free-text rationale behind the score.';
