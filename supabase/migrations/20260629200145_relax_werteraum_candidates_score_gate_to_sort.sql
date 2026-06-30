-- Score-Gate entfernt (lead_score>=30), Score = Sortierung. Company-Pfad only, KEIN Throttle/Gate (kommt erst 065004/065808).
-- Angewandt 2026-06-29 via MCP.
CREATE OR REPLACE FUNCTION public.get_werteraum_candidates(p_limit integer DEFAULT 30)
 RETURNS TABLE(contact_id uuid, first_name text, last_name text, anrede text, email text, company_name text, outreach_hook text, outreach_email_draft text, outreach_cluster text, outreach_score integer, deal_id uuid, bundesland text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT contact_id, first_name, last_name, anrede, email, company_name,
         outreach_hook, outreach_email_draft, outreach_cluster, outreach_score, deal_id, bundesland
  FROM (
    SELECT DISTINCT ON (c.id)
      c.id AS contact_id, c.first_name, c.last_name, c.anrede, c.email,
      co.name AS company_name, c.outreach_hook, c.outreach_email_draft,
      c.outreach_cluster, c.lead_score AS outreach_score, d.id AS deal_id, c.bundesland
    FROM contacts c
      JOIN company_contacts cc ON cc.contact_id = c.id
      JOIN companies co ON co.id = cc.company_id
      JOIN deals d ON d.company_id = co.id
      JOIN pipelines p ON p.id = d.pipeline_id
    WHERE p.name ILIKE '%werteraum%'
      AND d.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND c.outreach_cluster IS NOT NULL
      AND c.outreach_status = 'pending'
      AND d.pipeline_stage_id = 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities da
        WHERE da.deal_id = d.id AND da.activity_type = 'email'
      )
    ORDER BY c.id, d.id
  ) s
  ORDER BY outreach_score DESC NULLS LAST, contact_id
  LIMIT p_limit;
$function$;
