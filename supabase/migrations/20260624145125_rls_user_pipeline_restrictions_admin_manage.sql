CREATE POLICY upr_admin_select ON public.user_pipeline_restrictions FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY upr_admin_insert ON public.user_pipeline_restrictions FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY upr_admin_update ON public.user_pipeline_restrictions FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY upr_admin_delete ON public.user_pipeline_restrictions FOR DELETE TO authenticated USING (is_admin());
