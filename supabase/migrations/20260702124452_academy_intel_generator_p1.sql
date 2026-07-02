-- academy_intel: Cache-Tabelle für Generator-WF (löst Hack #1 ab)
CREATE TABLE IF NOT EXISTS academy_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  concept_slug text NOT NULL DEFAULT 'academy-of-stars',
  concept_version text NOT NULL DEFAULT 'v1',
  concept_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generated','entity_gate_blocked','error')),
  fit_score integer,
  intel jsonb,
  entity_gate jsonb,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, concept_slug, concept_hash)
);

CREATE INDEX IF NOT EXISTS idx_academy_intel_contact ON academy_intel(contact_id);
CREATE INDEX IF NOT EXISTS idx_academy_intel_status ON academy_intel(status);

-- Hash: einzige Quelle der Wahrheit für Cache-Key (Concept + Version + Kontakt/Firmen-Fakten)
CREATE OR REPLACE FUNCTION compute_academy_intel_hash(
  p_contact_id uuid,
  p_concept_slug text DEFAULT 'academy-of-stars',
  p_concept_version text DEFAULT 'v1'
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(
    p_concept_slug || ':' || p_concept_version || ':' ||
    coalesce(c.job_title,'') || ':' ||
    coalesce(co.id::text,'') || ':' ||
    coalesce(co.name,'') || ':' ||
    coalesce(co.website,'') || ':' ||
    coalesce(co.industry,'')
  )
  FROM contacts c
  LEFT JOIN LATERAL (
    SELECT co.* FROM company_contacts cc
    JOIN companies co ON co.id = cc.company_id
    WHERE cc.contact_id = c.id
    ORDER BY (cc.relationship_type = 'main_contact') DESC
    LIMIT 1
  ) co ON true
  WHERE c.id = p_contact_id;
$$;

-- Context-RPC: liefert n8n in einem Call alle Fakten + Cache-Hit-Check
CREATE OR REPLACE FUNCTION get_academy_intel_context(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_result jsonb;
BEGIN
  v_hash := compute_academy_intel_hash(p_contact_id);

  SELECT jsonb_build_object(
    'contact_id', c.id,
    'full_name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
    'job_title', c.job_title,
    'company_id', co.id,
    'company_name', co.name,
    'website', co.website,
    'industry', co.industry,
    'lead_score', c.lead_score,
    'concept_hash', v_hash,
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
  LEFT JOIN academy_intel ai ON ai.contact_id = c.id AND ai.concept_slug = 'academy-of-stars' AND ai.concept_hash = v_hash
  WHERE c.id = p_contact_id;

  RETURN v_result;
END;
$$;

-- Upsert-RPC: einziger Schreibweg für n8n (kein direktes REST-Insert auf die Tabelle)
CREATE OR REPLACE FUNCTION upsert_academy_intel(
  p_contact_id uuid,
  p_concept_hash text,
  p_status text,
  p_intel jsonb DEFAULT NULL,
  p_fit_score integer DEFAULT NULL,
  p_entity_gate jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO academy_intel (contact_id, concept_slug, concept_hash, status, intel, fit_score, entity_gate, error_message, generated_at)
  VALUES (p_contact_id, 'academy-of-stars', p_concept_hash, p_status, p_intel, p_fit_score, p_entity_gate, p_error_message,
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
$$;

-- Grants: Context-RPC für Frontend (authenticated), Upsert NUR für n8n (service_role)
GRANT EXECUTE ON FUNCTION get_academy_intel_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_academy_intel_hash(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION upsert_academy_intel(uuid, text, text, jsonb, integer, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_academy_intel(uuid, text, text, jsonb, integer, jsonb, text) TO service_role;

-- Backfill: 6 Hand-Dossiers aus Hack #1 migrieren (concept_hash='manual-seed-v1', ungleich echtem Hash -> wird beim nächsten CTA-Klick durch echte Recherche ersetzt)
INSERT INTO academy_intel (contact_id, concept_slug, concept_version, concept_hash, status, intel, fit_score, generated_at)
SELECT
  id,
  'academy-of-stars',
  'v1',
  'manual-seed-v1',
  'generated',
  academy_research::jsonb || jsonb_build_object('source','manual_seed'),
  (academy_research::jsonb->>'fit_score')::integer,
  now()
FROM contacts
WHERE academy_research IS NOT NULL
ON CONFLICT (contact_id, concept_slug, concept_hash) DO NOTHING;
