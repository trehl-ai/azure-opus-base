-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE OR REPLACE FUNCTION get_vr_stiftungen_candidates(p_limit int DEFAULT 10)
RETURNS TABLE (
  contact_id uuid,
  deal_id uuid,
  first_name text,
  last_name text,
  email text,
  vr_hook text,
  vr_fit_score int,
  org_mission text,
  outreach_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contact_id,
    d.id AS deal_id,
    c.first_name,
    c.last_name,
    c.email,
    c.vr_hook,
    c.vr_fit_score,
    c.org_mission,
    c.outreach_status
  FROM contacts c
  JOIN company_contacts cc ON cc.contact_id = c.id
  JOIN deals d ON d.company_id = cc.company_id
  WHERE d.pipeline_id = '341c067d-39fe-46ae-82c7-33d6c55a2a60'
    AND c.source = 'vr-stiftungen-research'
    AND c.email IS NOT NULL
    AND c.email != ''
    AND COALESCE(c.outreach_status, 'pending') = 'pending'
    AND d.pipeline_stage_id NOT IN (
      '2a52e33e-00f1-4f4c-a138-213b144fd33c',
      'f9d7d2d2-8d91-4bda-a12c-f1e77d30f2bd',
      '04ed6542-21ca-46b7-b8bc-31bec6ead9c4'
    )
  ORDER BY c.vr_fit_score DESC NULLS LAST, c.created_at ASC
  LIMIT p_limit;
END;
$$;
