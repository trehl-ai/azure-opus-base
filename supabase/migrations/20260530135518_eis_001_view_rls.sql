-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


CREATE OR REPLACE VIEW v_eis_connect_queue AS
SELECT
  q.id,
  q.full_name,
  q.first_name,
  q.last_name,
  q.title,
  q.linkedin_url,
  q.company_name,
  q.industry,
  q.company_hq_country,
  q.final_score,
  q.score_reasoning,
  q.import_batch,
  q.created_at
FROM eis_lead_queue q
WHERE
  q.score_verified = true
  AND q.abgeholt = false
  AND q.linkedin_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM eis_contacts c
    WHERE c.linkedin_url = q.linkedin_url
      AND c.outreach_status != 'pending'
  )
ORDER BY q.final_score DESC, q.created_at ASC;

ALTER TABLE eis_lead_queue        ENABLE ROW LEVEL SECURITY;
ALTER TABLE eis_contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE eis_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE eis_activities        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_eis_lead_queue"
  ON eis_lead_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_eis_contacts"
  ON eis_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_eis_knowledge_entries"
  ON eis_knowledge_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_eis_activities"
  ON eis_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
