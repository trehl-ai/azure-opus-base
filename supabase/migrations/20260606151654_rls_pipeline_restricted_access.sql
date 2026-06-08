-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


-- Helper Function: Gibt true zurück wenn User KEINEN Restriction-Eintrag hat
-- ODER wenn die Pipeline in seiner Whitelist ist
CREATE OR REPLACE FUNCTION user_can_access_pipeline(p_pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    -- Kein Restriction-Eintrag für diesen User → voller Zugriff
    NOT EXISTS (
      SELECT 1 FROM user_pipeline_restrictions 
      WHERE user_id = auth.uid()
    )
    OR
    -- User hat Restriction, aber diese Pipeline ist freigegeben
    EXISTS (
      SELECT 1 FROM user_pipeline_restrictions 
      WHERE user_id = auth.uid() AND pipeline_id = p_pipeline_id
    );
$$;

-- DEALS: alten Policy droppen, neuen setzen
DROP POLICY IF EXISTS "all_auth" ON deals;
CREATE POLICY "pipeline_restricted_access" ON deals
  FOR ALL TO authenticated
  USING (user_can_access_pipeline(pipeline_id));

-- PIPELINE_STAGES: Umut muss Stages seiner Pipeline sehen
DROP POLICY IF EXISTS "all_auth" ON pipeline_stages;
CREATE POLICY "pipeline_restricted_access" ON pipeline_stages
  FOR ALL TO authenticated
  USING (user_can_access_pipeline(pipeline_id));

-- PIPELINES: Nur freigegebene Pipelines sehen
DROP POLICY IF EXISTS "all_auth" ON pipelines;
CREATE POLICY "pipeline_restricted_access" ON pipelines
  FOR ALL TO authenticated
  USING (user_can_access_pipeline(id));

-- DEAL_ACTIVITIES: Zugriff wenn zugehöriger Deal in erlaubter Pipeline
DROP POLICY IF EXISTS "all_auth" ON deal_activities;
CREATE POLICY "pipeline_restricted_access" ON deal_activities
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_activities.deal_id
      AND user_can_access_pipeline(d.pipeline_id)
    )
  );

-- CONTACTS + COMPANIES: bleiben offen — Umut muss Kontakte sehen/anrufen können
-- (Er sieht keine Deal-Details anderer Pipelines, aber Kontakte sind pipeline-agnostisch)
-- Keine Änderung an contacts/companies policies nötig
