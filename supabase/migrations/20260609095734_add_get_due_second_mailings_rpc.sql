-- Migration: 20260609095734_add_get_due_second_mailings_rpc
-- Backfilled from supabase_migrations.schema_migrations on project ttgvhqygmgtnjgwunuwz.
-- Originally applied out-of-band via Supabase MCP apply_migration (2026-06-09);
-- recorded here so schema-drift-check CI reconciles repo vs live DB.


-- RPC: holt fällige 2. Mailings für n8n
CREATE OR REPLACE FUNCTION get_due_second_mailings()
RETURNS TABLE (
  scheduled_mailing_id uuid,
  deal_id uuid,
  deal_title text,
  contact_id uuid,
  first_name text,
  last_name text,
  email text,
  outreach_hook text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sm.id,
    d.id,
    d.title,
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.outreach_hook
  FROM scheduled_mailings sm
  JOIN deals d ON d.id = sm.deal_id
  LEFT JOIN contacts c ON c.id = sm.contact_id
  WHERE sm.status = 'pending'
  AND sm.scheduled_at <= now()
  AND sm.mailing_type = '2nd_mailing'
  AND c.email IS NOT NULL
  AND c.email != ''
  ORDER BY sm.scheduled_at ASC;
$$;

-- RPC: Deal auf Verloren wenn kein Reply nach weiteren 14 Tagen
CREATE OR REPLACE FUNCTION get_overdue_second_mailings()
RETURNS TABLE (
  scheduled_mailing_id uuid,
  deal_id uuid,
  contact_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.id, sm.deal_id, sm.contact_id
  FROM scheduled_mailings sm
  JOIN contacts c ON c.id = sm.contact_id
  WHERE sm.status = 'sent'
  AND sm.sent_at <= now() - interval '14 days'
  AND c.outreach_status NOT IN ('replied', 'terminated')
  AND sm.mailing_type = '2nd_mailing';
$$;
