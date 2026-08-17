ALTER TABLE public.eis_contacts
  ADD COLUMN IF NOT EXISTS herkunft text;

COMMENT ON COLUMN public.eis_contacts.herkunft IS
  'Woher stammt der Kontakt und in welcher Beziehung steht er zu eo ipso. Wird vom Research-Workflow IPXhLJgpxjr88NyS NICHT ueberschrieben — im Gegensatz zu personal_insights, das der Gemini-Lauf ersetzt. Hier gehoert alles hinein, was dauerhaft gelten soll.';