-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-11.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.

ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'offen';
UPDATE tasks SET status = 'offen' WHERE status = 'open';
