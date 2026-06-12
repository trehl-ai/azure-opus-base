-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612150212 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

CREATE OR REPLACE FUNCTION public.find_contact_by_email_vr(p_email text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  AND d.pipeline_id = '341c067d-39fe-46ae-82c7-33d6c55a2a60'
  AND d.deleted_at IS NULL
  AND d.status = 'open'
WHERE LOWER(c.email) = LOWER(p_email)
  AND c.deleted_at IS NULL
LIMIT 1;
$$;
