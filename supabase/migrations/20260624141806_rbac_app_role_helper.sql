CREATE OR REPLACE FUNCTION public.app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$ SELECT get_user_role(auth.uid()); $fn$;
