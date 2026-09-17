-- 17.09.2026: Die Buchung bringt ihre Schule selbst mit.
--
-- ANLASS, TT am 17.09.: "Gibt es eine Moeglichkeit, dass die Ansprechpartner
-- schon bei ihrem Call via cal.com ihre Schule ausfuellen?"
--
-- ⚠ DAS PROBLEM IST DREIMAL BELEGT:
--   Sabine Huber buchte ueber sh@gspocking.de, angeschrieben war
--     stefanie.schneider@gspocking.de — Zuordnung war Handarbeit.
--   Daniela Reuhl buchte ueber daniela.reuhl@schule.hessen.de, angeschrieben
--     war schulleitung@wibn.bad-nauheim.de — dasselbe.
--   Alena Frank: TT weiss bis heute nicht, welche Schule das war.
-- Wer ueber eine andere Adresse bucht als die angeschriebene, erzeugt einen
-- zweiten Deal ohne Firma.
--
-- cal.com liefert Buchungsfragen unter payload.responses als
-- {feld: {label, value}} — gemessen an Sabine Hubers Buchung. Die Struktur
-- ist da, nur die Felder fehlen noch.
--
-- ZWEI FELDER, beide Pflicht, in cal.com anzulegen:
--   "Ihre Schule" und "Ort", beide Freitext.
-- ⚠ WARUM ZWEI: Ein Feld allein erzeugt Schreibweisen, keine IDs — "GS
-- Pocking", "Grundschule Pocking", "Pocking". Mit dem Ort ist die Zuordnung
-- meist eindeutig, und wo nicht, steht wenigstens etwas da.
--
-- ⚠ DIE FIRMA WIRD NUR BEI GENAU EINEM TREFFER GESETZT. Bei mehreren oder
-- keinem bleibt sie leer, der Text steht in den Metadaten. Raten waere
-- schlechter als leer lassen — genau das hat die sieben Namenskollisionen
-- erzeugt, die am 15.09. aufgeloest wurden.

CREATE OR REPLACE FUNCTION public.cal_schule_aus_responses(p_responses jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  WITH felder AS (
    SELECT lower(coalesce(v->>'label', k)) AS label,
           btrim(coalesce(v->>'value', '')) AS wert
    FROM jsonb_each(coalesce(p_responses,'{}'::jsonb)) AS t(k, v)
    WHERE jsonb_typeof(v) = 'object'
  )
  SELECT jsonb_build_object(
    'schule', (SELECT wert FROM felder
               WHERE label ~ '(schule|einrichtung|institution)' AND wert <> '' LIMIT 1),
    'ort',    (SELECT wert FROM felder
               WHERE label ~ '(ort|stadt|city|plz)' AND wert <> ''
                 AND label !~ '(schule|einrichtung)' LIMIT 1)
  );
$function$;

COMMENT ON FUNCTION public.cal_schule_aus_responses(jsonb) IS
  'Liest Schule und Ort aus den cal.com-Buchungsfragen (payload.responses). Sucht im LABEL, nicht im technischen Feldnamen — cal.com vergibt Schluessel wie "attendeePhoneNumber", die Beschriftung ist das Stabile. Gibt {schule, ort} zurueck, beide koennen NULL sein.';

CREATE OR REPLACE FUNCTION public.cal_firma_finden(p_schule text, p_ort text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH kandidaten AS (
    SELECT co.id, co.name,
           CASE WHEN p_ort IS NOT NULL AND btrim(p_ort) <> ''
                     AND (co.city ILIKE '%' || btrim(p_ort) || '%'
                          OR co.name ILIKE '%' || btrim(p_ort) || '%')
                THEN 1 ELSE 2 END AS stufe
    FROM companies co
    WHERE co.deleted_at IS NULL
      AND p_schule IS NOT NULL AND length(btrim(p_schule)) >= 4
      AND co.name ILIKE '%' || btrim(p_schule) || '%'
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
    'wie',        CASE WHEN (SELECT min(stufe) FROM kandidaten) = 1
                       THEN 'name_und_ort' ELSE 'nur_name' END
  );
$function$;

COMMENT ON FUNCTION public.cal_firma_finden(text, text) IS
  'Sucht die Firma zu einer im cal.com-Formular genannten Schule. Treffer mit passendem Ort gehen vor; company_id kommt NUR bei genau einem Treffer zurueck. Bei mehreren oder keinem bleibt sie NULL — Raten hat die Namenskollisionen erzeugt, die am 15.09. aufgeloest wurden.';

REVOKE ALL ON FUNCTION public.cal_firma_finden(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cal_firma_finden(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cal_firma_finden(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cal_firma_finden(text, text) TO authenticated;