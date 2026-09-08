-- 08.09.2026: angeschrieben und ablauf_prozent zaehlen wieder KAMPAGNENSPEZIFISCH.
--
-- DER FEHLER, eingebaut am 04.09. beim Umbau auf den Ablauffortschritt:
-- deal_basis berechnete
--   (SELECT count(*) FROM deal_activities x
--      WHERE x.deal_id = d.id AND x.activity_type = 'email') AS mails
-- also ALLE Mails an einem Deal, ohne Kampagnenfilter. Die frueher vorhandene
-- Spalte hat_mail (mit a.campaign_id = b.campaign_id) wurde dabei ersetzt.
--
-- BEMERKT AM 08.09.: WerteRaum 3.0 zeigte 10 Angeschriebene, obwohl die
-- Kampagne kein Mailing hat und nie gesendet wurde. Die 10 stammten von
-- VR Fit & Aktiv — Schulen, die am selben Morgen ihre ersten Mails schickte.
-- Beide Kampagnen teilen sich denselben Verteiler (1.004 Adressen), zwei
-- Monate versetzt — Entscheidung Tomi vom 03.09.
--
-- GENAU DAFUER sitzt der Kampagnenstempel an deal_activities.campaign_id und
-- nicht am Deal. Die Trennung war gebaut und im selben System wieder
-- aufgehoben.
--
-- NEU: mails_kampagne zaehlt nur Aktivitaeten MIT der campaign_id dieser
-- Kampagne. Verwendet in angeschrieben, ausstehend und im Erreichungsgrad je
-- Welle.
--
-- ⚠ VORAUSSETZUNG, die seit dem 07.09. erfuellt ist: der Stempel muss
-- vollstaendig sein. Bis zum 03.09. durch den Backfill, vom 04. bis 07.09.
-- durch die 149 nachgetragenen, seither durch die drei gepatchten Workflows
-- plus den Trigger trg_campaign_id_werteraum_grundschule. Waere er
-- lueckenhaft, zaehlte diese Fassung zu WENIG statt zu viel — der umgekehrte
-- Fehler, aber ebenso falsch.
--
-- Briefversand bleibt kampagnenUNspezifisch: ein Brief traegt keinen Stempel,
-- und die Briefaktion lief nur fuer WerteRaum-Grundschulen. Bei den geteilten
-- Verteilern gibt es null Briefversand-Deals, gemessen — dort kann er also
-- nichts vermischen.

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
           -- NUR Mails DIESER Kampagne. Das ist die Korrektur.
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
  wellen AS (
    SELECT m.campaign_id, count(*) AS anzahl
    FROM campaign_mailings m
    WHERE m.zaehlt_als_welle AND m.status IN ('versendet','freigegeben')
    GROUP BY m.campaign_id
  ),
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
  'Kacheldaten je Kampagne. angeschrieben, ausstehend und ablauf_prozent zaehlen KAMPAGNENSPEZIFISCH ueber deal_activities.campaign_id — bis zum 08.09.2026 zaehlten sie alle Mails am Deal, wodurch WerteRaum 3.0 die Mails von VR Fit & Aktiv als eigene auswies. Beide teilen sich denselben Verteiler, zwei Monate versetzt. Setzt einen vollstaendigen Kampagnenstempel voraus (Backfill bis 03.09., 149 nachgetragen am 07.09., seither Workflows plus Trigger). Briefversand bleibt ungestempelt und damit kampagnenunspezifisch — bei den geteilten Verteilern gibt es null Briefversand-Deals.';