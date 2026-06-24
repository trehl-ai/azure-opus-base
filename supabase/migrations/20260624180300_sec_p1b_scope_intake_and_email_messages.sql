-- intake_messages: all_auth (zu breit) -> admin/sales (spiegelt Route-Guard requiredRoles=[admin,sales])
DROP POLICY IF EXISTS all_auth ON public.intake_messages;
CREATE POLICY intake_select ON public.intake_messages FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY intake_insert ON public.intake_messages FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY intake_update ON public.intake_messages FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY intake_delete ON public.intake_messages FOR DELETE TO authenticated
  USING (is_admin());

-- user_email_messages: self-scoped (Frontend INSERT...returning + eigener Read); service_role-Policy bleibt
CREATE POLICY user_email_messages_insert ON public.user_email_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_email_messages_select ON public.user_email_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());
