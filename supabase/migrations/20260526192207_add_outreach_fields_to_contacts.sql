-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260526192207].statements[1]

-- Neue Outreach-Felder in contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS outreach_cluster      text,
  ADD COLUMN IF NOT EXISTS outreach_hook         text,
  ADD COLUMN IF NOT EXISTS outreach_email_draft  text,
  ADD COLUMN IF NOT EXISTS outreach_status       text DEFAULT 'pending';

-- Schneeball-Felder
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS schneeball_asked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS schneeball_testimonial_at  timestamptz,
  ADD COLUMN IF NOT EXISTS schneeball_referrals        jsonb DEFAULT '[]'::jsonb;

-- Webinar-Feld
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS webinar_invited_at    timestamptz,
  ADD COLUMN IF NOT EXISTS webinar_attended_at   timestamptz;

-- Indizes für schnelle Filterung
CREATE INDEX IF NOT EXISTS idx_contacts_outreach_cluster ON contacts (outreach_cluster);
CREATE INDEX IF NOT EXISTS idx_contacts_outreach_status  ON contacts (outreach_status);
