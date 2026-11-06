-- Stiftungs-Nachfass (Tomi 06.11.2026: angehen, weil es bis 28.10. kein Postfach/Messinstrument gab).
-- STABLE, schreibt nichts. Nur service_role.
CREATE OR REPLACE FUNCTION public.get_vr_stiftungen_nachfass_candidates(
  p_limit integer DEFAULT 15,
  p_domain_cap integer DEFAULT 2)
RETURNS TABLE(deal_id uuid, contact_id uuid, email text, anrede_final text, company_name text,
              outreach_status text, erst_am timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH erst AS (
    SELECT da.deal_id, min(da.created_at) AS erst_am
    FROM deal_activities da
    WHERE da.deleted_at IS NULL AND da.activity_type = 'email'
      AND da.campaign_id = 'c12ee0d1-5b66-4497-bfd3-73cdf1e19d94'::uuid   -- VR Fit & Aktiv — Stiftungen
    GROUP BY 1
  ),
  gesperrt AS (
    SELECT DISTINCT lower(btrim(c3.email)) AS mail FROM contacts c3
    WHERE c3.deleted_at IS NULL AND c3.email IS NOT NULL AND btrim(c3.email) <> ''
      AND (c3.bounce_at IS NOT NULL
           OR c3.outreach_status IN ('bounced','blocked_unklare_adresse','blocked_behoerde','blocked_widerspruch'))
  ),
  cand AS (
    SELECT e.deal_id, c.id AS contact_id, c.email, c.outreach_status, co.name AS company_name, e.erst_am,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          THEN 'Sehr geehrte Damen und Herren'
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final
    FROM erst e
    JOIN deals d ON d.id = e.deal_id AND d.deleted_at IS NULL AND d.status = 'open'
      AND d.pipeline_id = '341c067d-39fe-46ae-82c7-33d6c55a2a60'::uuid
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id AND ps.name IN ('Qualifiziert','Infomaterial erhalten')
    JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      AND c.outreach_status IN ('email_sent','link_clicked')
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND lower(btrim(c.email)) NOT IN (SELECT mail FROM gesperrt)
      AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = lower(btrim(c.email)))
      AND NOT EXISTS (SELECT 1 FROM deal_activities x WHERE x.deal_id = e.deal_id AND x.deleted_at IS NULL
                      AND x.activity_type = 'email' AND x.sequence_type = 'stiftung_nachfass')
  ),
  dedup AS (SELECT DISTINCT ON (lower(email)) * FROM cand ORDER BY lower(email), (outreach_status='link_clicked') DESC, erst_am),
  ranked AS (
    SELECT *, row_number() OVER (PARTITION BY lower(split_part(email,'@',2))
                                 ORDER BY (outreach_status='link_clicked') DESC, erst_am, contact_id) AS domain_rn
    FROM dedup)
  SELECT deal_id, contact_id, email, anrede_final, company_name, outreach_status, erst_am
  FROM ranked WHERE domain_rn <= p_domain_cap
  ORDER BY (outreach_status='link_clicked') DESC, erst_am, contact_id
  LIMIT p_limit;
$function$;

REVOKE ALL ON FUNCTION public.get_vr_stiftungen_nachfass_candidates(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vr_stiftungen_nachfass_candidates(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_vr_stiftungen_nachfass_candidates(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_vr_stiftungen_nachfass_candidates(integer, integer) TO service_role;