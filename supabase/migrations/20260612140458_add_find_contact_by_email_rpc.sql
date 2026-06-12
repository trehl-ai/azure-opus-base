-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612140458 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

CREATE OR REPLACE FUNCTION public.find_contact_by_email(p_email text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT json_build_object(
  'contact_id', c.id,
  'first_name', c.first_name,
  'last_name', c.last_name,
  'email', c.email,
  'deal_id', d.id,
  'deal_title', d.title,
  'pipeline_stage_id', d.pipeline_stage_id,
  'pipeline_id', d.pipeline_id
)
FROM contacts c
LEFT JOIN deals d ON d.primary_contact_id = c.id
  AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
  AND d.deleted_at IS NULL
  AND d.status = 'open'
WHERE LOWER(c.email) = LOWER(p_email)
  AND c.deleted_at IS NULL
LIMIT 1;
$function$;
