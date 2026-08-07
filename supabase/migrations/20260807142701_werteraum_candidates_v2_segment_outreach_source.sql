ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS is_outreach_source boolean NOT NULL DEFAULT false;

UPDATE public.pipeline_stages SET is_outreach_source = true
WHERE pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
  AND (name = 'Identifiziert' OR name LIKE 'Qualifiziert%');

DROP FUNCTION IF EXISTS public.get_werteraum_candidates(integer, text);

CREATE OR REPLACE FUNCTION public.get_werteraum_candidates(
  p_limit integer DEFAULT 30,
  p_bundesland text DEFAULT NULL,
  p_segment text DEFAULT 'grundschule',
  p_domain_cap integer DEFAULT 10
)
RETURNS TABLE(contact_id uuid, first_name text, last_name text, anrede text,
              anrede_final text, email text, company_name text, outreach_hook text,
              outreach_email_draft text, outreach_cluster text, outreach_score integer,
              deal_id uuid, bundesland text, segment text)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH cand AS (
    SELECT DISTINCT ON (c.id)
      c.id AS contact_id, c.first_name, c.last_name, c.anrede,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          OR btrim(c.last_name) ILIKE 'schulleitung'
          THEN 'Liebes Team der ' || co.name
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final,
      c.email, co.name AS company_name, c.outreach_hook, c.outreach_email_draft,
      c.outreach_cluster, c.lead_score AS outreach_score, d.id AS deal_id,
      c.bundesland, d.segment
    FROM contacts c
      JOIN company_contacts cc ON cc.contact_id = c.id
      JOIN companies co ON co.id = cc.company_id
      JOIN deals d ON d.company_id = co.id
      JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    WHERE d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
      AND ps.is_outreach_source
      AND d.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND c.outreach_status = 'pending'
      AND (p_segment IS NULL OR d.segment = p_segment)
      AND (p_bundesland IS NULL OR c.bundesland = p_bundesland)
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities da
        WHERE da.deal_id = d.id AND da.activity_type = 'email'
      )
    ORDER BY c.id, d.id
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
