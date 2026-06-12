-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612123027 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

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
  -- Stage-IDs Werteraum
  stage_wiedervorlage uuid := 'e152c133-d3c2-43f8-8e46-792933734fe3';
  stage_terminiert    uuid := '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6';
  stage_verloren      uuid := 'ab0253f5-e40b-4ea9-89f8-a9edc668c350';
  stage_infomaterial  uuid := '6c595ede-0cbf-4bf1-bc67-ef2231a47bfc'; -- Erneutes Mailing als Proxy
BEGIN
  RETURN json_build_object(
    'kw_nr_diese',  kw_nr_diese,
    'kw_nr_letzte', kw_nr_letzte,

    -- CALLS: unverändert korrekt
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

    -- BRIEFE: unverändert
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

    -- E-MAILS: unverändert korrekt
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

    -- WIEDERVORLAGE: jetzt aus audit_log Stage-Bewegungen
    'stage_wiedervorlage_diese_kw', (
      SELECT COUNT(*) FROM audit_log al
      JOIN deals d ON d.id = al.entity_id
      WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
        AND al.details->'changed_fields' ? 'pipeline_stage_id'
        AND (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_wiedervorlage
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND al.created_at >= kw_diese_start
    ),
    'stage_wiedervorlage_letzte_kw', (
      SELECT COUNT(*) FROM audit_log al
      JOIN deals d ON d.id = al.entity_id
      WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
        AND al.details->'changed_fields' ? 'pipeline_stage_id'
        AND (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_wiedervorlage
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND al.created_at >= kw_letzte_start AND al.created_at < kw_letzte_end
    ),

    -- LOST: unverändert korrekt
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

    -- INFOMATERIAL: jetzt aus audit_log → Stage "Erneutes Mailing" als Proxy (Infomaterial-Versand)
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

    -- TERMINIERT: neu aus audit_log
    'terminiert_diese_kw', (
      SELECT COUNT(*) FROM audit_log al
      JOIN deals d ON d.id = al.entity_id
      WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
        AND al.details->'changed_fields' ? 'pipeline_stage_id'
        AND (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_terminiert
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND al.created_at >= kw_diese_start
    ),
    'terminiert_letzte_kw', (
      SELECT COUNT(*) FROM audit_log al
      JOIN deals d ON d.id = al.entity_id
      WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
        AND al.details->'changed_fields' ? 'pipeline_stage_id'
        AND (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_terminiert
        AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
        AND al.created_at >= kw_letzte_start AND al.created_at < kw_letzte_end
    ),

    -- FUNNEL_KW: echte Stage-Bewegungen aus audit_log
    'funnel_kw', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT
          'KW ' || kw_nr_diese || ' (lfd.)' AS kw_label,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_wiedervorlage
          ) AS zu_wiedervorlage,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_infomaterial
          ) AS zu_infos,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_verloren
          ) AS zu_lost,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_terminiert
          ) AS zu_terminiert
        FROM audit_log al
        JOIN deals d ON d.id = al.entity_id
        WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
          AND al.details->'changed_fields' ? 'pipeline_stage_id'
          AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
          AND al.created_at >= kw_diese_start
        UNION ALL
        SELECT
          'KW ' || kw_nr_letzte AS kw_label,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_wiedervorlage
          ) AS zu_wiedervorlage,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_infomaterial
          ) AS zu_infos,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_verloren
          ) AS zu_lost,
          COUNT(*) FILTER (
            WHERE (al.details->'changed_fields'->>'pipeline_stage_id')::uuid = stage_terminiert
          ) AS zu_terminiert
        FROM audit_log al
        JOIN deals d ON d.id = al.entity_id
        WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
          AND al.details->'changed_fields' ? 'pipeline_stage_id'
          AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
          AND al.created_at >= kw_letzte_start AND al.created_at < kw_letzte_end
        ORDER BY kw_label DESC
      ) t
    ),

    -- FUNNEL_BESTAND: unverändert korrekt
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

    -- STAGE_FEED: aus audit_log mit Stage-Namen
    'stage_feed', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          ps.name AS stage_name,
          c.name AS company_name,
          al.created_at
        FROM audit_log al
        JOIN deals d ON d.id = al.entity_id
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN pipeline_stages ps 
          ON ps.id = (al.details->'changed_fields'->>'pipeline_stage_id')::uuid
        WHERE al.entity_type = 'deals' AND al.aktion = 'UPDATE'
          AND al.details->'changed_fields' ? 'pipeline_stage_id'
          AND d.pipeline_id = werteraum_pipeline AND d.deleted_at IS NULL
          AND (al.details->'changed_fields'->>'pipeline_stage_id')::uuid IN (
            stage_wiedervorlage, stage_terminiert, stage_verloren
          )
          AND al.created_at >= kw_letzte_start
        ORDER BY al.created_at DESC
        LIMIT 10
      ) t
    )
  );
END;
$function$;
