CREATE OR REPLACE FUNCTION public.get_scrape_queue(p_limit integer DEFAULT 20, p_bundesland text DEFAULT NULL::text)
RETURNS TABLE(id uuid, schulname text, ort text, bundesland text)
LANGUAGE sql
STABLE
AS $function$
  select q.id, q.schulname, q.ort, q.bundesland
  from public.werteraum_school_queue q
  left join public.werteraum_kampagnen_plan p
    on p.bundesland = q.bundesland
   and p.segment    = coalesce(q.schulstufe, 'grundschule')
   and p.aktiv
  where q.scrape_status = 'pending'
    and q.website_url is null
    and (p_bundesland is null or q.bundesland = p_bundesland)
  order by coalesce(p.start_datum, date '2099-12-31'), q.created_at
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_website_scrape_queue(p_limit integer DEFAULT 80)
RETURNS TABLE(id uuid, schulname text, ort text, website_url text)
LANGUAGE sql
STABLE
AS $function$
  select q.id, q.schulname, q.ort, q.website_url
  from public.werteraum_school_queue q
  left join public.werteraum_kampagnen_plan p
    on p.bundesland = q.bundesland
   and p.segment    = coalesce(q.schulstufe, 'grundschule')
   and p.aktiv
  where q.scrape_status = 'found'
    and q.website_url is not null
    and q.scraped_at is null
  order by coalesce(p.start_datum, date '2099-12-31'), q.created_at
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_scoring_queue(p_limit integer DEFAULT 10)
RETURNS SETOF werteraum_school_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE werteraum_school_queue
  SET score_status = 'processing'
  WHERE id IN (
    SELECT q.id FROM werteraum_school_queue q
    LEFT JOIN werteraum_kampagnen_plan p
      ON p.bundesland = q.bundesland
     AND p.segment    = COALESCE(q.schulstufe, 'grundschule')
     AND p.aktiv
    WHERE q.scrape_status IN ('scraped', 'found')
      AND q.score_status = 'pending'
      AND q.email IS NOT NULL
    ORDER BY COALESCE(p.start_datum, DATE '2099-12-31'), q.created_at
    LIMIT p_limit
    FOR UPDATE OF q SKIP LOCKED
  )
  RETURNING *;
END;
$function$;
