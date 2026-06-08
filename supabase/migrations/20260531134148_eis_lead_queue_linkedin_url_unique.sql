-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


-- Erst Duplikate bereinigen (behalte jeweils ältesten Eintrag)
DELETE FROM eis_lead_queue a
USING eis_lead_queue b
WHERE a.id > b.id
  AND a.linkedin_url = b.linkedin_url
  AND a.linkedin_url IS NOT NULL;

-- Unique Constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_eis_lead_queue_linkedin_url_unique
  ON eis_lead_queue (linkedin_url)
  WHERE linkedin_url IS NOT NULL;
