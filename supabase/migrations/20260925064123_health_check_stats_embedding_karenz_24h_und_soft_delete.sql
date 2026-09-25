-- 25.09.2026: contacts_no_embedding und contacts_unscored zaehlten alle Kontakte, auch soft-geloeschte und die um 08:00
-- frisch angelegten, die der Enrichment-Worker binnen 30 min einbettet. Der Health Check um 08:30 meldete deshalb an jedem
-- Versandtag "30 Contacts ohne Embedding" als FEHLER (24./25.09.), obwohl um 09:00 nur 5 Altkontakte uebrig waren.
-- Fix: nur nicht-geloeschte Kontakte, die seit mehr als 24 h ohne Embedding/Score sind. Ausgabeschluessel unveraendert.
CREATE OR REPLACE FUNCTION public.get_health_check_stats()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'intake_stau',           (SELECT count(*) FROM public.intake_messages WHERE parsed_payload_json IS NULL AND created_at < now() - interval '24 hours' AND status != 'archived'),
    'intake_null_payload',   (SELECT count(*) FROM public.intake_messages WHERE parsed_payload_json IS NULL AND created_at >= now() - interval '24 hours'),
    'contacts_unscored',     (SELECT count(*) FROM public.contacts WHERE lead_score IS NULL AND deleted_at IS NULL AND created_at < now() - interval '24 hours'),
    'contacts_no_embedding', (SELECT count(*) FROM public.contacts WHERE embedding IS NULL AND deleted_at IS NULL AND created_at < now() - interval '24 hours'),
    'deals_no_stage',        (SELECT count(*) FROM public.deals WHERE pipeline_stage_id IS NULL AND deleted_at IS NULL),
    'deals_open',            (SELECT count(*) FROM public.deals WHERE status = 'open' AND deleted_at IS NULL),
    'contacts_total',        (SELECT count(*) FROM public.contacts WHERE deleted_at IS NULL),
    'activities_7d',         (SELECT count(*) FROM public.deal_activities WHERE created_at >= now() - interval '7 days' AND deleted_at IS NULL)
  );
$function$;