-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612091753 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

CREATE OR REPLACE FUNCTION public.get_erneutes_mailing_context(p_deal_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT json_build_object(
  'deal_id',      d.id,
  'deal_title',   d.title,
  'contact_id',   c.id,
  'contact_name', CONCAT(c.first_name, ' ', c.last_name),
  'contact_email', c.email,
  'email_draft',  c.outreach_email_draft,
  'na_notiz', (
    SELECT da.description
    FROM deal_activities da
    WHERE da.deal_id = d.id
      AND da.activity_type = 'note'
      AND (
        da.description ILIKE 'NA:%'
        OR da.description ILIKE 'UA:%'
      )
      AND da.deleted_at IS NULL
    ORDER BY da.created_at DESC
    LIMIT 1
  )
)
FROM deals d
JOIN contacts c ON c.id = d.primary_contact_id
WHERE d.id = p_deal_id
  AND d.deleted_at IS NULL;
$function$;
