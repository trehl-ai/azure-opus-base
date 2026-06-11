-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-11.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

ALTER POLICY pipeline_restricted_access ON deal_activities
USING (
  EXISTS (
    SELECT 1 FROM deals d
    WHERE d.id = deal_activities.deal_id
    AND user_can_access_pipeline(d.pipeline_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deals d
    WHERE d.id = deal_activities.deal_id
    AND user_can_access_pipeline(d.pipeline_id)
  )
);
