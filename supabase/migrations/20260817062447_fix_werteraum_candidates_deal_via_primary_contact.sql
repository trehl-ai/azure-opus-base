-- FIX 17.08.2026: Deal-Aufloesung ueber deals.primary_contact_id statt ueber
-- contacts -> company_contacts -> companies -> deals.
-- Grund: companies sind ueber Bundeslaender hinweg namensdedupliziert
-- (446 Companies mit 973 Deals). Der alte Join hat via DISTINCT ON (c.id)
-- ORDER BY d.id die niedrigste Deal-UUID gewaehlt = falsche Schule.
-- Zusaetzlich: bereits_bemailt war company-weit und hat Geschwisterschulen
-- stillschweigend gesperrt (bis zu 527 Deals). Jetzt kontakt-/dealscharf.
-- Domain-Cap Default 10 -> 3 (Behoerden-Sammelpostfaecher).

CREATE OR REPLACE FUNCTION public.get_werteraum_candidates(
  p_limit integer DEFAULT 30,
  p_bundesland text DEFAULT NULL::text,
  p_segment text DEFAULT 'grundschule'::text,
  p_domain_cap integer DEFAULT 3
)
RETURNS TABLE(contact_id uuid, first_name text, last_name text, anrede text,
              anrede_final text, email text, company_name text, outreach_hook text,
              outreach_email_draft text, outreach_cluster text, outreach_score integer,
              deal_id uuid, bundesland text, segment text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH bereits_bemailt AS (
    -- Nur E-Mail-Adressen, die selbst schon angeschrieben wurden.
    SELECT DISTINCT lower(c2.email) AS mail
    FROM deal_activities da2
      JOIN contacts c2 ON c2.id = da2.contact_id
    WHERE da2.activity_type = 'email'
      AND da2.deleted_at IS NULL
      AND c2.email IS NOT NULL
  ),
  cand AS (
    SELECT DISTINCT ON (c.id)
      c.id AS contact_id, c.first_name, c.last_name, c.anrede,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          OR btrim(c.last_name) ILIKE 'schulleitung'
          THEN 'Liebes Team der ' || COALESCE(co.name, d.title)
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final,
      c.email, COALESCE(co.name, d.title) AS company_name, c.outreach_hook, c.outreach_email_draft,
      c.outreach_cluster, c.lead_score AS outreach_score, d.id AS deal_id,
      c.bundesland, d.segment
    FROM contacts c
      JOIN deals d ON d.primary_contact_id = c.id
      JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
      LEFT JOIN companies co ON co.id = d.company_id
    WHERE d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
      AND ps.is_outreach_source
      AND d.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND c.outreach_status = 'pending'
      AND (p_segment IS NULL OR d.segment = p_segment)
      AND (p_bundesland IS NULL OR c.bundesland = p_bundesland)
      AND lower(c.email) NOT IN (SELECT mail FROM bereits_bemailt)
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities da
        WHERE da.contact_id = c.id AND da.activity_type = 'email' AND da.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities da
        WHERE da.deal_id = d.id AND da.activity_type = 'email' AND da.deleted_at IS NULL
      )
    ORDER BY c.id, d.created_at, d.id
  ),
  valid AS (
    SELECT * FROM cand
    WHERE email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
      AND lower(email) <> 'email@adresse.de'
      AND lower(email) !~ '(muster|platzhalter|example|^test@|noreply|no-reply|dummy)'
  ),
  dedup_email AS (
    SELECT DISTINCT ON (lower(email)) * FROM valid
    ORDER BY lower(email), outreach_score DESC NULLS LAST, contact_id
  ),
  ranked AS (
    SELECT *, row_number() OVER (
      PARTITION BY lower(split_part(email,'@',2))
      ORDER BY outreach_score DESC NULLS LAST, contact_id
    ) AS domain_rn
    FROM dedup_email
  )
  SELECT contact_id, first_name, last_name, anrede, anrede_final, email, company_name,
         outreach_hook, outreach_email_draft, outreach_cluster, outreach_score,
         deal_id, bundesland, segment
  FROM ranked
  WHERE domain_rn <= p_domain_cap
  ORDER BY outreach_score DESC NULLS LAST, contact_id
  LIMIT p_limit;
$function$;