DROP POLICY IF EXISTS pipeline_restricted_access ON public.deals;
CREATE POLICY deals_select ON public.deals FOR SELECT TO authenticated USING (user_can_access_pipeline(pipeline_id));
CREATE POLICY deals_insert ON public.deals FOR INSERT TO authenticated WITH CHECK (app_role() IN ('admin','management','projektmanager') AND user_can_access_pipeline(pipeline_id));
CREATE POLICY deals_update ON public.deals FOR UPDATE TO authenticated USING (user_can_access_pipeline(pipeline_id)) WITH CHECK (user_can_access_pipeline(pipeline_id));
CREATE POLICY deals_delete ON public.deals FOR DELETE TO authenticated USING (is_admin());
