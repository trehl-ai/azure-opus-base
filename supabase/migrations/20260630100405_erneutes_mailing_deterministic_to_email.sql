-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260630100405 — exact statements as recorded in the live DB (pg_get_functiondef). Already applied; present for repo/drift-check parity.
-- Adds deterministic to_email (COALESCE notiz_email, lower(contact_email)) + to_email_source.
-- Supersedes mislabeled 20260630121032 file — recorded version in ttgv is 20260630100405.
CREATE OR REPLACE FUNCTION public.get_erneutes_mailing_context(p_deal_id uuid)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ctx AS (
    SELECT
      d.id            AS deal_id,
      d.title         AS deal_title,
      c.id            AS contact_id,
      CONCAT(c.first_name,' ',c.last_name) AS contact_name,
      c.email         AS contact_email,
      c.outreach_email_draft AS email_draft,
      (SELECT da.description
         FROM deal_activities da
        WHERE da.deal_id = d.id
          AND da.activity_type = 'note'
          AND (da.description ILIKE 'NA:%' OR da.description ILIKE 'UA:%')
          AND da.deleted_at IS NULL
        ORDER BY da.created_at DESC
        LIMIT 1) AS na_notiz
    FROM deals d
    JOIN contacts c ON c.id = d.primary_contact_id
    WHERE d.id = p_deal_id AND d.deleted_at IS NULL
  ),
  parsed AS (
    SELECT *,
      lower((regexp_match(na_notiz,'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'))[1]) AS notiz_email
    FROM ctx
  )
  SELECT json_build_object(
    'deal_id',         deal_id,
    'deal_title',      deal_title,
    'contact_id',      contact_id,
    'contact_name',    contact_name,
    'contact_email',   contact_email,
    'email_draft',     email_draft,
    'na_notiz',        na_notiz,
    'to_email',        COALESCE(notiz_email, lower(contact_email)),
    'to_email_source', CASE WHEN notiz_email IS NOT NULL THEN 'notiz' ELSE 'kontakt' END
  )
  FROM parsed;
$function$;
