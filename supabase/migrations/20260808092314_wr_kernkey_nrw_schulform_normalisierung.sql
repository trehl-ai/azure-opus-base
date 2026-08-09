CREATE OR REPLACE FUNCTION public.wr_kernkey(p_name text, p_ort text DEFAULT NULL)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  WITH a AS (
    SELECT lower(coalesce(p_name,'')) AS n
  ), b AS (
    -- fuehrendes "Ort, " abschneiden
    SELECT regexp_replace(n, '^[^,]{2,30},\s*', '') AS n FROM a
  ), c AS (
    -- Schulform-Langformen und NRW-Kuerzel am Wortanfang entfernen
    SELECT regexp_replace(
             regexp_replace(n, '\((verb\.|verbund)\)', ' ', 'gi'),
             '^(staatliche\s+|staedtische\s+|städtische\s+|kath\.\s+|ev\.\s+|evangelische\s+|katholische\s+|gemeinschafts|gemeinschaftliche\s+)?'
             || '(gg|kg|eg|ge|gh|kh|rs|gy|bk|foe|fö|sk|pr|ps|gs|hs|se)\s+'
             || '|^(gemeinschaftsgrundschule|katholische\s+grundschule|evangelische\s+grundschule|gemeinschaftshauptschule|'
             || 'katholische\s+hauptschule|foerderschule|förderschule|berufskolleg|gesamtschule|sekundarschule|'
             || 'realschule|hauptschule|gymnasium|grundschule|primus-schule|primusschule)\s+',
             '', 'gi') AS n
    FROM b
  )
  SELECT public.wr_normkey(coalesce(p_ort,'') || (SELECT n FROM c));
$function$;

GRANT EXECUTE ON FUNCTION public.wr_kernkey(text, text) TO anon, authenticated, service_role;
