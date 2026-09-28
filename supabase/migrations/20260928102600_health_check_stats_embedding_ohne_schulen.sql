-- 28.09.2026: get_enrichment_batch() schliesst Kontakte mit Tag 'Schule' bewusst aus (Embeddings dienen der Sponsor-/EIS-Suche,
-- match_contacts). get_health_check_stats() zaehlte sie trotzdem als "ohne Embedding" -> 5 manual-Schulkontakte lagen seit 25.09.
-- in der Queue und wurden nie abgeholt, der Health Check meldete sie taeglich. Gleiche Ausschlussregel wie im Worker.
CREATE OR REPLACE FUNCTION public.get_health_check_stats()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'intake_stau',           (SELECT count(*) FROM public.intake_messages WHERE parsed_payload_json IS NULL AND created_at < now() - interval '24 hours' AND status != 'archived'),
    'intake_null_payload',   (SELECT count(*) FROM public.intake_messages WHERE parsed_payload_json IS NULL AND created_at >= now() - interval '24 hours'),
    'contacts_unscored',     (SELECT count(*) FROM public.contacts WHERE lead_score IS NULL AND deleted_at IS NULL AND created_at < now() - interval '24 hours' AND NOT ('Schule' = ANY(COALESCE(tags, '{}'::text[])))),
    'contacts_no_embedding', (SELECT count(*) FROM public.contacts WHERE embedding IS NULL AND deleted_at IS NULL AND created_at < now() - interval '24 hours' AND NOT ('Schule' = ANY(COALESCE(tags, '{}'::text[])))),
    'deals_no_stage',        (SELECT count(*) FROM public.deals WHERE pipeline_stage_id IS NULL AND deleted_at IS NULL),
    'deals_open',            (SELECT count(*) FROM public.deals WHERE status = 'open' AND deleted_at IS NULL),
    'contacts_total',        (SELECT count(*) FROM public.contacts WHERE deleted_at IS NULL),
    'activities_7d',         (SELECT count(*) FROM public.deal_activities WHERE created_at >= now() - interval '7 days' AND deleted_at IS NULL)
  );
$function$;