-- Migration: 20260609095624_add_scheduled_mailings_table
-- Backfilled from supabase_migrations.schema_migrations on project ttgvhqygmgtnjgwunuwz.
-- Originally applied out-of-band via Supabase MCP apply_migration (2026-06-09);
-- recorded here so schema-drift-check CI reconciles repo vs live DB.


CREATE TABLE IF NOT EXISTS scheduled_mailings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id),
  mailing_type text NOT NULL DEFAULT '2nd_mailing',
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  lost_check_at timestamptz,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending','sent','cancelled','lost_set')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(deal_id, mailing_type)
);

ALTER TABLE scheduled_mailings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON scheduled_mailings
  FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read" ON scheduled_mailings
  FOR SELECT TO authenticated USING (true);

-- Index für täglichen Cron-Check
CREATE INDEX idx_scheduled_mailings_pending 
  ON scheduled_mailings(scheduled_at) 
  WHERE status = 'pending';
