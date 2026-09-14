-- 13.09.2026: log_outreach_activity nimmt eine campaign_id entgegen.
--
-- ANLASS: Alle link_click-Aktivitaeten tragen campaign_id = NULL. Der Trigger
-- trg_campaign_id_werteraum_grundschule fuellt nur activity_type='email'.
--
-- ⚠ WARUM DER TRIGGER HIER NICHT REICHT: Er leitet die Kampagne aus Pipeline
-- und Segment ab. Bei Klicks waere das FALSCH — WerteRaum 3.0 und
-- VR Fit & Aktiv Schulen teilen sich Pipeline UND Segment (weiterfuehrende
-- Schulen, derselbe Verteiler, zwei Monate versetzt). Ein Klick liesse sich
-- daraus nicht zuordnen.
-- DIE KAMPAGNE MUSS AUS DER utm_campaign KOMMEN. Nur der Link weiss, welche
-- Kampagne ihn erzeugt hat.
--
-- NEUER PARAMETER p_campaign_id uuid DEFAULT NULL, ANS ENDE gestellt:
-- alle bestehenden Aufrufer rufen mit sechs Parametern und bleiben unberuehrt.
-- Ist er NULL, verhaelt sich die Funktion exakt wie vorher — dann greift bei
-- E-Mails weiterhin der Trigger.
--
-- ZWEITE AENDERUNG, gleicher Anlass: der CASE fuer outreach_status kennt
-- 'link_click' nicht. Der Tracker setzt link_clicked heute per separatem PATCH
-- auf contacts. Das bleibt so — hier NICHT ergaenzt, weil der Tracker den
-- Status vor dem Aktivitaetseintrag setzt und eine zweite Stelle die
-- Reihenfolge nur verwirren wuerde.
--
-- NAECHSTER SCHRITT, nicht Teil dieser Migration:
--   Plausible /api/v2/query mit dimensions [visit:utm_campaign, visit:utm_content]
--   das Feld durch Forward und Parse reichen
--   im Tracker die utm_campaign ueber campaigns.utm_praefix aufloesen
--     (laengster Praefix gewinnt: werteraum-by-w1 trifft werteraum-by, nicht
--      werteraum)
--   ⚠ Find Deal im Tracker ist fest auf Pipeline 61b1b7e2 verdrahtet. Die
--     Stiftungen liegen in 341c067d — deshalb warten sieben echte
--     Stiftungs-Klicker.

CREATE OR REPLACE FUNCTION public.log_outreach_activity(
  p_deal_id     uuid,
  p_contact_id  uuid,
  p_type        text,
  p_title       text,
  p_description text  DEFAULT ''::text,
  p_metadata    jsonb DEFAULT '{}'::jsonb,
  p_campaign_id uuid  DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO deal_activities (
    deal_id, contact_id, activity_type,
    title, description, metadata, campaign_id,
    auto_generated, status, created_at, updated_at
  ) VALUES (
    p_deal_id, p_contact_id, p_type,
    p_title, p_description, p_metadata, p_campaign_id,
    true, 'completed', now(), now()
  ) RETURNING id INTO v_id;

  UPDATE contacts SET
    outreach_status = CASE
      WHEN p_type = 'email' THEN 'email_sent'
      WHEN p_type = 'call'  THEN 'called'
      WHEN p_type = 'note' AND p_title ILIKE '%Brief%' THEN 'brief_sent'
      WHEN p_type = 'note' AND p_title ILIKE '%Webinar%' THEN 'webinar_invited'
      WHEN p_type = 'note' AND p_title ILIKE '%Camp%'    THEN 'camp_invited'
      WHEN p_type = 'note' AND p_title ILIKE '%Schneeball%' THEN 'schneeball_sent'
      ELSE outreach_status
    END,
    last_contact_at = now(),
    updated_at      = now()
  WHERE id = p_contact_id;

  RETURN v_id;
END;
$function$;

COMMENT ON FUNCTION public.log_outreach_activity(uuid, uuid, text, text, text, jsonb, uuid) IS
  'Schreibt eine Aktivitaet und zieht den Kontaktstatus nach. Seit 13.09.2026 mit optionalem p_campaign_id am ENDE — bestehende Aufrufer mit sechs Parametern bleiben unberuehrt. Bei Klicks MUSS die Kampagne aus der utm_campaign kommen: der Trigger leitet sie aus Pipeline und Segment ab, und WerteRaum 3.0 teilt sich beides mit VR Fit & Aktiv Schulen.';

-- Die Aufloesung utm_campaign -> campaign_id, damit der Workflow nur
-- durchreichen muss. Laengster Praefix gewinnt: werteraum-by-w1 trifft
-- werteraum-by und nicht werteraum.
CREATE OR REPLACE FUNCTION public.campaign_id_aus_utm(p_utm text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT k.id
  FROM campaigns k
  WHERE k.utm_praefix IS NOT NULL
    AND (lower(btrim(p_utm)) = lower(k.utm_praefix)
         OR lower(btrim(p_utm)) LIKE lower(k.utm_praefix) || '-%')
  ORDER BY length(k.utm_praefix) DESC
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.campaign_id_aus_utm(text) IS
  'Loest eine utm_campaign auf die Kampagne auf. Laengster Praefix gewinnt — werteraum-by-w1 trifft werteraum-by, nicht werteraum. Gibt NULL zurueck, wenn kein Praefix passt; der Aufrufer entscheidet, ob das ein Fehler ist.';

REVOKE ALL ON FUNCTION public.campaign_id_aus_utm(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.campaign_id_aus_utm(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.campaign_id_aus_utm(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.campaign_id_aus_utm(text) TO authenticated;