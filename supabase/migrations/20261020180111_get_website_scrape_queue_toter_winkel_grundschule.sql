-- get_website_scrape_queue: toter Winkel geschlossen.
-- Grundschul-Zeilen mit scrape_status='scraped', email IS NULL, score_status='pending', ohne Kontakt
-- wurden nie wieder eingereiht. Sie laufen jetzt wie Fehlerzeilen bis scrape_attempts = 3.
-- Kein neuer Statuswert: scrape_status bleibt wahr ('scraped'), kein Verbraucher muss einen
-- neuen Wert kennen. Rueckgabetyp, ORDER BY, LIMIT, SKIP LOCKED, attempts+1 unveraendert.
-- Rechte bleiben (CREATE OR REPLACE behaelt die ACL).

CREATE OR REPLACE FUNCTION public.get_website_scrape_queue(p_limit integer DEFAULT 80)
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
        -- Toter Winkel (20.10.2026): gescrapt, aber ohne Adresse und noch nicht bewertet.
        -- Gleiche Abbruchregel wie bei 'error' (drei Versuche). email_unklar,
        -- skipped_no_email und Zeilen mit Kontakt bleiben ausdruecklich draussen.
        -- Nur Grundschulen (Betreiberentscheidung 20.10., Variante c): bei den anderen
        -- Segmenten fuehrt ein Import ueber uuuW (VR Fit & Aktiv) ohne Sichtung zum Versand.
        OR (s.scrape_status = 'scraped' AND s.email IS NULL AND s.schulstufe = 'grundschule'
            AND s.score_status = 'pending' AND s.contact_id IS NULL
            AND s.scrape_attempts < 3
            -- Ministeriumsverzeichnis statt Schulseite: dort steht keine Adresse.
            AND s.website_url !~* '^https?://([a-z0-9-]+\.)*km\.bayern\.de(/|$)')
      )
    ORDER BY COALESCE(p.start_datum, DATE '2099-12-31'), s.created_at
    LIMIT p_limit
    FOR UPDATE OF s SKIP LOCKED
  )
  RETURNING q.id, q.schulname, q.ort, q.website_url, q.bundesland, q.schulnummer;
END;
$function$;
