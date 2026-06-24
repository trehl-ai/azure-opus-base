-- SELECT-Sichtbarkeits-Test pro User. SECURITY DEFINER, setzt intern jwt.claims + role.
-- Gibt sichtbare Zeilenzahlen pro Tabelle zurück. Non-destruktiv (nur SELECT).
CREATE OR REPLACE FUNCTION rbac_smoke_select(p_auth_uid uuid)
RETURNS TABLE(tabelle text, sichtbare_zeilen bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_auth_uid::text, 'role','authenticated')::text, true);
  PERFORM set_config('role','authenticated', true);

  RETURN QUERY SELECT 'pipelines'::text, count(*)::bigint FROM pipelines;
  RETURN QUERY SELECT 'deals'::text, count(*)::bigint FROM deals;
  RETURN QUERY SELECT 'deal_activities'::text, count(*)::bigint FROM deal_activities;
  RETURN QUERY SELECT 'companies'::text, count(*)::bigint FROM companies;
  RETURN QUERY SELECT 'contacts'::text, count(*)::bigint FROM contacts;
  RETURN QUERY SELECT 'tasks'::text, count(*)::bigint FROM tasks;

  PERFORM set_config('role','service_role', true);
END;
$$;
