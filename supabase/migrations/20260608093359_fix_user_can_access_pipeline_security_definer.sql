-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE OR REPLACE FUNCTION user_can_access_pipeline(p_pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 
    NOT EXISTS (
      SELECT 1 FROM user_pipeline_restrictions 
      WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_pipeline_restrictions 
      WHERE user_id = auth.uid() AND pipeline_id = p_pipeline_id
    );
$$;
