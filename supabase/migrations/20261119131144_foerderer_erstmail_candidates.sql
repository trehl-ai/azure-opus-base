-- 19.11.2026 Förderer-Erstmail (Zielliste 11/2026, deals.source = 'vr-foerderer-2611')
-- 1) Neue Kandidatenabfrage für die Erstmail (campaign_mailings c12ee0d1 Nr. 3)
CREATE OR REPLACE FUNCTION public.get_vr_foerderer_erst_candidates(p_limit integer DEFAULT 15, p_domain_cap integer DEFAULT 2)
 RETURNS TABLE(deal_id uuid, contact_id uuid, email text, anrede_final text, company_name text, outreach_status text, erst_am timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH gesperrt AS (
    SELECT DISTINCT lower(btrim(c3.email)) AS mail FROM contacts c3
    WHERE c3.deleted_at IS NULL AND c3.email IS NOT NULL AND btrim(c3.email) <> ''
      AND (c3.bounce_at IS NOT NULL
           OR c3.outreach_status IN ('bounced','blocked_unklare_adresse','blocked_behoerde','blocked_widerspruch'))
  ),
  cand AS (
    SELECT d.id AS deal_id, c.id AS contact_id, c.email, c.outreach_status, co.name AS company_name, d.created_at AS erst_am,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          THEN 'Sehr geehrte Damen und Herren'
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final
    FROM deals d
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id AND ps.name = 'Qualifiziert'
    JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE d.deleted_at IS NULL AND d.status = 'open'
      AND d.source = 'vr-foerderer-2611'
      AND d.pipeline_id = '341c067d-39fe-46ae-82c7-33d6c55a2a60'::uuid
      AND c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      AND c.outreach_status = 'pending'
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND NOT firma_ist_kunde(d.company_id, d.id)
      AND lower(btrim(c.email)) NOT IN (SELECT mail FROM gesperrt)
      AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = lower(btrim(c.email)))
      AND NOT EXISTS (SELECT 1 FROM deal_activities x WHERE x.deal_id = d.id AND x.deleted_at IS NULL AND x.activity_type = 'email')
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

REVOKE ALL ON FUNCTION public.get_vr_foerderer_erst_candidates(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vr_foerderer_erst_candidates(integer, integer) TO service_role;

-- 2) Stiftungs-Nachfass darf die Förderer nicht direkt am Folgetag erfassen (kein Wartezeit-Filter dort)
DO $$
DECLARE d text; s text := 'AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre'; n int;
BEGIN
  d := pg_get_functiondef('public.get_vr_stiftungen_nachfass_candidates(integer,integer)'::regprocedure);
  n := (length(d) - length(replace(d, s, ''))) / length(s);
  IF n <> 1 THEN RAISE EXCEPTION 'snippet count %', n; END IF;
  d := replace(d, s, s || E'\n      AND d.source IS DISTINCT FROM ''vr-foerderer-2611''   -- 19.11.2026: Foerderer-Erstmail hat eigene Strecke, kein Sofort-Nachfass');
  EXECUTE d;
END $$;