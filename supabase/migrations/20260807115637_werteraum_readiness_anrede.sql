ALTER TABLE public.werteraum_school_queue
  ADD COLUMN IF NOT EXISTS bereitschaft text
  GENERATED ALWAYS AS (
    CASE
      WHEN email IS NULL OR btrim(email) = '' THEN 'keine_email'
      WHEN rektor_name IS NULL OR btrim(rektor_name) = '' THEN 'email_ohne_name'
      ELSE 'komplett'
    END
  ) STORED;

ALTER TABLE public.werteraum_school_queue
  ADD COLUMN IF NOT EXISTS anrede_final text
  GENERATED ALWAYS AS (
    CASE
      WHEN rektor_name IS NOT NULL AND btrim(rektor_name) <> '' THEN
        CASE
          WHEN rektor_anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(rektor_name)
          WHEN rektor_anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(rektor_name)
          ELSE 'Sehr geehrte/r ' || btrim(rektor_name)
        END
      ELSE 'Liebes Team der ' || btrim(schulname)
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_wsq_bereitschaft
  ON public.werteraum_school_queue (bundesland, schulstufe, bereitschaft);
