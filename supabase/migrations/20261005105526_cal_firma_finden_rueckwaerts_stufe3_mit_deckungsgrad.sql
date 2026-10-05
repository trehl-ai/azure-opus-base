CREATE OR REPLACE FUNCTION public.cal_firma_finden(p_schule text, p_ort text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- B13 Teil 2 (05.10.2026): Die Suche lief bisher NUR vorwaerts
  -- (co.name ILIKE '%eingabe%'). Das setzt voraus, dass die Formulareingabe
  -- ein Teilstring des CRM-Namens ist. Belegt gescheitert am 29.09. bei
  -- Kay Hertel: Eingabe "Turley-Oberschule Oelsnitz/Erzgeb." ist LAENGER als
  -- der CRM-Name "Turley-Oberschule Oelsnitz" -> treffer 0 -> Dublette 0a4769c5.
  --
  -- NEU: Stufen 3 und 4 suchen rueckwaerts (CRM-Name steckt in der Eingabe).
  -- Zwei Schutzregeln, beide gemessen noetig:
  --   * Mindestlaenge 12 Zeichen. Sonst greift die Firma "Gymnasium"
  --     (verdrehter Importdatensatz, city = "Halle (Saale) Christian-Wolff-")
  --     in "Hans-Geiger-Gymnasium" und zerstoert den funktionierenden Kieler Fall.
  --   * Deckungsgrad >= 0.75. Die Laengenschwelle allein reicht NICHT:
  --     126 Firmennamen ab 12 Zeichen stecken in laengeren Namen, darunter
  --     generische wie "Gesamtschule" (genau 12) oder "Lutherschule".
  --     Stuende nur der generische im Bestand, waere er ein EINDEUTIGER
  --     Falschtreffer — stiller und teurer als eine Dublette.
  --     Oelsnitz liegt bei 26/34 = 0.76 und wird erfasst.
  --
  -- Rangfolge bleibt erhalten: beste = min(stufe). Vorwaerts (1/2) gewinnt
  -- immer gegen rueckwaerts (3/4), rueckwaerts greift nur, wenn vorwaerts
  -- nichts findet.
  WITH kandidaten AS (
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
  beste AS (
    SELECT id, name FROM kandidaten
    WHERE stufe = (SELECT min(stufe) FROM kandidaten)
  ),
  gezaehlt AS (SELECT count(*) AS n FROM beste)
  SELECT jsonb_build_object(
    'treffer',    (SELECT n FROM gezaehlt),
    -- NUR bei genau einem Treffer.
    'company_id', CASE WHEN (SELECT n FROM gezaehlt) = 1
                       THEN (SELECT id FROM beste LIMIT 1) END,
    'name',       CASE WHEN (SELECT n FROM gezaehlt) = 1
                       THEN (SELECT name FROM beste LIMIT 1) END,
    'wie',        CASE (SELECT min(stufe) FROM kandidaten)
                    WHEN 1 THEN 'name_und_ort'
                    WHEN 2 THEN 'nur_name'
                    WHEN 3 THEN 'rueckwaerts_name_und_ort'
                    WHEN 4 THEN 'rueckwaerts_nur_name'
                  END
  );
$function$;