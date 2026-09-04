-- 04.09.2026: get_campaign_overview liefert den ABLAUFfortschritt.
--
-- ENTSCHEIDUNG TOMI: Der Ring auf der Kachel zeigt den ABLAUF, nicht die
-- Reichweite. Eine Kampagne aus zwei Mailings ist zu 100 Prozent durch, wenn
-- beide Wellen gelaufen sind. Die Reichweiten- und Erfolgsauswertung
-- (Antwortquote, Stufen-Conversion) folgt getrennt und wird moeglicherweise
-- gar nicht auf der Kachel gezeigt.
--
--   ablauf_prozent = versendete Wellen / (versendete + freigegebene Wellen)
--
-- Nur Mailings mit zaehlt_als_welle. Entwuerfe zaehlen NICHT in den Nenner —
-- ein Mailing im Entwurf ist ein Vorhaben, kein Plan. Sonst faellt Bayern von
-- 100 auf 67 Prozent, nur weil das November-Mailing eingetragen ist.
--
-- Gemessen: Bayern 100 %, Bundesweit 50 %, Stiftungen 100 %,
-- die uebrigen sechs NULL (kein Mailing angelegt).
--
-- fortschritt_prozent (Reichweite auf Adressebene) BLEIBT erhalten — es
-- beantwortet die andere Frage und wird fuer die spaetere Auswertung gebraucht.
-- Zwei Kennzahlen, zwei Namen, keine ueberladene Spalte.

DROP FUNCTION IF EXISTS public.get_campaign_overview();

CREATE OR REPLACE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(
   campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe_text text, themen text, ziel_2026 text, ziel_2027 text, buchungslink text,
   zielgruppe bigint, angeschrieben bigint, abgeschlossen bigint, ausstehend bigint,
   nicht_erreichbar bigint, fortschritt_prozent integer,
   wellen_versendet bigint, wellen_geplant bigint, ablauf_prozent integer,
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
           d.status AS deal_status, d.value_amount
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
           bool_or(EXISTS (SELECT 1 FROM akt a
                     WHERE a.campaign_id = b.campaign_id AND a.deal_id = b.deal_id
                       AND a.activity_type = 'email'))            AS hat_mail,
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
  gewinn AS (
    SELECT DISTINCT ON (a.schluessel)
           a.schluessel, a.campaign_id, a.wert
    FROM adressen a WHERE a.gewonnen
    ORDER BY a.schluessel, a.sortierung
  )
  SELECT
    k.id, k.name, k.phase, k.sortierung,
    k.verantwortlich, k.konzept_slug, p.name, k.notiz,
    k.zielgruppe_text, k.themen, k.ziel_2026, k.ziel_2027, k.buchungslink,
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND (a.hat_mail OR a.hat_brief)),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND a.abgeschlossen),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id
       AND NOT (a.hat_mail OR a.hat_brief) AND NOT a.abgeschlossen AND a.erreichbar),
    (SELECT count(*) FROM adressen a WHERE a.campaign_id = k.id AND NOT a.erreichbar),
    (SELECT CASE WHEN count(*) = 0 THEN NULL
                 ELSE round(100.0 * count(*) FILTER (WHERE a.hat_mail OR a.hat_brief OR a.abgeschlossen)
                            / count(*))::integer END
       FROM adressen a WHERE a.campaign_id = k.id),
    -- Ablauf: nur echte Wellen, Entwuerfe nicht im Nenner
    (SELECT count(*) FROM campaign_mailings m
       WHERE m.campaign_id = k.id AND m.zaehlt_als_welle AND m.status = 'versendet'),
    (SELECT count(*) FROM campaign_mailings m
       WHERE m.campaign_id = k.id AND m.zaehlt_als_welle AND m.status IN ('versendet','freigegeben')),
    (SELECT CASE WHEN count(*) FILTER (WHERE m.status IN ('versendet','freigegeben')) = 0 THEN NULL
                 ELSE round(100.0 * count(*) FILTER (WHERE m.status = 'versendet')
                            / count(*) FILTER (WHERE m.status IN ('versendet','freigegeben')))::integer END
       FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.zaehlt_als_welle),
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
  'Kacheldaten je Kampagne. ZWEI Fortschrittsmasse, bewusst getrennt: ablauf_prozent = versendete Wellen / (versendete + freigegebene Wellen), nur Mailings mit zaehlt_als_welle, Entwuerfe nicht im Nenner — das ist die Zahl fuer den Ring. fortschritt_prozent = Reichweite auf Adressebene, fuer die spaetere Auswertung. Adressebene ueber lower(btrim(email)), angeschrieben = Mail ODER Briefversand, abgeschlossen = gewonnen oder verloren.';