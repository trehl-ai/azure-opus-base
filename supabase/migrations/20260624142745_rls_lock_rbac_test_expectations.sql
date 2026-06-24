ALTER TABLE public.rbac_test_expectations ENABLE ROW LEVEL SECURITY;
CREATE POLICY rbac_test_expectations_admin_only ON public.rbac_test_expectations FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
