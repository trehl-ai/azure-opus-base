-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260527112442].statements[1]

CREATE OR REPLACE FUNCTION get_outreach_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT json_build_object(
  'gesamt',       COUNT(*),
  'pending',      COUNT(*) FILTER (WHERE outreach_status = 'pending'),
  'email_sent',   COUNT(*) FILTER (WHERE outreach_status = 'email_sent'),
  'link_clicked', COUNT(*) FILTER (WHERE outreach_status = 'link_clicked'),
  'terminated',   COUNT(*) FILTER (WHERE outreach_status IN ('called','terminated','done')),
  'cluster_a',    COUNT(*) FILTER (WHERE outreach_cluster = 'A'),
  'cluster_b',    COUNT(*) FILTER (WHERE outreach_cluster = 'B'),
  'cluster_c',    COUNT(*) FILTER (WHERE outreach_cluster = 'C'),
  'cluster_d',    COUNT(*) FILTER (WHERE outreach_cluster = 'D')
)
FROM v_werteraum_outreach;
$$;
