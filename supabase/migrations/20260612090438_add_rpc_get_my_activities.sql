-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612090438 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

CREATE OR REPLACE FUNCTION public.get_my_activities()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
SELECT json_agg(row_to_json(t) ORDER BY t.due_date ASC NULLS LAST)
FROM (
  SELECT
    da.id,
    da.deal_id,
    da.contact_id,
    da.activity_type,
    da.title,
    da.description,
    da.mail_entwurf,
    da.due_date,
    da.status,
    da.completed_at,
    da.auto_generated,
    da.created_at,
    d.title AS deal_title,
    CONCAT(c.first_name, ' ', c.last_name) AS contact_name,
    c.email AS contact_email,
    c.phone AS contact_phone
  FROM deal_activities da
  LEFT JOIN deals d ON d.id = da.deal_id AND d.deleted_at IS NULL
  LEFT JOIN contacts c ON c.id = da.contact_id AND c.deleted_at IS NULL
  WHERE da.deleted_at IS NULL
    AND da.status != 'completed'
    AND da.activity_type NOT IN ('note')
    AND (
      da.owner_user_id = auth.uid()
      OR da.created_by_user_id = auth.uid()
      OR d.owner_user_id = auth.uid()
    )
) t;
$function$;
