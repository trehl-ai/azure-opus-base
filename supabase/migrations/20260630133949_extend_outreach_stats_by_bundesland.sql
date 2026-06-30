-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260630133949 — exact statements as recorded in the live DB (pg_get_functiondef). Already applied; present for repo/drift-check parity.
-- Extends get_outreach_stats() with by_bundesland breakdown (per-Bundesland gesamt/pending/email_sent/link_clicked/replied/terminated/cluster_a..d).
CREATE OR REPLACE FUNCTION public.get_outreach_stats()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  'cluster_d',    COUNT(*) FILTER (WHERE outreach_cluster = 'D'),
  'by_bundesland', (
    SELECT coalesce(json_agg(row_to_json(b) ORDER BY b.gesamt DESC), '[]'::json)
    FROM (
      SELECT
        coalesce(bundesland,'Unbekannt')                                   AS bundesland,
        COUNT(*)                                                           AS gesamt,
        COUNT(*) FILTER (WHERE outreach_status = 'pending')                AS pending,
        COUNT(*) FILTER (WHERE outreach_status = 'email_sent')             AS email_sent,
        COUNT(*) FILTER (WHERE outreach_status = 'link_clicked')           AS link_clicked,
        COUNT(*) FILTER (WHERE outreach_status = 'replied')                AS replied,
        COUNT(*) FILTER (WHERE outreach_status IN ('called','terminated','done')) AS terminated,
        COUNT(*) FILTER (WHERE outreach_cluster = 'A')                     AS cluster_a,
        COUNT(*) FILTER (WHERE outreach_cluster = 'B')                     AS cluster_b,
        COUNT(*) FILTER (WHERE outreach_cluster = 'C')                     AS cluster_c,
        COUNT(*) FILTER (WHERE outreach_cluster = 'D')                     AS cluster_d
      FROM v_werteraum_outreach
      GROUP BY coalesce(bundesland,'Unbekannt')
    ) b
  )
)
FROM v_werteraum_outreach;
$function$;
