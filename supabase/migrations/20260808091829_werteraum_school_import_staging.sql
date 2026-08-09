CREATE TABLE IF NOT EXISTS public.werteraum_school_import (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch        text NOT NULL DEFAULT 'startchancen_luecke_20260808',
  bundesland   text,
  schulname    text,
  ort          text,
  plz          text,
  schulform    text,
  schulstufe   text,
  website_url  text,
  normkey      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsi_batch      ON public.werteraum_school_import (batch);
CREATE INDEX IF NOT EXISTS idx_wsi_normkey    ON public.werteraum_school_import (bundesland, normkey);

CREATE OR REPLACE FUNCTION public.wr_normkey(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT regexp_replace(
           translate(
             lower(coalesce(p_name,'')),
             'äöüßáàâéèêíìîóòôúùû',
             'aoused'
           ),
           '[^a-z0-9]', '', 'g'
         );
$function$;

CREATE INDEX IF NOT EXISTS idx_wsq_normkey
  ON public.werteraum_school_queue (bundesland, public.wr_normkey(schulname));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.werteraum_school_import TO service_role;
GRANT EXECUTE ON FUNCTION public.wr_normkey(text) TO anon, authenticated, service_role;
