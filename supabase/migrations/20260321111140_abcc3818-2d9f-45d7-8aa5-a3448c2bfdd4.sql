-- ========== TAGS ==========
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366F1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on tags" ON public.tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== ENTITY_TAGS ==========
CREATE TABLE public.entity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact', 'deal', 'project', 'task')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tag_id, entity_type, entity_id)
);

ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on entity_tags" ON public.entity_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_entity_tags_type_id ON public.entity_tags (entity_type, entity_id);

-- ========== IMPORT_JOBS ==========
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL CHECK (import_type IN ('companies', 'contacts', 'mixed')),
  file_name TEXT NOT NULL,
  started_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'mapping', 'processing', 'completed', 'failed')),
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on import_jobs" ON public.import_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== IMPORT_ROWS ==========
CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_payload_json JSONB,
  mapped_payload_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'duplicate')),
  error_message TEXT,
  created_entity_type TEXT,
  created_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on import_rows" ON public.import_rows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_import_rows_job_id ON public.import_rows (import_job_id);

-- ========== INTAKE_MESSAGES ==========
CREATE TABLE public.intake_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email TEXT,
  subject TEXT,
  raw_body TEXT,
  parsed_payload_json JSONB,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'parsed', 'review_required', 'approved', 'rejected', 'imported')),
  reviewed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on intake_messages" ON public.intake_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== ADDITIONAL INDEXES ==========
CREATE INDEX idx_deals_pipeline_stage ON public.deals (pipeline_id, pipeline_stage_id);
CREATE INDEX idx_deals_status ON public.deals (status);
CREATE INDEX idx_tasks_project_status ON public.tasks (project_id, status);
CREATE INDEX idx_companies_owner ON public.companies (owner_user_id);
CREATE INDEX idx_contacts_owner ON public.contacts (owner_user_id);