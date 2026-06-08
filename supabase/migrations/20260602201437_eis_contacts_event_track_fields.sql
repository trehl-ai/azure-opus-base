-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


ALTER TABLE eis_contacts
  ADD COLUMN IF NOT EXISTS deal_type text DEFAULT 'sponsor' CHECK (deal_type IN ('sponsor','event','both')),
  ADD COLUMN IF NOT EXISTS personal_insights text,
  ADD COLUMN IF NOT EXISTS network_signals text,
  ADD COLUMN IF NOT EXISTS event_opportunities text,
  ADD COLUMN IF NOT EXISTS event_pitch_text text;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS deal_type text DEFAULT 'sponsor',
  ADD COLUMN IF NOT EXISTS personal_insights text,
  ADD COLUMN IF NOT EXISTS network_signals text,
  ADD COLUMN IF NOT EXISTS event_opportunities text,
  ADD COLUMN IF NOT EXISTS event_pitch_text text;
