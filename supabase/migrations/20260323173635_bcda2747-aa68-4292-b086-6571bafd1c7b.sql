
-- Create email-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false);

-- Create email_attachments table
CREATE TABLE public.email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id uuid REFERENCES public.email_messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_attachments_message ON public.email_attachments(email_message_id);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: users can view their own attachments
CREATE POLICY "ea_select" ON public.email_attachments FOR SELECT TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

-- RLS: users can insert their own attachments
CREATE POLICY "ea_insert" ON public.email_attachments FOR INSERT TO authenticated
  WITH CHECK (user_id = get_public_user_id(auth.uid()));

-- RLS: users can delete their own attachments
CREATE POLICY "ea_delete" ON public.email_attachments FOR DELETE TO authenticated
  USING (user_id = get_public_user_id(auth.uid()));

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "ea_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: users can read their own files
CREATE POLICY "ea_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: users can delete their own files
CREATE POLICY "ea_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'email-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
