-- Add `replied` count to get_outreach_stats so the WerteRaum dashboard can
-- surface email_reply activity as a positive KPI. Mirrors the link_clicked
-- aggregate but filters on outreach_status = 'replied'.

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
  'replied',      COUNT(*) FILTER (WHERE outreach_status = 'replied'),
  'terminated',   COUNT(*) FILTER (WHERE outreach_status IN ('called','terminated','done')),
  'cluster_a',    COUNT(*) FILTER (WHERE outreach_cluster = 'A'),
  'cluster_b',    COUNT(*) FILTER (WHERE outreach_cluster = 'B'),
  'cluster_c',    COUNT(*) FILTER (WHERE outreach_cluster = 'C'),
  'cluster_d',    COUNT(*) FILTER (WHERE outreach_cluster = 'D')
)
FROM v_werteraum_outreach;
$$;
