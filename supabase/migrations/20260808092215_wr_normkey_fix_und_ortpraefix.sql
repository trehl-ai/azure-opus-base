CREATE OR REPLACE FUNCTION public.wr_normkey(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT regexp_replace(
           replace(
             translate(
               lower(coalesce(p_name,'')),
               'äöüáàâãéèêëíìîïóòôõúùûñç',
               'aouaaaaeeeeiiiioooouuunc'
             ),
             'ß', 'ss'
           ),
           '[^a-z0-9]', '', 'g'
         );
$function$;
