ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz DEFAULT NULL;