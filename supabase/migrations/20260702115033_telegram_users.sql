CREATE TABLE IF NOT EXISTS public.telegram_users (
  telegram_user_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  first_name text, last_name text, username text,
  crm_user_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_users_read ON public.telegram_users FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.telegram_users TO authenticated, anon, service_role;
