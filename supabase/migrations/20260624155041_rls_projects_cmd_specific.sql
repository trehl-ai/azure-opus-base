DROP POLICY IF EXISTS all_auth ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated USING (is_admin());
