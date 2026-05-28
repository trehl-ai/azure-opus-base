-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260522100835].statements[1]
CREATE OR REPLACE FUNCTION public.get_health_check_stats()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'intake_stau',           (SELECT count(*) FROM public.intake_messages WHERE parsed_payload_json IS NULL AND created_at < now() - interval '24 hours' AND status != 'archived'),
    'intake_null_payload',   (SELECT count(*) FROM public.intake_messages WHERE parsed_payload_json IS NULL AND created_at >= now() - interval '24 hours'),
    'contacts_unscored',     (SELECT count(*) FROM public.contacts WHERE lead_score IS NULL),
    'contacts_no_embedding', (SELECT count(*) FROM public.contacts WHERE embedding IS NULL),
    'deals_no_stage',        (SELECT count(*) FROM public.deals WHERE pipeline_stage_id IS NULL AND deleted_at IS NULL),
    'deals_open',            (SELECT count(*) FROM public.deals WHERE status = 'open' AND deleted_at IS NULL),
    'contacts_total',        (SELECT count(*) FROM public.contacts),
    'activities_7d',         (SELECT count(*) FROM public.deal_activities WHERE created_at >= now() - interval '7 days')
  );
$function$;

NOTIFY pgrst, 'reload schema';
