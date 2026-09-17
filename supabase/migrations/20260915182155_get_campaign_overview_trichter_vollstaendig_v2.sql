-- 15.09.2026: Der Trichter wird in der Kachel vollstaendig.
--
-- ANLASS: Die Kachel zeigte Mails, Klicks, Antworten und Auftraege — aber
-- nicht die zwei Stufen dazwischen. Erst zusammen erzaehlen sie etwas.
-- WerteRaum gesamt, gemessen am 15.09.:
--   2.052 Mails -> 132 Infoklicks (6,4 %) -> 28 Antworten (1,4 %)
--   -> 3 Buchungen (0,15 %) -> 31 gewonnene Deals
-- ⚠ 31 GEWONNENE DEALS BEI 3 BUCHUNGEN. Der Abschluss laeuft NICHT ueber den
-- Buchungslink, sondern ueber die Antwort: jemand schreibt zurueck, dann wird
-- telefoniert. Cal.com ist ein Nebenweg.
-- ⚠ UND KEINE DER DREI BUCHUNGEN HATTE VORHER EINEN KLICK.
--
-- DREI NEUE FELDER, ans ENDE gehaengt:
--   termin_klicks  Klicks auf den Buchungslink, seit 15.09. zaehlbar
--   buchungen      Terminbuchungen ueber cal.com
--   erste_antwort  wann die erste Antwort kam
-- ⚠ erste_antwort ordnet eine Quote von 0 Prozent ein: eine Kampagne, die
-- gestern anlief, hat zu Recht keine Antwort. Ohne das Datum sieht
-- "0 Antworten" bei Fit & Aktiv Schulen (60 Mails, seit 8 Tagen) genauso aus
-- wie bei den Stiftungen (242 Mails, seit Juni).
--
-- ⚠ BUCHUNGEN UEBER DEN KONTAKT, nicht ueber campaign_id: cal_booking_intake
-- setzt keine Kampagne, alle drei Buchungen im Bestand tragen NULL. Ueber den
-- Kontakt ist die Zuordnung belegt — wer gebucht hat, steht im Verteiler.
--
-- DROP noetig, weil sich der Rueckgabetyp aendert. ACL danach wieder wie
-- vorher: anon, authenticated, service_role.

DROP FUNCTION IF EXISTS public.get_campaign_overview();

CREATE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe_text text, themen text, ziel_2026 text, ziel_2027 text, buchungslink text,
   zielgruppe bigint, erreichbar bigint, angeschrieben bigint, abgeschlossen bigint,
   ausstehend bigint, nicht_erreichbar bigint,
   wellen_geplant bigint, ablauf_prozent integer, wellen_detail jsonb,
   antworten bigint, klicks bigint, bounces bigint,
   auftraege bigint, auftraege_wert numeric, letzte_mail date,
   mailings_gesamt bigint, mailings_ohne_freigabe bigint, mailings_versendet bigint,
   termin_klicks bigint, buchungen bigint, erste_antwort date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH deal_basis AS (
    SELECT k.id AS campaign_id, k.sortierung, d.id AS deal_id,
           d.primary_contact_id,
           COALESCE(lower(btrim(c.email)), 'kein-mail:' || d.id::text) AS schluessel,
           c.email, c.outreach_status, ps.name AS stage,
           d.status AS deal_status, d.value_amount,
           (SELECT count(*) FROM deal_activities x
              WHERE x.deal_id = d.id AND x.activity_type = 'email'
                AND x.deleted_at IS NULL
                AND x.campaign_id = k.id) AS mails
    FROM campaigns k
    JOIN deals d
      ON d.deleted_at IS NULL
     AND k.pipeline_id IS NOT NULL
     AND d.pipeline_id = k.pipeline_id
     AND (k.segmente IS NULL OR d.segment = ANY (k.segmente))
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    LEFT JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE k.aktiv
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND (
        k.bundesland_modus = 'alle'
        OR (k.bundesland_modus = 'nur'    AND c.bundesland = ANY (k.bundeslaender))
        OR (k.bundesland_modus = 'ausser' AND (c.bundesland IS NULL OR NOT (c.bundesland = ANY (k.bundeslaender))))
      )
  ),
  akt AS (
    SELECT da.campaign_id, da.deal_id, da.activity_type, da.created_at
    FROM deal_activities da
    WHERE da.campaign_id IS NOT NULL AND da.deleted_at IS NULL
  ),
  adressen AS (
    SELECT b.campaign_id, b.schluessel,
           max(b.mails)                                           AS mails,
           bool_or(b.stage = 'Briefversand')                      AS hat_brief,
           bool_or(b.deal_status IN ('won','lost'))               AS abgeschlossen,
           bool_or(b.deal_status = 'won')                         AS gewonnen,
           max(b.value_amount) FILTER (WHERE b.deal_status='won') AS wert,
           bool_or(b.email IS NOT NULL AND btrim(b.email) <> ''
                   AND COALESCE(b.outreach_status,'') NOT IN
                       ('blocked_unklare_adresse','blocked_behoerde')) AS erreichbar,
           min(b.sortierung)                                      AS sortierung
    FROM deal_basis b
    GROUP BY b.campaign_id, b.schluessel
  ),
  wellen_liste AS (
    SELECT m.campaign_id, m.name AS mailing_name,
           row_number() OVER (PARTITION BY m.campaign_id ORDER BY m.nummer) AS welle
    FROM campaign_mailings m
    WHERE m.zaehlt_als_welle AND m.status IN ('versendet','freigegeben')
  ),
  wellen AS (
    SELECT campaign_id, count(*) AS anzahl FROM wellen_liste GROUP BY campaign_id
  ),
  welle_stand AS (
    SELECT w.campaign_id, w.welle, w.mailing_name,
           (SELECT count(*) FROM adressen x
              WHERE x.campaign_id = w.campaign_id AND x.erreichbar
                AND (x.abgeschlossen
                     OR GREATEST(x.mails, CASE WHEN x.hat_brief THEN 1 ELSE 0 END) >= w.welle)
           ) AS erreicht,
           (SELECT count(*) FROM adressen y
              WHERE y.campaign_id = w.campaign_id AND y.erreichbar) AS erreichbar
    FROM wellen_liste w
  ),
  ablauf AS (
    SELECT campaign_id,
           round(avg(100.0 * erreicht / NULLIF(erreichbar,0)))::integer AS prozent,
           jsonb_agg(jsonb_build_object(
             'welle',      welle,
             'name',       mailing_name,
             'erreicht',   erreicht,
             'erreichbar', erreichbar,
             'prozent',    round(100.0 * erreicht / NULLIF(erreichbar,0))::integer
           ) ORDER BY welle) AS detail
    FROM welle_stand GROUP BY campaign_id
  ),
  gewinn AS (
    SELECT DISTINCT ON (a.schluessel) a.schluessel, a.campaign_id, a.wert
    FROM adressen a WHERE a.gewonnen ORDER BY a.schluessel, a.sortierung
  ),
  buchung AS (
    SELECT DISTINCT b.campaign_id, m.id AS activity_id
    FROM deal_basis b
    JOIN deal_activities m ON m.contact_id = b.primary_contact_id
    WHERE m.activity_type = 'meeting' AND m.deleted_at IS NULL
      AND m.metadata->>'cal_uid' IS NOT NULL
  )
  SELECT
    k.id, k.name, k.phase, k.sortierung,
    k.verantwortlich, k.konzept_slug, p.name, k.notiz,
    k.zielgruppe_text, k.themen, k.ziel_2026, k.ziel_2027, k.buchungslink,
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND a.erreichbar),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND (a.mails > 0 OR a.hat_brief)),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND a.abgeschlossen),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id
       AND NOT (a.mails > 0 OR a.hat_brief) AND NOT a.abgeschlossen AND a.erreichbar),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND NOT a.erreichbar),
    COALESCE((SELECT w.anzahl FROM wellen w WHERE w.campaign_id = k.id), 0),
    (SELECT ab.prozent FROM ablauf ab WHERE ab.campaign_id = k.id),
    (SELECT ab.detail  FROM ablauf ab WHERE ab.campaign_id = k.id),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email_reply'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'link_click'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'bounce'),
    (SELECT count(*) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT COALESCE(sum(g.wert),0) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT max(a.created_at)::date FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email'),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id),
    (SELECT count(*) FROM campaign_mailings m
       WHERE m.campaign_id = k.id AND m.status = 'entwurf' AND m.geplant_ab IS NOT NULL),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.status = 'versendet'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'termin_click'),
    (SELECT count(*) FROM buchung b WHERE b.campaign_id = k.id),
    (SELECT min(a.created_at)::date FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email_reply')
  FROM campaigns k
  LEFT JOIN pipelines p ON p.id = k.pipeline_id
  WHERE k.aktiv
  ORDER BY k.sortierung;
$function$;

COMMENT ON FUNCTION public.get_campaign_overview() IS
  'Kacheldaten je Kampagne, seit 15.09.2026 mit vollstaendigem Trichter: termin_klicks, buchungen und erste_antwort ergaenzen Mails, Klicks, Antworten und Auftraege. Buchungen werden ueber den KONTAKT gezaehlt, weil cal_booking_intake keine campaign_id setzt. erste_antwort ordnet eine Quote von 0 Prozent ein — sonst sieht eine Kampagne, die seit acht Tagen laeuft, aus wie eine, die seit Juni nichts liefert. Gemessen am 15.09.: WerteRaum kommt auf 2.052 Mails, 132 Klicks, 28 Antworten, 3 Buchungen und 31 gewonnene Deals — der Abschluss laeuft ueber die Antwort, nicht ueber den Buchungslink.';

GRANT EXECUTE ON FUNCTION public.get_campaign_overview() TO anon;
GRANT EXECUTE ON FUNCTION public.get_campaign_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_campaign_overview() TO service_role;