DROP POLICY IF EXISTS anon_insert ON public.werteraum_resources;
DROP POLICY IF EXISTS anon_update ON public.werteraum_resources;
DROP POLICY IF EXISTS anon_delete ON public.werteraum_resources;
CREATE POLICY werteraum_resources_admin_insert ON public.werteraum_resources FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY werteraum_resources_admin_update ON public.werteraum_resources FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY werteraum_resources_admin_delete ON public.werteraum_resources FOR DELETE TO authenticated USING (is_admin());
