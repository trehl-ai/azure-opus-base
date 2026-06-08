-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_linkedin_url_unique
  ON contacts (linkedin_url)
  WHERE linkedin_url IS NOT NULL AND deleted_at IS NULL;
