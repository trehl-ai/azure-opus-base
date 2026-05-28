-- Rewrite get_activity_stats so the KW comparison widget and Stage-Bewegungen
-- panel reflect Werteraum-Schulen (pipeline 61b1b7e2) only, with correct ISO-week
-- boundaries in Europe/Berlin TZ.
--
-- Widget rows after this migration:
--   Anrufe              = deal_activities.activity_type = 'call'
--   Briefe versendet    = deal_activities.activity_type = 'note' AND title ILIKE 'Brief versendet'
--   E-Mails versendet   = deal_activities.activity_type = 'email'
--   Wiedervorlage       = deal_activities.activity_type = 'note' AND title ILIKE 'Wiedervorlage'
--   Verloren            = deals.status = 'lost' AND lost_at in KW (deal-level, not activity-log)
--   Gesamt              = sum of the above (computed client-side)
--
-- Backwards-compat: stage_infos_* fields kept (Stage-Bewegungen panel still uses
-- them as the "Infomaterial" counter, separate from the KW widget).

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
      WHERE da.activity_type = 'call'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'calls_letzte_woche', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'call'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),

    'briefe_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Brief versendet%'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'briefe_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Brief versendet%'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),

    'emails_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'email'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'emails_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'email'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),

    'stage_wiedervorlage_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Wiedervorlage%'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'stage_wiedervorlage_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.activity_type = 'note' AND da.title ILIKE '%Wiedervorlage%'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_letzte_start AND da.created_at < kw_letzte_end
    ),

    'lost_diese_kw', (
      SELECT COUNT(*) FROM deals
      WHERE status = 'lost' AND deleted_at IS NULL
        AND pipeline_id = werteraum_pipeline
        AND lost_at >= kw_diese_start
    ),
    'lost_letzte_kw', (
      SELECT COUNT(*) FROM deals
      WHERE status = 'lost' AND deleted_at IS NULL
        AND pipeline_id = werteraum_pipeline
        AND lost_at >= kw_letzte_start AND lost_at < kw_letzte_end
    ),

    'stage_infos_diese_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.title ILIKE '%Infomaterial%'
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND da.created_at >= kw_diese_start
    ),
    'stage_infos_letzte_kw', (
      SELECT COUNT(*) FROM deal_activities da
      JOIN deals d ON d.id = da.deal_id
      WHERE da.title ILIKE '%Infomaterial%'
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
          AND da.title IN ('Infomaterial versandt', 'Erstkontakt — auf Wiedervorlage gesetzt', 'Deal als verloren markiert')
          AND da.created_at >= kw_letzte_start
        ORDER BY da.created_at DESC
        LIMIT 10
      ) t
    )
  );
END;
$function$;
