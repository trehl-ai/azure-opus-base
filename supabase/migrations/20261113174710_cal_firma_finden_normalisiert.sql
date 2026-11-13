CREATE OR REPLACE FUNCTION public.cal_firma_finden(p_schule text, p_ort text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- B13 Teil 2 (05.10.2026): Stufen 1-4 (vorwaerts/rueckwaerts ILIKE), siehe Migration 20261005105526.
  -- 13.11.2026 (a2e20ea3): Stufen 5/6 = normalisierter Vorwaerts-Vergleich (klein, Umlaute ae/oe/ue/ss,
  -- alles ausser a-z0-9 entfernt). Greift NUR, wenn Stufen 1-4 gar keinen Kandidaten liefern.
  -- Damit aendert sich kein bisheriger Treffer. Beleg: Formular "Raichbergrealschule" (04.11.)
  -- fand "Raichberg-Realschule Stuttgart" nicht -> eigener Deal ohne Schule.
  -- Mindestlaenge normalisierte Eingabe 10 Zeichen; Zuordnung weiter nur bei genau 1 Treffer.
  WITH norm AS (
    SELECT regexp_replace(replace(replace(replace(replace(lower(coalesce(p_schule,'')),'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'[^a-z0-9]','','g') AS ns,
           regexp_replace(replace(replace(replace(replace(lower(coalesce(p_ort,'')),'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'[^a-z0-9]','','g') AS no
  ),
  kand_alt AS (
    SELECT co.id, co.name,
           CASE
             WHEN co.name ILIKE '%' || btrim(p_schule) || '%'
                  AND p_ort IS NOT NULL AND btrim(p_ort) <> ''
                  AND (co.city ILIKE '%' || btrim(p_ort) || '%'
                       OR co.name ILIKE '%' || btrim(p_ort) || '%')
               THEN 1
             WHEN co.name ILIKE '%' || btrim(p_schule) || '%'
               THEN 2
             WHEN p_ort IS NOT NULL AND btrim(p_ort) <> ''
                  AND (co.city ILIKE '%' || btrim(p_ort) || '%'
                       OR co.name ILIKE '%' || btrim(p_ort) || '%')
               THEN 3
             ELSE 4
           END AS stufe
    FROM companies co
    WHERE co.deleted_at IS NULL
      AND p_schule IS NOT NULL AND length(btrim(p_schule)) >= 4
      AND (
            co.name ILIKE '%' || btrim(p_schule) || '%'
            OR (
                 btrim(p_schule) ILIKE '%' || btrim(co.name) || '%'
                 AND length(btrim(co.name)) >= 12
                 AND length(btrim(co.name))::numeric / length(btrim(p_schule)) >= 0.75
               )
          )
  ),
  kand_norm AS (
    SELECT co.id, co.name,
           CASE WHEN n.no <> ''
                     AND (regexp_replace(replace(replace(replace(replace(lower(coalesce(co.city,'')),'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'[^a-z0-9]','','g') LIKE '%' || n.no || '%'
                          OR regexp_replace(replace(replace(replace(replace(lower(co.name),'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'[^a-z0-9]','','g') LIKE '%' || n.no || '%')
                THEN 5 ELSE 6 END AS stufe
    FROM companies co CROSS JOIN norm n
    WHERE co.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM kand_alt)
      AND length(n.ns) >= 10
      AND regexp_replace(replace(replace(replace(replace(lower(co.name),'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'[^a-z0-9]','','g') LIKE '%' || n.ns || '%'
  ),
  kandidaten AS (
    SELECT id, name, stufe FROM kand_alt
    UNION ALL
    SELECT id, name, stufe FROM kand_norm
  ),
  beste AS (
    SELECT id, name FROM kandidaten
    WHERE stufe = (SELECT min(stufe) FROM kandidaten)
  ),
  gezaehlt AS (SELECT count(*) AS n FROM beste)
  SELECT jsonb_build_object(
    'treffer',    (SELECT n FROM gezaehlt),
    'company_id', CASE WHEN (SELECT n FROM gezaehlt) = 1
                       THEN (SELECT id FROM beste LIMIT 1) END,
    'name',       CASE WHEN (SELECT n FROM gezaehlt) = 1
                       THEN (SELECT name FROM beste LIMIT 1) END,
    'wie',        CASE (SELECT min(stufe) FROM kandidaten)
                    WHEN 1 THEN 'name_und_ort'
                    WHEN 2 THEN 'nur_name'
                    WHEN 3 THEN 'rueckwaerts_name_und_ort'
                    WHEN 4 THEN 'rueckwaerts_nur_name'
                    WHEN 5 THEN 'normalisiert_name_und_ort'
                    WHEN 6 THEN 'normalisiert_nur_name'
                  END
  );
$function$;