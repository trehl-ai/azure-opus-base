-- ============================================================
-- 1. Security definer function for role checks (avoids recursive RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = _user_id AND is_active = true
$$;

-- ============================================================
-- 2. Atomic RPC: set_deal_won_and_create_project
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_deal_won_and_create_project(
  p_deal_id uuid,
  p_winning_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  -- 1. Set deal to won (idempotent)
  UPDATE deals
    SET status = 'won',
        won_at = now(),
        updated_at = now()
    WHERE id = p_deal_id
      AND status != 'won';

  -- 2. Create project if none exists
  INSERT INTO projects (title, company_id, primary_contact_id, originating_deal_id,
                        status, priority, owner_user_id, description, created_by_user_id)
    SELECT
      'Projekt: ' || d.title,
      d.company_id,
      d.primary_contact_id,
      d.id,
      'new',
      COALESCE(d.priority, 'medium'),
      d.owner_user_id,
      'Automatisch erstellt aus Deal: ' || d.title,
      p_winning_user_id
    FROM deals d
    WHERE d.id = p_deal_id
      AND NOT EXISTS (
        SELECT 1 FROM projects p WHERE p.originating_deal_id = p_deal_id
      );

  -- 3. Return project id
  SELECT id INTO v_project_id FROM projects WHERE originating_deal_id = p_deal_id;
  RETURN v_project_id;
END;
$$;

-- ============================================================
-- 3. Atomic RPC: set_deal_lost
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_deal_lost(
  p_deal_id uuid,
  p_reason text,
  p_lost_stage_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE deals
    SET status = 'lost',
        lost_at = now(),
        lost_reason = p_reason,
        pipeline_stage_id = COALESCE(p_lost_stage_id, pipeline_stage_id),
        updated_at = now()
    WHERE id = p_deal_id
      AND status != 'lost';
END;
$$;

-- ============================================================
-- 4. Soft-delete columns
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- ============================================================
-- 5. Active views (exclude soft-deleted)
-- ============================================================
CREATE OR REPLACE VIEW active_companies AS SELECT * FROM companies WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_contacts AS SELECT * FROM contacts WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_deals AS SELECT * FROM deals WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_projects AS SELECT * FROM projects WHERE deleted_at IS NULL;

-- ============================================================
-- 6. Database constraints
-- ============================================================
-- Unique default pipeline
CREATE UNIQUE INDEX IF NOT EXISTS unique_default_pipeline
  ON pipelines (is_default) WHERE is_default = true;

-- Unique won/lost stages per pipeline
CREATE UNIQUE INDEX IF NOT EXISTS unique_won_stage_per_pipeline
  ON pipeline_stages (pipeline_id) WHERE is_won_stage = true;

CREATE UNIQUE INDEX IF NOT EXISTS unique_lost_stage_per_pipeline
  ON pipeline_stages (pipeline_id) WHERE is_lost_stage = true;

-- Deal value non-negative
DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT deals_value_non_negative CHECK (value_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Deal probability range
DO $$ BEGIN
  ALTER TABLE deals ADD CONSTRAINT deals_probability_range CHECK (probability_percent >= 0 AND probability_percent <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Stage probability range
DO $$ BEGIN
  ALTER TABLE pipeline_stages ADD CONSTRAINT stages_probability_range CHECK (probability_percent >= 0 AND probability_percent <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Task date order
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_date_order CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Project date order
DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT projects_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 7. Replace permissive RLS with structured policies
-- ============================================================

-- Drop ALL existing permissive policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---- COMPANIES ----
CREATE POLICY "companies_select" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "companies_update" ON companies FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "companies_delete" ON companies FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- CONTACTS ----
CREATE POLICY "contacts_select" ON contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "contacts_update" ON contacts FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "contacts_delete" ON contacts FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- DEALS ----
CREATE POLICY "deals_select" ON deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "deals_insert" ON deals FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "deals_update" ON deals FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "deals_delete" ON deals FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- PROJECTS ----
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','project_manager'));
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','project_manager'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','project_manager'));
CREATE POLICY "projects_delete" ON projects FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- TASKS ----
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','project_manager'));

-- ---- USERS ----
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_admin" ON users FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- WORKSPACE_SETTINGS ----
CREATE POLICY "ws_select" ON workspace_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_insert" ON workspace_settings FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "ws_update" ON workspace_settings FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- ---- PIPELINES ----
CREATE POLICY "pipelines_select" ON pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "pipelines_insert" ON pipelines FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "pipelines_update" ON pipelines FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "pipelines_delete" ON pipelines FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- PIPELINE_STAGES ----
CREATE POLICY "stages_select" ON pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "stages_insert" ON pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "stages_update" ON pipeline_stages FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin')
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "stages_delete" ON pipeline_stages FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- TAGS ----
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ---- ENTITY_TAGS ----
CREATE POLICY "entity_tags_select" ON entity_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "entity_tags_insert" ON entity_tags FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));
CREATE POLICY "entity_tags_update" ON entity_tags FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));
CREATE POLICY "entity_tags_delete" ON entity_tags FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));

-- ---- DEAL_ACTIVITIES ----
CREATE POLICY "activities_select" ON deal_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "activities_insert" ON deal_activities FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "activities_update" ON deal_activities FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "activities_delete" ON deal_activities FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'));

-- ---- TASK_COMMENTS ----
CREATE POLICY "comments_select" ON task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON task_comments FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));
CREATE POLICY "comments_update" ON task_comments FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));
CREATE POLICY "comments_delete" ON task_comments FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales','project_manager'));

-- ---- COMPANY_CONTACTS ----
CREATE POLICY "cc_select" ON company_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_insert" ON company_contacts FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "cc_update" ON company_contacts FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "cc_delete" ON company_contacts FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'));

-- ---- IMPORT_JOBS ----
CREATE POLICY "ij_select" ON import_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ij_insert" ON import_jobs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "ij_update" ON import_jobs FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));

-- ---- IMPORT_ROWS ----
CREATE POLICY "ir_select" ON import_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "ir_insert" ON import_rows FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "ir_update" ON import_rows FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));

-- ---- INTAKE_MESSAGES ----
CREATE POLICY "im_select" ON intake_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "im_insert" ON intake_messages FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));
CREATE POLICY "im_update" ON intake_messages FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin','sales'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin','sales'));