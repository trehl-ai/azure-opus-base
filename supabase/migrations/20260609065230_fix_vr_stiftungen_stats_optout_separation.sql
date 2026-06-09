-- Migration: 20260609065230_fix_vr_stiftungen_stats_optout_separation
-- Backfilled from supabase_migrations.schema_migrations on project ttgvhqygmgtnjgwunuwz.
-- Originally applied out-of-band via Supabase MCP apply_migration (2026-06-09);
-- recorded here so schema-drift-check CI reconciles repo vs live DB.

CREATE OR REPLACE FUNCTION public.get_vr_stiftungen_stats()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH c AS (
  SELECT
    ct.id,
    ct.outreach_status AS st,
    ct.vr_fit_score,
    -- real opt-out signal: an outbound-management activity that says abmelden / opt-out /
    -- nicht kontaktieren / unsubscribe (linked via contact_id)
    EXISTS (
      SELECT 1 FROM deal_activities da
      WHERE da.contact_id = ct.id
        AND ( da.title       ILIKE '%abmeld%'
           OR da.title       ILIKE '%opt%out%'
           OR da.title       ILIKE '%nicht kontaktieren%'
           OR da.title       ILIKE '%unsubscribe%'
           OR da.description  ILIKE '%abmeld%'
           OR da.description  ILIKE '%nicht kontaktieren%'
           OR da.description  ILIKE '%unsubscribe%' )
    ) AS has_optout_activity,
    -- was this contact ever actually mailed? (no mail activity => terminated before mailing)
    EXISTS (
      SELECT 1 FROM deal_activities da
      WHERE da.contact_id = ct.id
        AND ( da.activity_type ILIKE '%mail%'
           OR da.activity_type ILIKE '%email%'
           OR da.title         ILIKE '%mail%'
           OR da.sequence_type IS NOT NULL
           OR da.mail_entwurf  IS NOT NULL )
    ) AS has_mail_activity
  FROM contacts ct
  WHERE ct.source = 'vr-stiftungen-research'
)
SELECT json_build_object(
  'gesamt',       COUNT(*),
  'pending',      COUNT(*) FILTER (WHERE COALESCE(st,'pending') = 'pending'),
  'email_sent',   COUNT(*) FILTER (WHERE st = 'email_sent'),
  'link_clicked', 0,
  'replied',      COUNT(*) FILTER (WHERE st = 'replied'),
  -- "Nicht kontaktieren" bucket (mirrors Werteraum get_outreach_stats) -- NOT an opt-out count
  'terminated',   COUNT(*) FILTER (WHERE st IN ('called','terminated','done')),
  -- real opt-outs only: terminated/replied contacts with an explicit abmelde/opt-out signal.
  -- Self-correcting: currently 0 because no real opt-outs have occurred yet.
  'opt_out',      COUNT(*) FILTER (WHERE
                       (st = 'terminated' AND has_optout_activity)
                    OR (st = 'replied'    AND has_optout_activity) ),
  -- contacts moved to "Terminiert" before any mail went out -- must NOT count as opt-out
  'terminated_before_mailing', COUNT(*) FILTER (WHERE
                       st = 'terminated'
                       AND NOT has_optout_activity
                       AND NOT has_mail_activity ),
  'cluster_a',    COUNT(*) FILTER (WHERE vr_fit_score >= 8),
  'cluster_b',    COUNT(*) FILTER (WHERE vr_fit_score >= 6 AND vr_fit_score < 8),
  'cluster_c',    COUNT(*) FILTER (WHERE vr_fit_score >= 4 AND vr_fit_score < 6),
  'cluster_d',    COUNT(*) FILTER (WHERE vr_fit_score < 4 OR vr_fit_score IS NULL)
)
FROM c;
$function$;
