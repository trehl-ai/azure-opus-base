-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE OR REPLACE FUNCTION get_eis_connect_queue(p_limit int DEFAULT 25)
RETURNS TABLE (
  id               uuid,
  full_name        text,
  title            text,
  linkedin_url     text,
  company_name     text,
  industry         text,
  company_hq_country text,
  final_score      int,
  score_reasoning  text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(lq.id)
  INTO v_ids
  FROM (
    SELECT lq2.id
    FROM eis_lead_queue lq2
    WHERE lq2.score_verified = true
      AND lq2.abgeholt = false
      AND lq2.linkedin_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM eis_contacts c
        WHERE c.linkedin_url = lq2.linkedin_url
          AND c.outreach_status != 'pending'
      )
    ORDER BY lq2.final_score DESC, lq2.created_at ASC
    LIMIT p_limit
  ) lq;

  IF v_ids IS NOT NULL THEN
    UPDATE eis_lead_queue lq3
    SET abgeholt = true, abgeholt_at = now()
    WHERE lq3.id = ANY(v_ids);
  END IF;

  RETURN QUERY
  SELECT
    lq4.id,
    lq4.full_name,
    lq4.title,
    lq4.linkedin_url,
    lq4.company_name,
    lq4.industry,
    lq4.company_hq_country,
    lq4.final_score,
    lq4.score_reasoning
  FROM eis_lead_queue lq4
  WHERE lq4.id = ANY(v_ids)
  ORDER BY lq4.final_score DESC;
END;
$$;
