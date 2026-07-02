-- get_top_sponsoring_leads: deterministischer Sponsoring-Score, on-the-fly berechnet.
-- Signale: lead_score (0-100, 617 echte Werte) gewichtet 0.7,
--          academy_intel.fit_score (0-100, wo vorhanden) gewichtet 0.3.
-- Wo kein academy_fit vorhanden: lead_score allein (Gewicht 1.0 hochskaliert,
--   kein künstliches Runterziehen durch fehlendes Signal).
-- industry BEWUSST NICHT verdrahtet: companies.industry ist zu 99.9% leer
--   (1 von 1502 befüllt) -> tote Fläche. Erweiterungspunkt sobald befüllt.
CREATE OR REPLACE FUNCTION get_top_sponsoring_leads(p_limit int DEFAULT 20)
RETURNS TABLE(
  contact_id uuid,
  name text,
  unternehmen text,
  "position" text,
  lead_score int,
  academy_fit_score int,
  sponsoring_score int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH academy AS (
    SELECT DISTINCT ON (ai.contact_id) ai.contact_id, ai.fit_score
    FROM academy_intel ai
    WHERE ai.status = 'generated' AND ai.fit_score IS NOT NULL
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
  LEFT JOIN academy a ON a.contact_id = c.id
  WHERE c.lead_score IS NOT NULL AND c.lead_score > 0 AND c.deleted_at IS NULL
  ORDER BY sponsoring_score DESC NULLS LAST, c.last_name
  LIMIT p_limit;
$$;

-- Grant: admin + management + projektmanager. RLS-Gate erfolgt über die
-- Rollen-Prüfung im Frontend/RPC-Aufruf; hier authenticated-Grant, da die
-- Funktion selbst rollenneutral liest. Restriktion auf Rollen-Ebene wie bei
-- get_top_leads (dort ebenfalls authenticated-Grant + UI-Gate).
GRANT EXECUTE ON FUNCTION get_top_sponsoring_leads(int) TO authenticated;
