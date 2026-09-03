-- 03.09.2026: get_campaign_overview liefert die Kacheldaten vollstaendig.
-- Neu: zielgruppe_text, themen, ziel_2026, ziel_2027, buchungslink, und drei
-- Zaehler ueber campaign_mailings.
--
-- ZWECK: Die Kachel soll aus EINEM Aufruf gefuellt werden. Ohne diese Felder
-- muesste das Frontend zusaetzlich campaigns und campaign_mailings selbst
-- abfragen und zusammenfuehren — drei Datenwege fuer eine Kachel.
--
-- mailings_ohne_freigabe ist der wichtigste neue Zaehler: er zeigt auf der
-- Kachel, wo etwas haengt, ohne dass jemand hineinklicken muss. Gezaehlt wird
-- status='entwurf', also ein geplantes Mailing ohne freigegebenen Text.
--
-- Alles Uebrige unveraendert (siehe 20260903140043):
--   ausstehend = hat von DIESER Kampagne noch keine Mail
--   auftraege  = ueber Zielgruppe, bei geteiltem Verteiler die niedrigere sortierung

DROP FUNCTION IF EXISTS public.get_campaign_overview();

CREATE OR REPLACE FUNCTION public.get_campaign_overview()
 RETURNS TABLE(
   campaign_id uuid, name text, phase text, sortierung integer,
   verantwortlich text, konzept_slug text, pipeline_name text, notiz text,
   zielgruppe_text text, themen text, ziel_2026 text, ziel_2027 text, buchungslink text,
   zielgruppe bigint, angeschrieben bigint, ausstehend bigint,
   nicht_erreichbar bigint, antworten bigint, klicks bigint, bounces bigint,
   auftraege bigint, auftraege_wert numeric, letzte_mail date,
   mailings_gesamt bigint, mailings_ohne_freigabe bigint, mailings_versendet bigint
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
    k.zielgruppe_text, k.themen, k.ziel_2026, k.ziel_2027, k.buchungslink,
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
  'Vollstaendige Kacheldaten je Kampagne aus EINEM Aufruf: Stammdaten, Zielgruppenzahlen, Reaktionen, Auftraege und Mailingstatus. ausstehend = hat von DIESER Kampagne noch keine Mail. auftraege ueber Zielgruppe, bei geteiltem Verteiler die niedrigere sortierung. mailings_ohne_freigabe zeigt auf der Kachel, wo etwas haengt.';