
CREATE TABLE public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_by_user_id uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read workspace_settings"
  ON public.workspace_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can write workspace_settings"
  ON public.workspace_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.workspace_settings (key, value) VALUES
  ('workspace_name', 'Mein CRM'),
  ('default_currency', 'EUR'),
  ('date_format', 'DD.MM.YYYY'),
  ('timezone', 'Europe/Berlin'),
  ('default_deal_pipeline_id', ''),
  ('default_deal_owner_id', '')
ON CONFLICT (key) DO NOTHING;
