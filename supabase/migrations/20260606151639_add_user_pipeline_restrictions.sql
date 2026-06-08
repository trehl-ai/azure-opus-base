-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


-- Whitelist-Tabelle: Kein Eintrag = voller Zugriff, Eintrag = nur diese Pipelines
CREATE TABLE IF NOT EXISTS user_pipeline_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, pipeline_id)
);

ALTER TABLE user_pipeline_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON user_pipeline_restrictions
  FOR ALL TO service_role USING (true);

-- Admins können die Tabelle lesen (für UI)
CREATE POLICY "auth_read" ON user_pipeline_restrictions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
