-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS deal_type text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS personal_insights text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS network_signals text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS event_opportunities text;
ALTER TABLE eis_contacts ADD COLUMN IF NOT EXISTS event_pitch_text text;
