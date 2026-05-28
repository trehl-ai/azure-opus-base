-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260527120414].statements[1]
DROP FUNCTION IF EXISTS get_outreach_activities(int);

CREATE OR REPLACE FUNCTION get_outreach_activities(p_limit int DEFAULT 20)
RETURNS TABLE (
  title text, created_at timestamptz,
  first_name text, last_name text,
  company_name text, activity_type text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
SELECT da.title, da.created_at, c.first_name, c.last_name,
       co.name, da.activity_type
FROM deal_activities da
JOIN deals d ON d.id = da.deal_id
JOIN companies co ON co.id = d.company_id
LEFT JOIN contacts c ON c.id = da.contact_id
WHERE da.title ILIKE '%Outreach%' OR da.title ILIKE '%WerteRaum%'
   OR da.title ILIKE '%Landing Page%' OR da.title ILIKE '%Research%'
ORDER BY da.created_at DESC LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
