DROP FUNCTION IF EXISTS public.get_top_leads(int);
CREATE OR REPLACE FUNCTION public.get_top_leads(p_limit int DEFAULT 10)
RETURNS TABLE(contact_id uuid, name text, unternehmen text, "position" text, lead_score int)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id,
         trim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')),
         COALESCE(co.name, c.company, '—'),
         c.job_title,
         c.lead_score
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT company_id FROM company_contacts WHERE contact_id = c.id LIMIT 1
  ) l ON true
  LEFT JOIN companies co ON co.id = l.company_id
  WHERE c.lead_score IS NOT NULL AND c.deleted_at IS NULL
  ORDER BY c.lead_score DESC, c.last_name
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_leads(int) TO anon, authenticated, service_role;
