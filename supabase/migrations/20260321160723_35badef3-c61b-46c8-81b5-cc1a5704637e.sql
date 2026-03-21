
-- 1. email_accounts
CREATE TABLE public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('resend', 'gmail', 'outlook')),
  email_address text NOT NULL,
  display_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. email_messages
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('resend', 'gmail', 'outlook')),
  from_email text NOT NULL,
  to_email text[] NOT NULL DEFAULT '{}',
  cc_email text[] DEFAULT '{}',
  bcc_email text[] DEFAULT '{}',
  subject text,
  body_html text,
  body_text text,
  external_message_id text,
  external_thread_id text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'failed', 'received')),
  error_message text,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

-- 3. campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend', 'gmail', 'outlook')),
  sender_account_id uuid REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_accounts_user ON public.email_accounts(user_id);
CREATE INDEX idx_email_messages_user ON public.email_messages(user_id);
CREATE INDEX idx_email_messages_account ON public.email_messages(account_id);
CREATE INDEX idx_email_messages_thread ON public.email_messages(external_thread_id) WHERE external_thread_id IS NOT NULL;
CREATE INDEX idx_campaigns_user ON public.campaigns(user_id);
CREATE UNIQUE INDEX unique_default_email_account_per_user ON public.email_accounts(user_id) WHERE is_default = true;

-- RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- email_accounts policies
CREATE POLICY "Users can view own accounts" ON public.email_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own accounts" ON public.email_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own accounts" ON public.email_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own accounts" ON public.email_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- email_messages policies
CREATE POLICY "Users can view own messages" ON public.email_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own messages" ON public.email_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own messages" ON public.email_messages FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own messages" ON public.email_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

-- campaigns policies
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at triggers
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
