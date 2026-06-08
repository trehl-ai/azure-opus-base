-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS eis_contact_id uuid REFERENCES eis_contacts(id),
  ADD COLUMN IF NOT EXISTS research_dossier text,
  ADD COLUMN IF NOT EXISTS sponsor_match text,
  ADD COLUMN IF NOT EXISTS pitch_text text,
  ADD COLUMN IF NOT EXISTS company_csr_strategy text,
  ADD COLUMN IF NOT EXISTS company_current_campaigns text,
  ADD COLUMN IF NOT EXISTS outreach_timing text,
  ADD COLUMN IF NOT EXISTS eis_score integer,
  ADD COLUMN IF NOT EXISTS last_research_at timestamptz;
