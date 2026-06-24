DROP POLICY IF EXISTS tasks_all_auth ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (app_role() IN ('admin','management') OR assigned_user_id = auth.uid() OR created_by_user_id = auth.uid());
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated USING (app_role() IN ('admin','management') OR assigned_user_id = auth.uid() OR created_by_user_id = auth.uid()) WITH CHECK (app_role() IN ('admin','management') OR assigned_user_id = auth.uid() OR created_by_user_id = auth.uid());
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING (is_admin());
