-- Backfill of out-of-band migration 20260706181920 (sponsoring_leads_concept_filter).
-- Applied live to ttgv (ttgvhqygmgtnjgwunuwz) outside the repo; reconstructed byte-true
-- from pg_get_functiondef of the current live function so that repo == DB.
-- This revision adds the p_concept_slug parameter + concept-scoped academy_intel filter.

CREATE OR REPLACE FUNCTION public.get_top_sponsoring_leads(p_limit integer DEFAULT 20, p_concept_slug text DEFAULT 'academy-of-stars'::text)
 RETURNS TABLE(contact_id uuid, name text, unternehmen text, "position" text, lead_score integer, academy_fit_score integer, sponsoring_score integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH concept_fit AS (
    SELECT DISTINCT ON (ai.contact_id) ai.contact_id, ai.fit_score
    FROM academy_intel ai
    WHERE ai.status = 'generated' AND ai.fit_score IS NOT NULL
      AND ai.concept_slug = p_concept_slug
    ORDER BY ai.contact_id, ai.updated_at DESC
  )
  SELECT
    c.id,
    trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    COALESCE(co.name, c.company, '—'),
    c.job_title,
    c.lead_score,
    a.fit_score,
    CASE
      WHEN a.fit_score IS NOT NULL
        THEN round(0.7 * c.lead_score + 0.3 * a.fit_score)::int
      ELSE c.lead_score
    END AS sponsoring_score
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT company_id FROM company_contacts WHERE contact_id = c.id LIMIT 1
  ) l ON true
  LEFT JOIN companies co ON co.id = l.company_id
  LEFT JOIN concept_fit a ON a.contact_id = c.id
  WHERE c.lead_score IS NOT NULL AND c.lead_score > 0 AND c.deleted_at IS NULL
  ORDER BY sponsoring_score DESC NULLS LAST, c.last_name
  LIMIT p_limit;
$function$;
