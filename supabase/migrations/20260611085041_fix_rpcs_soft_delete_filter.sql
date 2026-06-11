-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-11.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

CREATE OR REPLACE FUNCTION public.get_activity_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  kw_diese_start  timestamptz := date_trunc('week', (NOW() AT TIME ZONE 'Europe/Berlin')) AT TIME ZONE 'Europe/Berlin';
  kw_letzte_start timestamptz := (date_trunc('week', (NOW() AT TIME ZONE 'Europe/Berlin')) AT TIME ZONE 'Europe/Berlin') - INTERVAL '7 days';
  kw_letzte_end   timestamptz := date_trunc('week', (NOW() AT TIME ZONE 'Europe/Berlin')) AT TIME ZONE 'Europe/Berlin';
  kw_nr_diese  int := EXTRACT(week FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int;
  kw_nr_letzte int := EXTRACT(week FROM (NOW() AT TIME ZONE 'Europe/Berlin') - INTERVAL '7 days')::int;
  werteraum_pipeline uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
BEGIN
  RETURN json_build_object(
    'kw_nr_diese',  kw_nr_diese,
    'kw_nr_letzte', kw_nr_letzte,
    'calls_diese_woche', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'call' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'calls_letzte_woche', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'call' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),
    'briefe_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Brief versendet%' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'briefe_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Brief versendet%' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),
    'emails_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'email' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'emails_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'email' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),
    'stage_wiedervorlage_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Wiedervorlage%' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'stage_wiedervorlage_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Wiedervorlage%' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),
    'lost_diese_kw', (
      SELECT COUNT(*) FROM deals
      WHERE status = 'lost' AND deleted_at IS NULL
        AND pipeline_id = werteraum_pipeline
        AND lost_at >= kw_diese_start
        AND (lost_reason IS NULL OR lost_reason NOT ILIKE '%Import%')
    ),
    'lost_letzte_kw', (
      SELECT COUNT(*) FROM deals
      WHERE status = 'lost' AND deleted_at IS NULL
        AND pipeline_id = werteraum_pipeline
        AND lost_at >= kw_letzte_start AND lost_at < kw_letzte_end
        AND (lost_reason IS NULL OR lost_reason NOT ILIKE '%Import%')
    ),
    'stage_infos_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.title ILIKE '%Infomaterial%' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'stage_infos_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.title ILIKE '%Infomaterial%' AND da.deleted_at IS NULL
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),
    'funnel_kw', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          'KW ' || kw_nr_diese || ' (lfd.)' AS kw_label,
          COUNT(*) FILTER (WHERE da.title ILIKE '%Wiedervorlage%') AS zu_wiedervorlage,
          COUNT(*) FILTER (WHERE da.title ILIKE '%Infomaterial%')  AS zu_infos,
          COUNT(*) FILTER (WHERE da.title ILIKE '%verloren%')      AS zu_lost,
          0 AS zu_terminiert
        FROM deal_activities da
        JOIN deals d ON d.id = da.deal_id
        WHERE d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
          AND da.deleted_at IS NULL
          AND da.created_at >= kw_diese_start
        UNION ALL
        SELECT
          'KW ' || kw_nr_letzte AS kw_label,
          COUNT(*) FILTER (WHERE da.title ILIKE '%Wiedervorlage%') AS zu_wiedervorlage,
          COUNT(*) FILTER (WHERE da.title ILIKE '%Infomaterial%')  AS zu_infos,
          COUNT(*) FILTER (WHERE da.title ILIKE '%verloren%')      AS zu_lost,
          0 AS zu_terminiert
        FROM deal_activities da
        JOIN deals d ON d.id = da.deal_id
        WHERE d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
          AND da.deleted_at IS NULL
          AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
        ORDER BY kw_label DESC
      ) t
    ),
    'funnel_bestand', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT ps.name AS stage, ps.position, COUNT(d.id) AS deals
        FROM pipeline_stages ps
        LEFT JOIN deals d ON d.pipeline_stage_id = ps.id
          AND d.pipeline_id = werteraum_pipeline
          AND d.deleted_at IS NULL
        WHERE ps.pipeline_id = werteraum_pipeline
          AND ps.name NOT IN ('Verloren', 'Gewonnen')
        GROUP BY ps.name, ps.position
        ORDER BY ps.position
      ) t
    ),
    'stage_feed', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT da.activity_type, da.title, da.created_at, c.name AS company_name
        FROM deal_activities da
        JOIN deals d ON da.deal_id = d.id
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
          AND da.deleted_at IS NULL
          AND da.title IN ('Infomaterial versandt', 'Erstkontakt — auf Wiedervorlage gesetzt', 'Deal als verloren markiert')
          AND da.created_at >= kw_letzte_start
        ORDER BY da.created_at DESC
        LIMIT 10
      ) t
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_outreach_activities(p_limit integer DEFAULT 20, p_pipeline_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(title text, created_at timestamp with time zone, first_name text, last_name text, name text, activity_type text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT da.title, da.created_at, c.first_name, c.last_name,
         co.name, da.activity_type
  FROM deal_activities da
  JOIN deals d ON d.id = da.deal_id
  JOIN companies co ON co.id = d.company_id
  LEFT JOIN contacts c ON c.id = da.contact_id
  WHERE (
    da.title ILIKE '%Outreach%'
    OR da.title ILIKE '%WerteRaum%'
    OR da.title ILIKE '%VR Stiftungen%'
    OR da.title ILIKE '%Landing Page%'
    OR da.title ILIKE '%Research%'
    OR da.title ILIKE '%Score%'
    OR da.title ILIKE '%Mailing%'
  )
  AND da.deleted_at IS NULL
  AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
  ORDER BY da.created_at DESC
  LIMIT p_limit;
$function$;
