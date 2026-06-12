-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260611162512 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

UPDATE eis_lead_queue SET abgeholt = false WHERE abgeholt = true;
