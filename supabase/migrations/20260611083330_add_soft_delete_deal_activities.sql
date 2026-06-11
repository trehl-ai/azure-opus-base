-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-11.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

ALTER TABLE deal_activities ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
