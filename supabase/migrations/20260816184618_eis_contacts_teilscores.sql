ALTER TABLE public.eis_contacts
  ADD COLUMN IF NOT EXISTS company_size_score      smallint,
  ADD COLUMN IF NOT EXISTS csr_signal_score        smallint,
  ADD COLUMN IF NOT EXISTS sponsor_affinity_score  smallint,
  ADD COLUMN IF NOT EXISTS decision_maker_score    smallint,
  ADD COLUMN IF NOT EXISTS regional_fit_score      smallint;

COMMENT ON COLUMN public.eis_contacts.company_size_score IS 'Teilscore, max 25. Spiegelt eis_lead_queue. Summe der fuenf Teilscores = final_score.';
COMMENT ON COLUMN public.eis_contacts.csr_signal_score IS 'Teilscore, max 25.';
COMMENT ON COLUMN public.eis_contacts.sponsor_affinity_score IS 'Teilscore, max 20. Bei ssteo-Bestandskunden hoch, weil bereits angefragt.';
COMMENT ON COLUMN public.eis_contacts.decision_maker_score IS 'Teilscore, max 20.';
COMMENT ON COLUMN public.eis_contacts.regional_fit_score IS 'Teilscore, max 10.';