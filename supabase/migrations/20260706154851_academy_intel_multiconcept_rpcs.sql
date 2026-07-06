
-- Phase 2a: RPCs multi-concept-faehig. Alle p_concept_slug DEFAULT 'academy-of-stars'
-- (Rueckwaertskompat: Bestandsaufrufer ohne Slug funktionieren unveraendert).
-- get_academy_intel_context liefert zusaetzlich static_facts aus concepts (n8n braucht sie im selben Call).

-- 1) get_academy_intel_context: Slug-Param + static_facts-Join
CREATE OR REPLACE FUNCTION get_academy_intel_context(
  p_contact_id uuid,
  p_concept_slug text DEFAULT 'academy-of-stars'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_hash text;
  v_result jsonb;
BEGIN
  v_hash := compute_academy_intel_hash(p_contact_id, p_concept_slug);

  SELECT jsonb_build_object(
    'contact_id', c.id,
    'full_name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    'job_title', c.job_title,
    'company_id', co.id,
    'company_name', co.name,
    'website', co.website,
    'industry', co.industry,
    'lead_score', c.lead_score,
    'concept_slug', p_concept_slug,
    'concept_hash', v_hash,
    'concept_title', cn.title,
    'concept_static_facts', cn.static_facts,
    'cached', ai.id IS NOT NULL,
    'cached_status', ai.status,
    'cached_intel', ai.intel,
    'cached_fit_score', ai.fit_score
  ) INTO v_result
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT co.* FROM company_contacts cc
    JOIN companies co ON co.id = cc.company_id
    WHERE cc.contact_id = c.id
    ORDER BY (cc.relationship_type = 'main_contact') DESC
    LIMIT 1
  ) co ON true
  LEFT JOIN concepts cn ON cn.slug = p_concept_slug
  LEFT JOIN academy_intel ai ON ai.contact_id = c.id AND ai.concept_slug = p_concept_slug AND ai.concept_hash = v_hash
  WHERE c.id = p_contact_id;

  RETURN v_result;
END;
$function$;

-- 2) upsert_academy_intel: Slug-Param (ans Ende, Default). Literal 'academy-of-stars' -> p_concept_slug
CREATE OR REPLACE FUNCTION upsert_academy_intel(
  p_contact_id uuid,
  p_concept_hash text,
  p_status text,
  p_intel jsonb DEFAULT NULL,
  p_fit_score integer DEFAULT NULL,
  p_entity_gate jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_concept_slug text DEFAULT 'academy-of-stars'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO academy_intel (contact_id, concept_slug, concept_hash, status, intel, fit_score, entity_gate, error_message, generated_at)
  VALUES (p_contact_id, p_concept_slug, p_concept_hash, p_status, p_intel, p_fit_score, p_entity_gate, p_error_message,
          CASE WHEN p_status = 'generated' THEN now() ELSE NULL END)
  ON CONFLICT (contact_id, concept_slug, concept_hash)
  DO UPDATE SET
    status = EXCLUDED.status,
    intel = COALESCE(EXCLUDED.intel, academy_intel.intel),
    fit_score = COALESCE(EXCLUDED.fit_score, academy_intel.fit_score),
    entity_gate = COALESCE(EXCLUDED.entity_gate, academy_intel.entity_gate),
    error_message = EXCLUDED.error_message,
    generated_at = CASE WHEN EXCLUDED.status = 'generated' THEN now() ELSE academy_intel.generated_at END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- 3) get_academy_intel_status_bulk: Slug-Param
CREATE OR REPLACE FUNCTION get_academy_intel_status_bulk(
  p_contact_ids uuid[],
  p_concept_slug text DEFAULT 'academy-of-stars'
)
RETURNS TABLE(contact_id uuid, status text, fit_score integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT DISTINCT ON (ai.contact_id) ai.contact_id, ai.status, ai.fit_score
  FROM academy_intel ai
  WHERE ai.contact_id = ANY(p_contact_ids) AND ai.concept_slug = p_concept_slug
  ORDER BY ai.contact_id, ai.updated_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION get_academy_intel_context(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_academy_intel_status_bulk(uuid[], text) TO authenticated;
REVOKE EXECUTE ON FUNCTION upsert_academy_intel(uuid, text, text, jsonb, integer, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_academy_intel(uuid, text, text, jsonb, integer, jsonb, text, text) TO service_role;
