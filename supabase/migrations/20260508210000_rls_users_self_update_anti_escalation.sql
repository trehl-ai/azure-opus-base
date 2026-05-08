-- Lets authenticated users update (and bootstrap-insert) their OWN
-- public.users row, while keeping role/is_active/email as admin-only fields.
--
-- Why: the previous UPDATE policy was admin-only, which made the email-
-- signature settings page (and any future profile editor) silently 400
-- for every non-admin — and even broke for admins whenever auth.uid()
-- did not resolve to a public.users row (OAuth-login bootstrap path).

-- 1. Drop legacy/named policies if they happen to exist on this DB
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "admins_can_update_users" ON public.users;

-- 2. New UPDATE policy: self OR admin
CREATE POLICY "users_self_or_admin_update" ON public.users
FOR UPDATE USING (
  id = auth.uid() OR get_user_role(auth.uid()) = 'admin'
)
WITH CHECK (
  id = auth.uid() OR get_user_role(auth.uid()) = 'admin'
);

-- 3. Anti-escalation trigger: non-admins cannot mutate role/is_active/email
CREATE OR REPLACE FUNCTION public.protect_user_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF get_user_role(auth.uid()) != 'admin' THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.users;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_role_escalation();

-- 4. INSERT-policy for OAuth-login bootstrap (fetchOrCreateDbUser path)
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_self_insert" ON public.users
FOR INSERT WITH CHECK (id = auth.uid());

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
