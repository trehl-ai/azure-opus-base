-- Profile + email-signature columns on public.users.
-- Frontend (SignatureSettings page) reads/writes these per logged-in user.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url             text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signature_image_url    text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title              text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone                  text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address                text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS website                text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linkedin_url           text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS twitter_url            text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_url           text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signature_full_name    text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signature_active       boolean NOT NULL DEFAULT true;
