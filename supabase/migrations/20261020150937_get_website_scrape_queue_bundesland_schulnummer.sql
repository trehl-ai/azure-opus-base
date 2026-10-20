-- get_website_scrape_queue: RETURNS TABLE um bundesland und schulnummer erweitert.
-- Anlass: Herkunftsfilter in tTlV "Parse Gemini" (20.10.2026) braucht das Bundesland
-- der Zeile (amtliche Traegerdomains: bayern.de, schule.hessen.de, nrw.de, bildung-lsa.de)
-- und die Schulnummer (Zugehoerigkeit ueber den Lokalteil, z. B. 2723.msl-sekretariat@bayern.de).
-- NUR zusaetzliche Felder am Ende. WHERE, ORDER BY, LIMIT, FOR UPDATE SKIP LOCKED und das
-- Hochzaehlen von scrape_attempts sind unveraendert. VOLATILE (Standard) und SECURITY DEFINER bleiben.
-- Ein geaenderter Rueckgabetyp geht nicht mit CREATE OR REPLACE (42P13), daher DROP + CREATE
-- in derselben Transaktion. Rechte danach exakt wie vorher (live 20.10.):
--   {postgres=X, authenticated=X, service_role=X}, kein PUBLIC, kein anon.
-- NACH dem Anwenden: NOTIFY pgrst, 'reload schema'; im Dashboard-SQL-Editor, sonst liefert
-- PostgREST weiter die alte Signatur aus dem Schema-Cache.

DROP FUNCTION public.get_website_scrape_queue(integer);

CREATE FUNCTION public.get_website_scrape_queue(p_limit integer DEFAULT 80)
 RETURNS TABLE(id uuid, schulname text, ort text, website_url text, bundesland text, schulnummer text)
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
  RETURNING q.id, q.schulname, q.ort, q.website_url, q.bundesland, q.schulnummer;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_website_scrape_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_website_scrape_queue(integer) TO authenticated, service_role;
