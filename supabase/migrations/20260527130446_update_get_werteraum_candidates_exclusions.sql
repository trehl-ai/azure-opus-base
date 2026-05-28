-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260527130446].statements[1]
DROP FUNCTION IF EXISTS get_werteraum_candidates(int);

CREATE OR REPLACE FUNCTION get_werteraum_candidates(p_limit int DEFAULT 30)
RETURNS TABLE (
  contact_id uuid, first_name text, last_name text, anrede text, email text,
  company_name text, outreach_hook text, outreach_email_draft text,
  outreach_cluster text, outreach_score integer, deal_id uuid
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT contact_id, first_name, last_name, anrede, email, company_name,
         outreach_hook, outreach_email_draft, outreach_cluster, outreach_score, deal_id
  FROM (
    SELECT DISTINCT ON (c.id)
      c.id AS contact_id, c.first_name, c.last_name, c.anrede, c.email,
      co.name AS company_name, c.outreach_hook, c.outreach_email_draft,
      c.outreach_cluster, c.lead_score AS outreach_score, d.id AS deal_id
    FROM contacts c
      JOIN company_contacts cc ON cc.contact_id = c.id
      JOIN companies co ON co.id = cc.company_id
      JOIN deals d ON d.company_id = co.id
      JOIN pipelines p ON p.id = d.pipeline_id
    WHERE p.name ILIKE '%werteraum%'
      AND d.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND c.outreach_cluster IS NOT NULL
      AND c.outreach_cluster <> 'A'
      AND c.lead_score >= 30
      AND c.outreach_status NOT IN ('email_sent', 'terminated')
      AND d.pipeline_stage_id NOT IN (
        '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6'::uuid,  -- Terminiert
        'b088d711-a37b-4b00-abde-57f504567775'::uuid,  -- Gewonnen
        'ab0253f5-e40b-4ea9-89f8-a9edc668c350'::uuid   -- Verloren
      )
      AND ( c.outreach_status = 'pending'
            OR ( c.outreach_status <> 'email_sent'
                 AND d.pipeline_stage_id = 'cea6539e-7041-4017-8288-da0555914153'::uuid ) )
    ORDER BY c.id,
             (d.pipeline_stage_id = 'cea6539e-7041-4017-8288-da0555914153'::uuid) DESC,
             d.id
  ) s
  ORDER BY outreach_score DESC NULLS LAST
  LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
