-- ========== PIPELINES ==========
CREATE TABLE public.pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on pipelines" ON public.pipelines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== PIPELINE_STAGES ==========
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  stage_type TEXT NOT NULL DEFAULT 'open' CHECK (stage_type IN ('open', 'won', 'lost')),
  probability_percent INTEGER DEFAULT 0,
  is_won_stage BOOLEAN DEFAULT false,
  is_lost_stage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, position)
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on pipeline_stages" ON public.pipeline_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== DEALS ==========
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  primary_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id),
  pipeline_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  value_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  expected_close_date DATE,
  probability_percent INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  source TEXT,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  description TEXT,
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on deals" ON public.deals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== DEAL_ACTIVITIES ==========
CREATE TABLE public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'follow_up', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access on deal_activities" ON public.deal_activities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_deal_activities_updated_at
  BEFORE UPDATE ON public.deal_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== SEED: Standard-Pipeline ==========
DO $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  INSERT INTO public.pipelines (name, is_default)
  VALUES ('Standard-Pipeline', true)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages (pipeline_id, name, position, stage_type, probability_percent, is_won_stage, is_lost_stage)
  VALUES
    (v_pipeline_id, 'Lead', 1, 'open', 10, false, false),
    (v_pipeline_id, 'Qualifiziert', 2, 'open', 25, false, false),
    (v_pipeline_id, 'Erstgespräch', 3, 'open', 40, false, false),
    (v_pipeline_id, 'Angebot', 4, 'open', 60, false, false),
    (v_pipeline_id, 'Verhandlung', 5, 'open', 80, false, false),
    (v_pipeline_id, 'Won', 6, 'won', 100, true, false),
    (v_pipeline_id, 'Lost', 7, 'lost', 0, false, true);
END;
$$;