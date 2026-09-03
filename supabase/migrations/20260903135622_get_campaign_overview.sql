-- 03.09.2026: Kachelzahlen je Kampagne fuer die Kampagnenuebersicht.
-- Anforderung Tomi: auf der ersten Kachel sofort sehen, wie viele angeschrieben
-- sind, wie viele ausstehen, und wie viele Auftraege daraus entstanden sind.
--
-- GRUNDBEGRIFFE, weil sie leicht falsch gelesen werden:
--   zielgruppe      = alle Deals, auf die die Kampagnenregel passt
--                     (pipeline_id + segmente + bundesland_modus/bundeslaender)
--   angeschrieben   = Deals mit mindestens einer 'email'-Aktivitaet DIESER Kampagne
--   ausstehend      = zielgruppe minus angeschrieben.
--                     ⚠ Das heisst "hat von DIESER Kampagne noch keine Mail",
--                     NICHT "ist noch nie angeschrieben worden". Zwei Kampagnen
--                     koennen denselben Verteiler tragen — WerteRaum 3.0 und
--                     VR Fit & Aktiv Schulen tun das absichtlich, im Abstand
--                     von zwei Monaten. Dort zeigen beide dieselbe Zahl, bis
--                     die erste gelaufen ist.
--   auftraege       = gewonnene Deals, LAST TOUCH: die Kampagne, deren Mail
--                     zuletzt VOR won_at ging, bekommt den Auftrag. Bei zwei
--                     Monaten Abstand die plausiblere Zuschreibung als First Touch.
--                     Gewonnene Deals ohne jede Kampagnenmail zaehlen nirgends.
--
-- HINWEIS ZU auftraege_wert: Bei WerteRaum sitzen die Erloese beim FOERDERER,
-- nicht bei der Schule. 20 gewonnene Schulwochen tragen value_amount 0, weil sie
-- vom Foerderer bezahlt werden. Die Zahl der Auftraege ist deshalb aussagekraeftiger
-- als ihr Wert.

CREATE OR REPLACE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(
   campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe bigint, angeschrieben bigint, ausstehend bigint,
   nicht_erreichbar bigint, antworten bigint, klicks bigint, bounces bigint,
   auftraege bigint, auftraege_wert numeric, letzte_mail date
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ziel AS (
    SELECT k.id AS campaign_id, d.id AS deal_id, c.id AS contact_id,
           c.email, c.outreach_status, c.bounce_at
    FROM campaigns k
    JOIN deals d
      ON d.deleted_at IS NULL
     AND k.pipeline_id IS NOT NULL
     AND d.pipeline_id = k.pipeline_id
     AND (k.segmente IS NULL OR d.segment = ANY (k.segmente))
    LEFT JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    WHERE k.aktiv
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
  -- Last Touch: je gewonnenem Deal die Kampagne der letzten Mail vor won_at
  gewinn AS (
    SELECT DISTINCT ON (d.id)
           d.id AS deal_id, d.value_amount, a.campaign_id
    FROM deals d
    JOIN akt a ON a.deal_id = d.id AND a.activity_type = 'email'
    WHERE d.deleted_at IS NULL AND d.status = 'won' AND d.won_at IS NOT NULL
      AND a.created_at <= d.won_at
    ORDER BY d.id, a.created_at DESC
  )
  SELECT
    k.id, k.name, k.phase, k.sortierung,
    k.verantwortlich, k.konzept_slug, p.name, k.notiz,
    (SELECT count(*) FROM ziel z WHERE z.campaign_id = k.id),
    (SELECT count(DISTINCT z.deal_id) FROM ziel z
      WHERE z.campaign_id = k.id
        AND EXISTS (SELECT 1 FROM akt a WHERE a.campaign_id = k.id AND a.deal_id = z.deal_id AND a.activity_type = 'email')),
    (SELECT count(DISTINCT z.deal_id) FROM ziel z
      WHERE z.campaign_id = k.id
        AND z.email IS NOT NULL
        AND COALESCE(z.outreach_status,'') NOT IN ('blocked_unklare_adresse','blocked_behoerde')
        AND NOT EXISTS (SELECT 1 FROM akt a WHERE a.campaign_id = k.id AND a.deal_id = z.deal_id AND a.activity_type = 'email')),
    (SELECT count(DISTINCT z.deal_id) FROM ziel z
      WHERE z.campaign_id = k.id
        AND (z.email IS NULL OR COALESCE(z.outreach_status,'') IN ('blocked_unklare_adresse','blocked_behoerde'))),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email_reply'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'link_click'),
    (SELECT count(*) FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'bounce'),
    (SELECT count(*) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT COALESCE(sum(g.value_amount),0) FROM gewinn g WHERE g.campaign_id = k.id),
    (SELECT max(a.created_at)::date FROM akt a WHERE a.campaign_id = k.id AND a.activity_type = 'email')
  FROM campaigns k
  LEFT JOIN pipelines p ON p.id = k.pipeline_id
  WHERE k.aktiv
  ORDER BY k.sortierung;
$function$;

COMMENT ON FUNCTION public.get_campaign_overview() IS
  'Kachelzahlen je Kampagne. ausstehend = hat von DIESER Kampagne noch keine Mail, nicht "noch nie angeschrieben" — zwei Kampagnen koennen denselben Verteiler tragen. auftraege per Last Touch. Bei WerteRaum sitzen die Erloese beim Foerderer, nicht bei der Schule: die Zahl der Auftraege ist aussagekraeftiger als auftraege_wert.';