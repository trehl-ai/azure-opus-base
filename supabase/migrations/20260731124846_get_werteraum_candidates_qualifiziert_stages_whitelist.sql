-- Kandidatenfilter auf die vier Warteschlangen-Stages umstellen.
-- Neue Logik: Deals bleiben bis zum Versand in einer versteckten "Qualifiziert — <Land>"-Stage
-- und werden erst durch den Versand sichtbar (Mailing erhalten). "Identifiziert" wird dadurch
-- zur leeren Durchgangsstufe.
-- POSITIVLISTE, keine Negativfilterung: "Gewonnen" und "Verloren" enthalten je 14 Kontakte mit
-- outreach_status='pending' — ein Negativfilter wuerde die anmailen.
CREATE OR REPLACE FUNCTION public.get_werteraum_candidates(p_limit integer DEFAULT 30, p_bundesland text DEFAULT NULL::text)
 RETURNS TABLE(contact_id uuid, first_name text, last_name text, anrede text, email text, company_name text, outreach_hook text, outreach_email_draft text, outreach_cluster text, outreach_score integer, deal_id uuid, bundesland text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cand AS (
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
      AND d.pipeline_stage_id IN (
        'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid,  -- Identifiziert (Uebergang, sollte leer bleiben)
        '616dd027-993c-4875-bca7-0f5cc436a38b'::uuid,  -- Qualifiziert — NRW
        'd1f00bca-fcdd-4a55-a373-9c06e0544f05'::uuid,  -- Qualifiziert — Niedersachsen
        '21c7ad65-0905-41cf-846a-9fc276545cc9'::uuid,  -- Qualifiziert — BW
        '996ba733-5d04-44df-950a-f7e8af6245de'::uuid   -- Qualifiziert — RLP
      )
      AND (p_bundesland IS NULL OR c.bundesland = p_bundesland)
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities da
        WHERE da.deal_id = d.id
          AND da.activity_type = 'email'
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
    SELECT DISTINCT ON (lower(email)) *
    FROM valid
    ORDER BY lower(email), outreach_score DESC NULLS LAST, contact_id
  ),
  ranked AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY lower(split_part(email,'@',2))
        ORDER BY outreach_score DESC NULLS LAST, contact_id
      ) AS domain_rn
    FROM dedup_email
  )
  SELECT contact_id, first_name, last_name, anrede, email, company_name,
         outreach_hook, outreach_email_draft, outreach_cluster, outreach_score, deal_id, bundesland
  FROM ranked
  WHERE domain_rn <= 2
  ORDER BY outreach_score DESC NULLS LAST, contact_id
  LIMIT p_limit;
$function$;