-- Foerderer-Nachfass: get_vr_foerderer_nachfass_candidates (go Funktion Tomi 24.11.2026).
-- Quelle: ~/eic-001/work/foerderer_nachfass_entwurf_v2_20261124.sql (faellig nach Kalendertagen Europe/Berlin).
-- Rollback-Test 24.11.: p_min_tage 14 = 0, 5 = 13 (Erstmails 19.11.), 0 = 120; lesende Gegenprobe identisch.
--
-- get_vr_foerderer_nachfass_candidates: Nachfass (campaign_mailings Nr. 4, eb871f1f) fuer Foerderer-Deals,
-- deren Erstmail (Nr. 3, sequence_type stiftung_erstmail_foerderer) mindestens p_min_tage alt ist.
-- Sperren und Domain-Cap wie get_vr_foerderer_erst_candidates; Sortierung nach Datum der Erstmail.
-- Abgrenzung: get_vr_stiftungen_nachfass_candidates schliesst source vr-foerderer-2611 bereits aus (19.11.2026),
-- es gibt also keine Ueberschneidung mit dem Stiftungs-Nachfass (SMnT).

CREATE OR REPLACE FUNCTION public.get_vr_foerderer_nachfass_candidates(
  p_limit integer DEFAULT 15, p_domain_cap integer DEFAULT 2, p_min_tage integer DEFAULT 14)
 RETURNS TABLE(deal_id uuid, contact_id uuid, email text, anrede_final text, company_name text, outreach_status text, erst_am timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH erst AS (
    SELECT da.deal_id, min(da.created_at) AS erst_am
    FROM deal_activities da
    WHERE da.deleted_at IS NULL AND da.activity_type = 'email'
      AND da.sequence_type = 'stiftung_erstmail_foerderer'
      AND da.campaign_id = 'c12ee0d1-5b66-4497-bfd3-73cdf1e19d94'::uuid
    GROUP BY 1
  ),
  gesperrt AS (
    SELECT DISTINCT lower(btrim(c3.email)) AS mail FROM contacts c3
    WHERE c3.deleted_at IS NULL AND c3.email IS NOT NULL AND btrim(c3.email) <> ''
      AND (c3.bounce_at IS NOT NULL
           OR c3.outreach_status IN ('bounced','blocked_unklare_adresse','blocked_behoerde','blocked_widerspruch'))
  ),
  cand AS (
    SELECT d.id AS deal_id, c.id AS contact_id, c.email, c.outreach_status, co.name AS company_name, e.erst_am,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          THEN 'Sehr geehrte Damen und Herren'
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final
    FROM erst e
    JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL AND d.status = 'open'
      AND d.source = 'vr-foerderer-2611'
      AND d.pipeline_id = '341c067d-39fe-46ae-82c7-33d6c55a2a60'::uuid
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id AND ps.name = 'Infomaterial erhalten'
    JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE (e.erst_am AT TIME ZONE 'Europe/Berlin')::date <= (now() AT TIME ZONE 'Europe/Berlin')::date - p_min_tage
      AND c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      AND c.outreach_status IN ('email_sent','link_clicked')
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND NOT firma_ist_kunde(d.company_id, d.id)
      AND lower(btrim(c.email)) NOT IN (SELECT mail FROM gesperrt)
      AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = lower(btrim(c.email)))
      AND NOT EXISTS (SELECT 1 FROM deal_activities x WHERE x.deal_id = d.id AND x.deleted_at IS NULL
                      AND x.activity_type = 'email' AND x.sequence_type = 'stiftung_nachfass_foerderer')
  ),
  dedup AS (SELECT DISTINCT ON (lower(email)) * FROM cand ORDER BY lower(email), erst_am),
  ranked AS (
    SELECT *, row_number() OVER (PARTITION BY lower(split_part(email,'@',2)) ORDER BY erst_am, contact_id) AS domain_rn
    FROM dedup)
  SELECT deal_id, contact_id, email, anrede_final, company_name, outreach_status, erst_am
  FROM ranked WHERE domain_rn <= p_domain_cap
  ORDER BY erst_am, contact_id
  LIMIT p_limit;
$function$;

REVOKE ALL ON FUNCTION public.get_vr_foerderer_nachfass_candidates(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vr_foerderer_nachfass_candidates(integer, integer, integer) TO service_role;
NOTIFY pgrst, 'reload schema';

-- Offene Punkte vor der Anwendung:
-- 1. sequence_type 'stiftung_nachfass_foerderer' ist ein neuer Wert. Auf deal_activities gibt es keinen CHECK auf
--    sequence_type (gemessen 24.11.); get_domain_tagesbudget zaehlt alle email-Aktivitaeten der Domain unabhaengig davon.
-- 2. Ein Nachfass zieht die Stufe nicht weiter (wie SMnT). Wer geantwortet hat, steht nach dem Intake nicht mehr in
--    'Infomaterial erhalten' bzw. hat einen anderen outreach_status und faellt damit heraus.
