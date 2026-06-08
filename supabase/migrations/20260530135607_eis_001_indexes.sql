-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE INDEX IF NOT EXISTS idx_eis_lead_queue_score
  ON eis_lead_queue (final_score DESC) WHERE score_verified = true AND abgeholt = false;

CREATE INDEX IF NOT EXISTS idx_eis_lead_queue_linkedin
  ON eis_lead_queue (linkedin_url) WHERE linkedin_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eis_lead_queue_import_batch
  ON eis_lead_queue (import_batch);

CREATE INDEX IF NOT EXISTS idx_eis_contacts_outreach_status
  ON eis_contacts (outreach_status);

CREATE INDEX IF NOT EXISTS idx_eis_contacts_linkedin
  ON eis_contacts (linkedin_url) WHERE linkedin_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eis_contacts_lead_tier
  ON eis_contacts (lead_tier);

CREATE INDEX IF NOT EXISTS idx_eis_activities_contact_id
  ON eis_activities (contact_id, created_at DESC);
