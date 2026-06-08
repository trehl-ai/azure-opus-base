-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


-- updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eis_lead_queue_updated_at ON eis_lead_queue;
CREATE TRIGGER eis_lead_queue_updated_at
  BEFORE UPDATE ON eis_lead_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS eis_contacts_updated_at ON eis_contacts;
CREATE TRIGGER eis_contacts_updated_at
  BEFORE UPDATE ON eis_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS eis_knowledge_entries_updated_at ON eis_knowledge_entries;
CREATE TRIGGER eis_knowledge_entries_updated_at
  BEFORE UPDATE ON eis_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION fn_eis_recalculate_score(
  p_lead_id              uuid,
  p_company_size_score   int,
  p_csr_signal_score     int,
  p_sponsor_affinity_score int,
  p_decision_maker_score int,
  p_regional_fit_score   int,
  p_score_reasoning      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE eis_lead_queue SET
    company_size_score      = p_company_size_score,
    csr_signal_score        = p_csr_signal_score,
    sponsor_affinity_score  = p_sponsor_affinity_score,
    decision_maker_score    = p_decision_maker_score,
    regional_fit_score      = p_regional_fit_score,
    score_reasoning         = p_score_reasoning,
    score_verified          = true,
    updated_at              = now()
  WHERE id = p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION log_eis_activity(
  p_contact_id  uuid,
  p_type        text,
  p_title       text,
  p_description text DEFAULT NULL,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO eis_activities (contact_id, type, title, description, metadata)
  VALUES (p_contact_id, p_type, p_title, p_description, p_metadata)
  RETURNING id INTO v_id;

  UPDATE eis_contacts
  SET last_contact_at = now(), updated_at = now()
  WHERE id = p_contact_id;

  RETURN v_id;
END;
$$;
