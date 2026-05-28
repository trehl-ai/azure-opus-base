-- Dashboard fixes:
-- 1. Add `won_deal_count` so the Dashboard "Gewonnen" KPI subtext can show the
--    true count of won deals instead of min(20, distinct (company, pipeline)
--    rows from hover_won_companies) which was misleading users as "20 statt 68".
-- 2. Re-shape `pipeline_breakdown` to match the new two-mode chart toggle:
--      - total_value    → SUM of WON deals per pipeline   (chart "Gesamt" mode)
--      - weighted_value → SUM of OPEN deals * probability (chart "Gewichtet" mode)
--      - deal_count     → COUNT of OPEN deals (still emitted in the type even
--                         though the chart no longer renders an "Anzahl" toggle).

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN json_build_object(
    'pipeline_value', (
      SELECT COALESCE(SUM(value_amount), 0)
      FROM deals WHERE status = 'open' AND deleted_at IS NULL
    ),
    'won_value', (
      SELECT COALESCE(SUM(value_amount), 0)
      FROM deals WHERE status = 'won' AND deleted_at IS NULL
    ),
    'won_deal_count', (
      SELECT COUNT(*) FROM deals WHERE status = 'won' AND deleted_at IS NULL
    ),
    'deal_count', (
      SELECT COUNT(*) FROM deals WHERE deleted_at IS NULL
    ),
    'avg_probability', (
      SELECT COALESCE(AVG(probability_percent), 0)::int
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL AND probability_percent IS NOT NULL
    ),
    'weighted_probability', (
      SELECT CASE
        WHEN COALESCE(SUM(value_amount), 0) = 0 THEN 0
        ELSE ROUND(SUM(value_amount * probability_percent) / SUM(value_amount))::int
      END
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND probability_percent IS NOT NULL AND value_amount IS NOT NULL
    ),
    'expected_value', (
      SELECT COALESCE(SUM(value_amount * probability_percent / 100), 0)::int
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND probability_percent IS NOT NULL AND value_amount IS NOT NULL
    ),
    'contact_count', (
      SELECT COUNT(*) FROM contacts WHERE deleted_at IS NULL
    ),
    'company_count', (
      SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL
    ),
    'hot_leads',    (SELECT COUNT(*) FROM contacts WHERE lead_score >= 80 AND deleted_at IS NULL),
    'warm_leads',   (SELECT COUNT(*) FROM contacts WHERE lead_score >= 60 AND lead_score < 80 AND deleted_at IS NULL),
    'medium_leads', (SELECT COUNT(*) FROM contacts WHERE lead_score >= 40 AND lead_score < 60 AND deleted_at IS NULL),
    'cold_leads',   (SELECT COUNT(*) FROM contacts WHERE lead_score < 40 AND deleted_at IS NULL),
    'pipeline_breakdown', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          p.name,
          COALESCE(SUM(d.value_amount) FILTER (WHERE d.status = 'won'), 0) AS total_value,
          COALESCE(SUM(d.value_amount * d.probability_percent / 100) FILTER (WHERE d.status = 'open'), 0)::int AS weighted_value,
          COUNT(d.id) FILTER (WHERE d.status = 'open') AS deal_count
        FROM pipelines p
        LEFT JOIN deals d ON d.pipeline_id = p.id AND d.deleted_at IS NULL
        GROUP BY p.name
        ORDER BY total_value DESC
      ) t
    ),
    'hover_pipeline_companies', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          c.name as company_name,
          p.name as pipeline_name,
          COALESCE(SUM(d.value_amount), 0) as total_value,
          COUNT(d.id) as deal_count
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        JOIN pipelines p ON d.pipeline_id = p.id
        WHERE d.status = 'open' AND d.deleted_at IS NULL
        GROUP BY c.name, p.name
        ORDER BY total_value DESC
        LIMIT 20
      ) t
    ),
    'hover_won_companies', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          c.name as company_name,
          p.name as pipeline_name,
          COALESCE(SUM(d.value_amount), 0) as total_value,
          COUNT(d.id) as deal_count
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        JOIN pipelines p ON d.pipeline_id = p.id
        WHERE d.status = 'won' AND d.deleted_at IS NULL
        GROUP BY c.name, p.name
        ORDER BY total_value DESC
        LIMIT 20
      ) t
    ),
    'hover_probability_companies', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          c.name as company_name,
          p.name as pipeline_name,
          COALESCE(SUM(d.value_amount * d.probability_percent / 100), 0)::int as expected_value,
          AVG(d.probability_percent)::int as avg_probability,
          COUNT(d.id) as deal_count
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        JOIN pipelines p ON d.pipeline_id = p.id
        WHERE d.status = 'open' AND d.deleted_at IS NULL
          AND d.probability_percent IS NOT NULL AND d.value_amount IS NOT NULL
        GROUP BY c.name, p.name
        ORDER BY expected_value DESC
        LIMIT 20
      ) t
    )
  );
END;
$function$;
