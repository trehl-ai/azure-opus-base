-- 04.09.2026: ablauf_prozent gewichtet je Welle, Nenner nur ERREICHBARE Adressen.
--
-- ZWEI KORREKTUREN AN DER FASSUNG VON HEUTE MITTAG:
--
-- 1. GEWICHTUNG JE WELLE statt binaerem Zaehlen.
--    Die vorige Fassung rechnete "versendete Wellen / geplante Wellen" und gab
--    Bayern 100 Prozent, weil beide Wellen beendet sind. Tatsaechlich hat Welle 2
--    dort nur 43 Prozent der Adressen erreicht: das "2. Mailing" ging an 7
--    Adressen, der Korrekturversand an 32. Beendet ist nicht angekommen.
--    Bundesweit ergab die alte Fassung 50 Prozent — obwohl nicht einmal Welle 1
--    durch ist (60 Prozent erreicht, 766 Adressen offen). Tomis Einwand:
--    "50 Prozent bedeutet, alle haben Welle 1 bekommen. Der Wert muss darunter
--    liegen." Richtig.
--    NEU: ablauf = Mittel der Erreichungsgrade aller geplanten Wellen.
--
-- 2. NENNER SIND NUR ERREICHBARE ADRESSEN.
--    Bisher standen blockierte Adressen (blocked_behoerde, blocked_unklare_adresse,
--    keine Mailadresse) im Nenner. Sie koennen NIE eine Mail bekommen — Bayern
--    haette bei 97 Prozent geendet, bundesweit bei 96. Anforderung Tomi: die
--    Kampagne muss automatisch auf 100 Prozent laufen koennen. Deshalb zaehlt der
--    Nenner nur, was ueberhaupt erreichbar ist.
--    nicht_erreichbar bleibt als EIGENE Spalte sichtbar — die Zahl verschwindet
--    nicht, sie steht nur nicht mehr im Fortschritt.
--
-- WELLENZAHL: aus campaign_mailings mit zaehlt_als_welle, Status versendet oder
-- freigegeben. Entwuerfe zaehlen nicht — ein Vorhaben ist kein Plan.
-- Welle n gilt fuer eine Adresse als erreicht, wenn sie mindestens n Kontakte hat
-- oder abgeschlossen ist (gewonnen/verloren brauchen keine weitere Mail).
--
-- Gemessen vor dieser Aenderung: Bayern 62 Prozent, Bundesweit 31 Prozent.

DROP FUNCTION IF EXISTS public.get_campaign_overview();

CREATE OR REPLACE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(
   campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe_text text, themen text, ziel_2026 text, ziel_2027 text, buchungslink text,
   zielgruppe bigint, erreichbar bigint, angeschrieben bigint, abgeschlossen bigint,
   ausstehend bigint, nicht_erreichbar bigint,
   wellen_geplant bigint, ablauf_prozent integer,
   antworten bigint, klicks bigint, bounces bigint,
   auftraege bigint, auftraege_wert numeric, letzte_mail date,
   mailings_gesamt bigint, mailings_ohne_freigabe bigint, mailings_versendet bigint
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH deal_basis AS (
    SELECT k.id AS campaign_id, k.sortierung, d.id AS deal_id,
           COALESCE(lower(btrim(c.email)), 'kein-mail:' || d.id::text) AS schluessel,
           c.email, c.outreach_status, ps.name AS stage,
           d.status AS deal_status, d.value_amount,
           (SELECT count(*) FROM deal_activities x
              WHERE x.deal_id = d.id AND x.activity_type = 'email' AND x.deleted_at IS NULL) AS mails
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
  wellen AS (
    SELECT m.campaign_id, count(*) AS anzahl
    FROM campaign_mailings m
    WHERE m.zaehlt_als_welle AND m.status IN ('versendet','freigegeben')
    GROUP BY m.campaign_id
  ),
  -- Erreichungsgrad je Welle, ueber alle geplanten Wellen gemittelt.
  -- Welle n erreicht = mindestens n Kontakte ODER abgeschlossen.
  ablauf AS (
    SELECT a.campaign_id,
           round(avg(
             100.0 * (SELECT count(*) FROM adressen x
                        WHERE x.campaign_id = a.campaign_id AND x.erreichbar
                          AND (x.abgeschlossen
                               OR GREATEST(x.mails, CASE WHEN x.hat_brief THEN 1 ELSE 0 END) >= s.welle))
             / NULLIF((SELECT count(*) FROM adressen y
                         WHERE y.campaign_id = a.campaign_id AND y.erreichbar), 0)
           ))::integer AS prozent
    FROM (SELECT DISTINCT campaign_id FROM adressen) a
    JOIN wellen w ON w.campaign_id = a.campaign_id
    CROSS JOIN LATERAL generate_series(1, w.anzahl::int) AS s(welle)
    GROUP BY a.campaign_id
  ),
  gewinn AS (
    SELECT DISTINCT ON (a.schluessel) a.schluessel, a.campaign_id, a.wert
    FROM adressen a WHERE a.gewonnen ORDER BY a.schluessel, a.sortierung
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
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email_reply'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'link_click'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'bounce'),
    (SELECT count(*) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT COALESCE(sum(g.wert),0) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT max(a.created_at)::date FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email'),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.status = 'entwurf'),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.status = 'versendet')
  FROM campaigns k
  LEFT JOIN pipelines p ON p.id = k.pipeline_id
  WHERE k.aktiv
  ORDER BY k.sortierung;
$function$;

COMMENT ON FUNCTION public.get_campaign_overview() IS
  'Kacheldaten je Kampagne. ablauf_prozent = Mittel der Erreichungsgrade aller geplanten Wellen, Nenner nur ERREICHBARE Adressen — blockierte koennen nie eine Mail bekommen und wuerden 100 Prozent unerreichbar machen. Welle n gilt als erreicht bei mindestens n Kontakten oder Abschluss. Wellenzahl aus campaign_mailings mit zaehlt_als_welle, Status versendet oder freigegeben; Entwuerfe zaehlen nicht. Adressebene ueber lower(btrim(email)).';