
-- Create signature-images storage bucket (public for email rendering)
INSERT INTO storage.buckets (id, name, public) VALUES ('signature-images', 'signature-images', true);

-- Storage policies for signature-images
CREATE POLICY "sig_img_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signature-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sig_img_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signature-images');

CREATE POLICY "sig_img_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signature-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "sig_img_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signature-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anonymous/public read for signature images (needed in email clients)
CREATE POLICY "sig_img_public_select" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'signature-images');

-- Create user_email_signatures table
CREATE TABLE public.user_email_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL DEFAULT '',
  job_title text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  website text DEFAULT '',
  profile_image_path text DEFAULT NULL,
  linkedin_url text DEFAULT '',
  twitter_url text DEFAULT '',
  whatsapp_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_email_signatures ENABLE ROW LEVEL SECURITY;

-- Users can view their own signature
CREATE POLICY "ues_select" ON public.user_email_signatures FOR SELECT TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

-- Users can insert their own signature
CREATE POLICY "ues_insert" ON public.user_email_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

-- Users can update their own signature
CREATE POLICY "ues_update" ON public.user_email_signatures FOR UPDATE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()))
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

-- Users can delete their own signature
CREATE POLICY "ues_delete" ON public.user_email_signatures FOR DELETE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));
