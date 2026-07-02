CREATE OR REPLACE FUNCTION get_academy_intel_status_bulk(p_contact_ids uuid[])
RETURNS TABLE(contact_id uuid, status text, fit_score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (ai.contact_id) ai.contact_id, ai.status, ai.fit_score
  FROM academy_intel ai
  WHERE ai.contact_id = ANY(p_contact_ids) AND ai.concept_slug = 'academy-of-stars'
  ORDER BY ai.contact_id, ai.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_academy_intel_status_bulk(uuid[]) TO authenticated;
