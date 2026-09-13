-- 12.09.2026: Wellen einzeln ausweisen, und Ideen nicht als Freigabe-Rueckstand zaehlen.
--
-- ZWEI BEFUNDE VON TOMI, beide am Dashboard sichtbar:
--
-- 1. "1 Mailing ohne Freigabe" bei Bayern bezog sich auf Mailing 4, das am
--    12.09. zu "IDEE: 3. Kontakt November (nicht beschlossen)" umbenannt wurde.
--    Es ist KEIN Rueckstand: die Entscheidung vom 02.09. lautet "ZWEI Kontakte,
--    kein drittes Mailing". Die Zeile haelt nur eine Ueberlegung fest.
--    NEUE REGEL: mailings_ohne_freigabe zaehlt nur Entwuerfe MIT geplant_ab.
--    Ein Entwurf ohne Datum ist eine Idee, keine ausstehende Freigabe.
--
-- 2. Der Ring zeigt den Mittelwert ueber alle Wellen — man sieht nicht, welche
--    Welle wo steht. Bei Bayern sind 79 Prozent das Mittel aus Welle 1 (83 %)
--    und Welle 2 (75 %); beide Zahlen sind interessanter als ihr Mittel.
--    NEU: wellen_detail jsonb mit einer Zeile je Welle —
--      welle, name, erreicht, erreichbar, prozent
--    Der Ring bleibt unveraendert, damit die Kachel nicht springt.

DROP FUNCTION IF EXISTS public.get_campaign_overview();

CREATE OR REPLACE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(
   campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe_text text, themen text, ziel_2026 text, ziel_2027 text, buchungslink text,
   zielgruppe bigint, erreichbar bigint, angeschrieben bigint, abgeschlossen bigint,
   ausstehend bigint, nicht_erreichbar bigint,
   wellen_geplant bigint, ablauf_prozent integer, wellen_detail jsonb,
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
  -- Die Wellen in ihrer Reihenfolge, mit Namen fuer die Anzeige.
  wellen_liste AS (
    SELECT m.campaign_id, m.name AS mailing_name,
           row_number() OVER (PARTITION BY m.campaign_id ORDER BY m.nummer) AS welle
    FROM campaign_mailings m
    WHERE m.zaehlt_als_welle AND m.status IN ('versendet','freigegeben')
  ),
  wellen AS (
    SELECT campaign_id, count(*) AS anzahl FROM wellen_liste GROUP BY campaign_id
  ),
  -- Erreichungsgrad JE WELLE, nicht nur gemittelt.
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
    -- NEU: nur Entwuerfe MIT geplant_ab. Ein Entwurf ohne Datum ist eine Idee.
    (SELECT count(*) FROM campaign_mailings m
       WHERE m.campaign_id = k.id AND m.status = 'entwurf' AND m.geplant_ab IS NOT NULL),
    (SELECT count(*) FROM campaign_mailings m WHERE m.campaign_id = k.id AND m.status = 'versendet')
  FROM campaigns k
  LEFT JOIN pipelines p ON p.id = k.pipeline_id
  WHERE k.aktiv
  ORDER BY k.sortierung;
$function$;

COMMENT ON FUNCTION public.get_campaign_overview() IS
  'Kacheldaten je Kampagne. NEU 12.09.2026: wellen_detail jsonb weist jede Welle einzeln aus (welle, name, erreicht, erreichbar, prozent) — der Ring zeigt weiterhin das Mittel. mailings_ohne_freigabe zaehlt nur noch Entwuerfe MIT geplant_ab: ein Entwurf ohne Datum ist eine Idee, kein Freigabe-Rueckstand. angeschrieben, ausstehend und ablauf_prozent zaehlen kampagnenspezifisch ueber deal_activities.campaign_id.';
