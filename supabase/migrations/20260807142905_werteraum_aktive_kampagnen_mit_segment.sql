DROP FUNCTION IF EXISTS public.get_werteraum_aktive_kampagnen();

CREATE OR REPLACE FUNCTION public.get_werteraum_aktive_kampagnen()
RETURNS TABLE(bundesland text, segment text, utm_campaign text, tages_limit integer, start_datum date)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select bundesland, segment, utm_campaign, tages_limit, start_datum
  from werteraum_kampagnen_plan
  where aktiv and start_datum <= current_date
    and (end_datum is null or end_datum >= current_date)
  order by start_datum, bundesland, segment;
$function$;
