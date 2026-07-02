DROP FUNCTION IF EXISTS public.get_werteraum_hook_targets(integer);

CREATE FUNCTION public.get_werteraum_hook_targets(p_limit integer DEFAULT 300)
RETURNS TABLE(
  contact_id uuid,
  anrede text,
  first_name text,
  last_name text,
  rektor_name text,
  schulname text,
  bundesland text,
  raw_impressum text,
  werte_projekt text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (c.id)
    c.id AS contact_id,
    c.anrede,
    c.first_name,
    c.last_name,
    q.rektor_name,
    co.name AS schulname,
    c.bundesland,
    q.raw_impressum,
    q.werte_projekt
  FROM contacts c
    JOIN company_contacts cc ON cc.contact_id = c.id
    JOIN companies co ON co.id = cc.company_id
    JOIN deals d ON d.company_id = co.id
    JOIN pipelines p ON p.id = d.pipeline_id
    LEFT JOIN werteraum_school_queue q ON q.contact_id = c.id
  WHERE p.name ILIKE '%werteraum%'
    AND d.deleted_at IS NULL
    AND c.outreach_status = 'pending'
    AND c.outreach_cluster IS NOT NULL
    AND d.pipeline_stage_id = 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid
    AND c.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
    AND btrim(coalesce(c.outreach_hook,'')) = ''
    AND btrim(coalesce(q.raw_impressum,'')) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM deal_activities da
      WHERE da.deal_id = d.id AND da.activity_type = 'email'
    )
  ORDER BY c.id, d.id
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.get_werteraum_hook_targets(integer) TO authenticated, service_role;
