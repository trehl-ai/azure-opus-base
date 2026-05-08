-- get_dashboard_stats(): aggregates the entire dashboard payload
-- Returns a single jsonb that matches the DashboardStats type in
-- src/hooks/useDashboardStats.ts. Run as SECURITY DEFINER so RLS-protected
-- aggregates also surface for sales-role users.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
    open_deals AS (
      SELECT * FROM deals WHERE deleted_at IS NULL AND status = 'open'
    ),
    won_deals AS (
      SELECT * FROM deals WHERE deleted_at IS NULL AND status = 'won'
    ),
    by_pipeline AS (
      SELECT
        p.id AS pipeline_id,
        p.name AS pipeline_name,
        COUNT(d.id) FILTER (WHERE d.id IS NOT NULL) AS deal_count,
        COALESCE(SUM(d.value_amount), 0) AS total_value,
        COALESCE(SUM(d.value_amount * COALESCE(d.probability_percent, 0) / 100.0), 0) AS weighted_value
      FROM pipelines p
      LEFT JOIN open_deals d ON d.pipeline_id = p.id
      GROUP BY p.id, p.name
    ),
    pipeline_breakdown AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', pipeline_name,
          'deal_count', deal_count,
          'total_value', total_value,
          'weighted_value', weighted_value
        )
        ORDER BY total_value DESC
      ) AS arr
      FROM by_pipeline
    ),
    contact_score_buckets AS (
      SELECT
        COUNT(*) FILTER (WHERE lead_score >= 80) AS hot_leads,
        COUNT(*) FILTER (WHERE lead_score >= 60 AND lead_score < 80) AS warm_leads,
        COUNT(*) FILTER (WHERE lead_score >= 40 AND lead_score < 60) AS medium_leads,
        COUNT(*) FILTER (WHERE lead_score IS NOT NULL AND lead_score < 40) AS cold_leads
      FROM contacts
      WHERE deleted_at IS NULL
    ),
    totals AS (
      SELECT
        COALESCE(SUM(value_amount), 0) AS pipeline_value,
        COUNT(*) AS deal_count,
        COALESCE(AVG(NULLIF(probability_percent, 0)), 0) AS avg_probability,
        COALESCE(
          SUM(value_amount * COALESCE(probability_percent, 0) / 100.0)
          / NULLIF(SUM(value_amount), 0) * 100.0,
          0
        ) AS weighted_probability,
        COALESCE(SUM(value_amount * COALESCE(probability_percent, 0) / 100.0), 0) AS expected_value
      FROM open_deals
    ),
    won AS (
      SELECT COALESCE(SUM(value_amount), 0) AS won_value FROM won_deals
    ),
    counts AS (
      SELECT
        (SELECT COUNT(*) FROM contacts WHERE deleted_at IS NULL) AS contact_count,
        (SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL) AS company_count
    )
  SELECT jsonb_build_object(
    'pipeline_value',        t.pipeline_value,
    'won_value',             w.won_value,
    'deal_count',            t.deal_count,
    'avg_probability',       ROUND(t.avg_probability::numeric, 1),
    'weighted_probability',  ROUND(t.weighted_probability::numeric, 1),
    'expected_value',        t.expected_value,
    'contact_count',         c.contact_count,
    'company_count',         c.company_count,
    'hot_leads',             COALESCE(b.hot_leads, 0),
    'warm_leads',            COALESCE(b.warm_leads, 0),
    'medium_leads',          COALESCE(b.medium_leads, 0),
    'cold_leads',            COALESCE(b.cold_leads, 0),
    'pipeline_breakdown',    COALESCE(pb.arr, '[]'::jsonb)
  ) INTO result
  FROM totals t, won w, counts c, contact_score_buckets b, pipeline_breakdown pb;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
