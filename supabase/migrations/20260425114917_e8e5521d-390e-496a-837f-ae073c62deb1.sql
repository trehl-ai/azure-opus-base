CREATE OR REPLACE FUNCTION public.get_activity_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weekly jsonb;
  v_recent jsonb;
  v_total_7 integer;
  v_total_30 integer;
  v_total_all integer;
BEGIN
  -- Weekly counts (last 3 weeks) grouped by activity_type
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_weekly
  FROM (
    SELECT
      to_char(date_trunc('week', a.created_at), 'IYYY-"W"IW') AS week_key,
      to_char(date_trunc('week', a.created_at), 'DD.MM.') AS week_label,
      a.activity_type,
      COUNT(*)::int AS count
    FROM deal_activities a
    WHERE a.created_at >= (now() - interval '21 days')
    GROUP BY date_trunc('week', a.created_at), a.activity_type
    ORDER BY date_trunc('week', a.created_at) ASC
  ) t;

  -- KPI totals
  SELECT COUNT(*)::int INTO v_total_7 FROM deal_activities WHERE created_at >= (now() - interval '7 days');
  SELECT COUNT(*)::int INTO v_total_30 FROM deal_activities WHERE created_at >= (now() - interval '30 days');
  SELECT COUNT(*)::int INTO v_total_all FROM deal_activities;

  -- Recent 5 activities with deal/company
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT
      a.id,
      a.activity_type,
      a.title,
      a.created_at,
      a.deal_id,
      d.title AS deal_title,
      c.name AS company_name
    FROM deal_activities a
    LEFT JOIN deals d ON d.id = a.deal_id
    LEFT JOIN companies c ON c.id = d.company_id
    ORDER BY a.created_at DESC
    LIMIT 5
  ) r;

  RETURN jsonb_build_object(
    'weekly', v_weekly,
    'recent', v_recent,
    'total_7d', v_total_7,
    'total_30d', v_total_30,
    'total_all', v_total_all
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_stats() TO authenticated;