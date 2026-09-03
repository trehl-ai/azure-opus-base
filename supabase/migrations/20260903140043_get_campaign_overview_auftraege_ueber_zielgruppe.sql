-- 03.09.2026: Auftragszuordnung von Last Touch auf Zielgruppe umgestellt.
--
-- WARUM LAST TOUCH VERWORFEN WURDE, gemessen:
-- WerteRaum 1.0 zeigte 2 Auftraege statt 23, die Stiftungslinie 0 statt 1.
-- Von den 23 gewonnenen Schulwochen haben nur zwei ueberhaupt eine Kampagnenmail
-- in der Historie. Die uebrigen kamen ueber Telefon, Empfehlung oder die
-- Foerderer-Schiene. Last Touch war also nicht falsch gerechnet, sondern die
-- falsche Definition fuer dieses Geschaeft: der Auftrag entsteht hier nicht aus
-- der Mail, sondern aus dem Gespraech danach.
--
-- NEUE REGEL (Variante C, Entscheidung Tomi):
-- Ein gewonnener Deal zaehlt zu der Kampagne, in deren ZIELGRUPPE er liegt.
-- Teilen sich mehrere Kampagnen denselben Deal — WerteRaum 3.0 und
-- VR Fit & Aktiv Schulen tun das absichtlich —, zaehlt NUR die Kampagne mit der
-- niedrigeren sortierung. Damit wird kein Auftrag doppelt gezaehlt, und die Regel
-- ist erklaerbar: die frueher gestartete Kampagne behaelt den Auftrag.
--
-- Alles Uebrige unveraendert (siehe 20260903...get_campaign_overview):
--   ausstehend = hat von DIESER Kampagne noch keine Mail, NICHT "noch nie
--                angeschrieben". Bei geteilten Verteilern zeigen beide dieselbe
--                Zahl, bis die erste gelaufen ist.
--   auftraege_wert bleibt nachrangig: bei WerteRaum sitzen die Erloese beim
--                FOERDERER, 20 gewonnene Schulwochen tragen value_amount 0.
--                Die ZAHL der Auftraege ist aussagekraeftiger als ihr Wert.

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
    SELECT k.id AS campaign_id, k.sortierung, d.id AS deal_id,
           c.email, c.outreach_status,
           d.status AS deal_status, d.value_amount
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
  -- Variante C: gewonnener Deal zaehlt zur Kampagne mit der NIEDRIGSTEN
  -- sortierung unter allen, in deren Zielgruppe er liegt. DISTINCT ON haelt
  -- jeden Deal genau einmal.
  gewinn AS (
    SELECT DISTINCT ON (z.deal_id)
           z.deal_id, z.campaign_id, z.value_amount
    FROM ziel z
    WHERE z.deal_status = 'won'
    ORDER BY z.deal_id, z.sortierung
  )
  SELECT
    k.id, k.name, k.phase, k.sortierung,
    k.verantwortlich, k.konzept_slug, p.name, k.notiz,
    (SELECT count(DISTINCT z.deal_id) FROM ziel z WHERE z.campaign_id = k.id),
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
  'Kachelzahlen je Kampagne. ausstehend = hat von DIESER Kampagne noch keine Mail, nicht "noch nie angeschrieben" — zwei Kampagnen koennen denselben Verteiler tragen. auftraege ueber ZIELGRUPPE (Variante C): bei geteiltem Verteiler zaehlt die Kampagne mit der niedrigeren sortierung, kein Auftrag doppelt. Last Touch wurde verworfen, weil nur 2 von 23 gewonnenen Schulwochen ueberhaupt eine Kampagnenmail in der Historie haben. auftraege_wert ist nachrangig: bei WerteRaum sitzen die Erloese beim Foerderer.';