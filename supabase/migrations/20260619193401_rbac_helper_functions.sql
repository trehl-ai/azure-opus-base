-- Zentrale Rollen-Prüffunktionen. Basieren auf get_user_role(auth.uid()).
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT get_user_role(auth.uid()) = 'admin'; $$;

CREATE OR REPLACE FUNCTION is_management_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT get_user_role(auth.uid()) IN ('admin','management'); $$;

CREATE OR REPLACE FUNCTION can_write_deals()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT get_user_role(auth.uid()) IN ('admin','management','projektmanager'); $$;

CREATE OR REPLACE FUNCTION can_manage_all_tasks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT get_user_role(auth.uid()) IN ('admin','management'); $$;
