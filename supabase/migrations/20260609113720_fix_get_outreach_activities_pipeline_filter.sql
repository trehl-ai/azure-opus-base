-- Migration: 20260609113720_fix_get_outreach_activities_pipeline_filter
-- Backfilled from supabase_migrations.schema_migrations on project ttgvhqygmgtnjgwunuwz.
-- Originally applied out-of-band via Supabase MCP apply_migration (2026-06-09);
-- recorded here so schema-drift-check CI reconciles repo vs live DB.


CREATE OR REPLACE FUNCTION get_outreach_activities(
  p_limit int DEFAULT 20,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS TABLE (
  title text,
  created_at timestamptz,
  first_name text,
  last_name text,
  name text,
  activity_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
  ORDER BY da.created_at DESC 
  LIMIT p_limit;
$$;
