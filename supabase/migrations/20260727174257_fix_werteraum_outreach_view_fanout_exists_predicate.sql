-- applied out-of-band via MCP am 2026-07-27, backfill.
-- Version 20260727174257 — exact statements as recorded in the live DB (pg_get_viewdef). Already applied; present for repo/drift-check parity.
-- Fixes the row fan-out in v_werteraum_outreach: deals were joined via the company, which multiplied
-- every contact by each additional WerteRaum deal of the school. Pipeline membership is now an EXISTS
-- predicate, the displayed deal comes from a LEFT JOIN LATERAL (oldest deal per company). Adds bundesland.
CREATE OR REPLACE VIEW public.v_werteraum_outreach AS
SELECT c.id AS contact_id, c.first_name, c.last_name, c.anrede, c.email, c.phone,
       c.job_title, co.name AS company_name, wd.stage_name AS stage,
       c.lead_score AS outreach_score, c.outreach_cluster, c.outreach_hook,
       c.outreach_email_draft, c.outreach_status, c.lead_score_details,
       c.schneeball_asked_at, c.schneeball_referrals, c.webinar_invited_at,
       c.webinar_attended_at, wd.deal_id, wd.value_amount, c.bundesland
FROM contacts c
JOIN company_contacts cc ON cc.contact_id = c.id
JOIN companies co ON co.id = cc.company_id
LEFT JOIN LATERAL (
  SELECT d.id AS deal_id, d.value_amount, ps.name AS stage_name
  FROM deals d
  JOIN pipelines p ON p.id = d.pipeline_id
  JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  WHERE d.company_id = cc.company_id AND d.deleted_at IS NULL AND p.name ILIKE '%werteraum%'
  ORDER BY d.created_at, d.id LIMIT 1
) wd ON true
WHERE c.deleted_at IS NULL AND c.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM deals d2 JOIN pipelines p2 ON p2.id = d2.pipeline_id
    WHERE d2.company_id = cc.company_id AND d2.deleted_at IS NULL AND p2.name ILIKE '%werteraum%'
  )
ORDER BY c.lead_score DESC NULLS LAST, wd.stage_name;
