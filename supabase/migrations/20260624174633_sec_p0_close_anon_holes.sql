ALTER TABLE public.werteraum_school_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsq_admin_read ON public.werteraum_school_queue FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Service role full access" ON public.intake_messages;
DROP POLICY IF EXISTS "Service role only" ON public.webhook_log;
