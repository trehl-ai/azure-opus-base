-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260611152433 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

-- Fix 1: get_vr_stiftungen_stats — deleted_at IS NULL in both deal_activities subqueries + contacts base
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
    EXISTS (
      SELECT 1 FROM deal_activities da
      WHERE da.contact_id = ct.id
        AND da.deleted_at IS NULL
        AND ( da.title       ILIKE '%abmeld%'
           OR da.title       ILIKE '%opt%out%'
           OR da.title       ILIKE '%nicht kontaktieren%'
           OR da.title       ILIKE '%unsubscribe%'
           OR da.description  ILIKE '%abmeld%'
           OR da.description  ILIKE '%nicht kontaktieren%'
           OR da.description  ILIKE '%unsubscribe%' )
    ) AS has_optout_activity,
    EXISTS (
      SELECT 1 FROM deal_activities da
      WHERE da.contact_id = ct.id
        AND da.deleted_at IS NULL
        AND ( da.activity_type ILIKE '%mail%'
           OR da.activity_type ILIKE '%email%'
           OR da.title         ILIKE '%mail%'
           OR da.sequence_type IS NOT NULL
           OR da.mail_entwurf  IS NOT NULL )
    ) AS has_mail_activity
  FROM contacts ct
  WHERE ct.source = 'vr-stiftungen-research'
    AND ct.deleted_at IS NULL
)
SELECT json_build_object(
  'gesamt',       COUNT(*),
  'pending',      COUNT(*) FILTER (WHERE COALESCE(st,'pending') = 'pending'),
  'email_sent',   COUNT(*) FILTER (WHERE st = 'email_sent'),
  'link_clicked', 0,
  'replied',      COUNT(*) FILTER (WHERE st = 'replied'),
  'terminated',   COUNT(*) FILTER (WHERE st IN ('called','terminated','done')),
  'opt_out',      COUNT(*) FILTER (WHERE
                       (st = 'terminated' AND has_optout_activity)
                    OR (st = 'replied'    AND has_optout_activity) ),
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

-- Fix 2: v_werteraum_outreach — c.deleted_at IS NULL ergänzen
CREATE OR REPLACE VIEW public.v_werteraum_outreach AS
 SELECT c.id AS contact_id,
    c.first_name,
    c.last_name,
    c.anrede,
    c.email,
    c.phone,
    c.job_title,
    co.name AS company_name,
    ps.name AS stage,
    c.lead_score AS outreach_score,
    c.outreach_cluster,
    c.outreach_hook,
    c.outreach_email_draft,
    c.outreach_status,
    c.lead_score_details,
    c.schneeball_asked_at,
    c.schneeball_referrals,
    c.webinar_invited_at,
    c.webinar_attended_at,
    d.id AS deal_id,
    d.value_amount
   FROM contacts c
     JOIN company_contacts cc ON cc.contact_id = c.id
     JOIN companies co ON co.id = cc.company_id
     JOIN deals d ON d.company_id = co.id
     JOIN pipelines p ON p.id = d.pipeline_id
     JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  WHERE p.name ILIKE '%werteraum%'
    AND d.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND c.email IS NOT NULL
  ORDER BY c.lead_score DESC NULLS LAST, ps.name;
