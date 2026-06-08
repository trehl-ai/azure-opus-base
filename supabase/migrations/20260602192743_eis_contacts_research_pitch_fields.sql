-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS company_csr_strategy text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS company_current_campaigns text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS person_public_statements text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS outreach_hook text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS outreach_timing text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS last_research_at timestamptz;
