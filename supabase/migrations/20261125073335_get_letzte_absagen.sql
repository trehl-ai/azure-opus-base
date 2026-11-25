-- Letzte Absagen (go Absagen-Board, Tomi 25.11.2026). Quelle: ~/eic-001/work/absagen_board_entwurf_20261124.sql.
-- Fuer die Dashboard-Karte "Letzte Absagen" im eo ipso Boost CRM. Kein Filter auf lost_reason.
-- Rollback-Test 25.11.: als Tomi 42 Zeilen, als eingeschraenkter Nutzer 29 (nur Werteraum - Schulen), anon 42501.
-- get_letzte_absagen(p_limit): verlorene Deals (status lost, deleted_at IS NULL) mit mindestens einer email_reply;
-- je Deal die juengste Antwort, sortiert nach antwort_am absteigend. Testdeals ("ZZ TEST…") ausgeschlossen.
--
-- Rechte (Recon 24.11.): SECURITY DEFINER mit ausdruecklichem Filter user_can_access_pipeline(d.pipeline_id),
-- gleiches Muster wie get_aktionsliste. Der eingeschraenkte Nutzer (user_pipeline_restrictions -> nur
-- "Werteraum - Schulen") bekommt damit nur WR-Deals; ohne Einschraenkung (und fuer service_role, auth.uid() NULL) alle.
-- EXECUTE: REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT authenticated, service_role.
--
-- aussage = Antworttext ohne zitierte Originalmail und ohne Metazeilen von Hand-Nachtraegen, Leerraum
-- zusammengezogen, hoechstens 400 Zeichen (399 + "…"). Reihenfolge der Bereinigung:
--   1. \r entfernen
--   2. Hand-Nachtrag vorn: Absatz, der mit "Eingang " beginnt (bis zur ersten Leerzeile)
--   3. Kopfblock vorn: Zeilen "Von:/An:/Cc:/Betreff:/Gesendet:/Eingang:/Datum:" am Anfang
--   4. Praefix "Wortlaut:", "Inhalt:", "Text laut Screenshot …:" am Anfang
--   5. Abschneiden vor: "-----Ursprüngliche Nachricht", Zeile "Am … schrieb", Zeile "On … wrote",
--      Zeile aus >= 10 Unterstrichen, Zeile "Von:" (im Zitatteil, der Kopf vorn ist da schon weg),
--      Zitatzeile ">", Signaturtrenner "-- "
--   6. Schluss-Notiz in Klammern am Ende, z. B. "(aus intake_unzugeordnet …)", "(Antwort auf die Handmail …)"
--   7. Leerraum auf ein Leerzeichen, trimmen, kappen

CREATE OR REPLACE FUNCTION public.get_letzte_absagen(p_limit integer DEFAULT 10)
 RETURNS TABLE(antwort_am timestamp with time zone, deal_id uuid, deal_titel text, pipeline_name text,
               art text, lost_reason text, aussage text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH letzte AS (
    SELECT DISTINCT ON (d.id)
           a.created_at AS antwort_am, d.id AS deal_id, d.title AS deal_titel, p.name AS pipeline_name,
           CASE WHEN p.name ILIKE '%Stiftung%' THEN 'Stiftung'
                WHEN p.name ILIKE '%Schule%'   THEN 'Schule'
                ELSE 'Sonstige' END AS art,
           d.lost_reason, a.description AS roh
      FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
      JOIN deal_activities a ON a.deal_id = d.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL
     WHERE d.status = 'lost' AND d.deleted_at IS NULL
       AND coalesce(d.title, '') NOT LIKE 'ZZ TEST%'
       AND public.user_can_access_pipeline(d.pipeline_id)
     ORDER BY d.id, a.created_at DESC, a.id DESC
  ),
  s AS (
    SELECT l.*,
      btrim(regexp_replace(
        regexp_replace(                                                         -- 6. Schluss-Notiz
          (regexp_split_to_array(                                                -- 5. Zitat / Signatur
           (regexp_split_to_array(
            (regexp_split_to_array(
             (regexp_split_to_array(
              (regexp_split_to_array(
               (regexp_split_to_array(
                split_part(
                  regexp_replace(                                                -- 4. Praefixe
                    regexp_replace(                                              -- 3. Kopfblock
                      regexp_replace(                                            -- 2. Eingang-Absatz
                        replace(coalesce(l.roh, ''), E'\r', ''),                 -- 1.
                        E'^\\s*Eingang [^\\n]*(\\n[^\\n]*\\S[^\\n]*)*\\n\\s*\\n', ''),
                      E'^\\s*((Von|An|Cc|Betreff|Gesendet|Eingang|Datum):[^\\n]*\\n)+', ''),
                    E'^\\s*(Wortlaut|Inhalt|Text laut Screenshot[^:\\n]*):\\s*', ''),
                  '-----Ursprüngliche Nachricht', 1),
                E'\\n[^\\n]{0,3}Am [^\\n]{0,200}schrieb'))[1],
               E'\\n[^\\n]{0,3}On [^\\n]{0,200}wrote'))[1],
              E'\\n\\s*_{10,}'))[1],
             E'\\nVon: '))[1],
            E'\\n\\s*>'))[1],
           E'\\n-- ?\\n'))[1],
          E'\\n\\s*\\([^()]*\\)\\s*$', ''),
        E'\\s+', ' ', 'g')) AS text_rein
      FROM letzte l
  )
  SELECT s.antwort_am, s.deal_id, s.deal_titel, s.pipeline_name, s.art, s.lost_reason,
         CASE WHEN length(s.text_rein) > 400 THEN left(s.text_rein, 399) || '…' ELSE s.text_rein END AS aussage
    FROM s
   ORDER BY s.antwort_am DESC, s.deal_id
   LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$function$;

REVOKE ALL ON FUNCTION public.get_letzte_absagen(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_letzte_absagen(integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
