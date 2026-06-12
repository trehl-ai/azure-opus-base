-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612073542 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

-- Positionen 6-10 hochschieben
UPDATE pipeline_stages SET position = position + 1
WHERE pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
AND position >= 6;

-- Neue Stage einfügen
INSERT INTO pipeline_stages (pipeline_id, name, position)
VALUES ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e', 'Erneutes Mailing', 6);
