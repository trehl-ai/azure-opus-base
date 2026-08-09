ALTER TABLE public.werteraum_school_queue
  ADD COLUMN IF NOT EXISTS scrape_error text;

ALTER TABLE public.werteraum_school_queue
  ADD COLUMN IF NOT EXISTS scrape_attempts integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_website_scrape_queue(p_limit integer DEFAULT 80)
RETURNS TABLE(id uuid, schulname text, ort text, website_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.werteraum_school_queue q
  SET scrape_attempts = q.scrape_attempts + 1
  WHERE q.id IN (
    SELECT s.id
    FROM public.werteraum_school_queue s
    LEFT JOIN public.werteraum_kampagnen_plan p
      ON p.bundesland = s.bundesland
     AND p.segment    = COALESCE(s.schulstufe, 'grundschule')
     AND p.aktiv
    WHERE s.website_url IS NOT NULL
      AND (
        (s.scrape_status = 'found' AND s.scraped_at IS NULL)
        OR (s.scrape_status = 'error' AND s.scrape_attempts < 3)
      )
    ORDER BY COALESCE(p.start_datum, DATE '2099-12-31'), s.created_at
    LIMIT p_limit
    FOR UPDATE OF s SKIP LOCKED
  )
  RETURNING q.id, q.schulname, q.ort, q.website_url;
END;
$function$;
