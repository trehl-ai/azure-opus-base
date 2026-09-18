-- 17.09.2026: Zwei Fehler in meinen eigenen Funktionen, von Claude Code an
-- Armins echtem Event gefunden — bevor die erste Fit-&-Aktiv-Buchung eintraf.
--
-- ⚠ FEHLER 1: cal_schule_aus_responses nahm LIMIT 1 OHNE ORDER BY.
-- Armins Event hat DREI Pflichtfelder: "Schule/Unternehmen", "Ihre Schule",
-- "Ort". Zwei davon matchen auf 'schule' — welcher gewinnt, war unbestimmt.
-- Eine Abfrage ohne ORDER BY darf jede Zeile liefern; heute diese, morgen
-- jene.
-- BEHOBEN: Der spezifischere Treffer gewinnt. "Ihre Schule" vor
-- "Schule/Unternehmen", und bei Gleichstand der laengere Wert — ein
-- ausgefuelltes Feld schlaegt ein leeres.
-- ⚠ BEIDE WERTE LANDEN JETZT IN DEN METADATEN. Wenn die Felder
-- auseinandergehen, ist das sichtbar, statt dass eines still verschwindet.
--
-- ⚠ FEHLER 2, der schwerere: cal_ist_werteraum_event kannte nur die zwei
-- WerteRaum-Events und den Titel "werteraum". Armins Event 6945548 heisst
-- "15 Minuten Erstgespräch Fit und Aktiv".
-- JEDE Fit-&-Aktiv-Buchung waere als kein_werteraum_event durchgefallen:
-- Kontakt angelegt, Aktivitaet OHNE Deal, Formularfelder ungenutzt, keine
-- Stufe "Terminiert". Die Buchung waere im CRM gewesen und trotzdem
-- unsichtbar.
-- BEHOBEN: Event 6945548 und der Titel "fit und aktiv" kommen dazu.
-- ⚠ DIE FUNKTION HEISST WEITER cal_ist_werteraum_event, obwohl sie jetzt
-- mehr abdeckt. Umbenennen hiesse alle Aufrufer anfassen; der Kommentar
-- traegt die Wahrheit. Wer eine dritte Kampagne anlegt, ergaenzt HIER.
--
-- ⚠ FIT & AKTIV SCHULEN LIEGT IN DERSELBEN PIPELINE wie WerteRaum
-- (61b1b7e2), deshalb ist die Stufe "Terminiert" dort richtig. Die
-- Stiftungen liegen in 341c067d — kaeme je eine Buchung ueber ein
-- Stiftungs-Event, muesste die Pipeline mitentschieden werden. Heute gibt es
-- kein solches Event.

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
  ),
  schulfelder AS (
    SELECT label, wert,
           -- Der spezifischere Treffer gewinnt, dann der laengere Wert.
           -- Ohne diese Ordnung war das Ergebnis bei zwei Schulfeldern
           -- unbestimmt — Armins Event hat genau das.
           CASE WHEN label ~ 'ihre schule' THEN 1
                WHEN label ~ '^schule$'    THEN 2
                ELSE 3 END AS rang
    FROM felder
    WHERE label ~ '(schule|einrichtung|institution|unternehmen)' AND wert <> ''
  )
  SELECT jsonb_build_object(
    'schule', (SELECT wert FROM schulfelder ORDER BY rang, length(wert) DESC, label LIMIT 1),
    'ort',    (SELECT wert FROM felder
               WHERE label ~ '(ort|stadt|city|plz)' AND wert <> ''
                 AND label !~ '(schule|einrichtung|unternehmen)'
               ORDER BY label LIMIT 1),
    -- Alle Schulfelder, damit ein Auseinandergehen sichtbar bleibt.
    'schulfelder_alle', (SELECT jsonb_object_agg(label, wert) FROM schulfelder)
  );
$function$;

COMMENT ON FUNCTION public.cal_schule_aus_responses(jsonb) IS
  'Liest Schule und Ort aus den cal.com-Buchungsfragen (payload.responses). Sucht im LABEL, nicht im technischen Feldnamen. ⚠ Seit 17.09.2026 DETERMINISTISCH: Armins Event hat zwei Felder, die auf "schule" matchen ("Schule/Unternehmen" und "Ihre Schule") — vorher entschied der Zufall. Jetzt gewinnt der spezifischere, dann der laengere Wert. Alle Schulfelder stehen unter schulfelder_alle, damit ein Auseinandergehen sichtbar bleibt.';

CREATE OR REPLACE FUNCTION public.cal_ist_werteraum_event(p_event_id text, p_title text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- ⚠ TROTZ DES NAMENS deckt diese Funktion ALLE Kampagnen ab, fuer die wir
  -- Deals in der Schulpipeline fuehren:
  --   5975343, 6023888  WerteRaum (Thomas Timmer)
  --   6945548           Fit & Aktiv Schulen (Armin Schuster)
  -- Bis zum 17.09. fehlte Armins Event. Jede Fit-&-Aktiv-Buchung waere als
  -- kein_werteraum_event durchgefallen: Kontakt ja, Deal nein — im CRM
  -- vorhanden und trotzdem unsichtbar.
  -- Eine Event-ID ist ein stabiler Schluessel, ein Titel ist es nicht. Der
  -- Titel-Fallback faengt nur, was die Liste verpasst.
  -- NEUE EVENTS GEHOEREN HIER HINEIN.
  SELECT coalesce(p_event_id,'') IN ('5975343','6023888','6945548')
      OR coalesce(p_title,'') ILIKE '%werteraum%'
      OR coalesce(p_title,'') ILIKE '%fit und aktiv%'
      OR coalesce(p_title,'') ILIKE '%fit & aktiv%';
$function$;