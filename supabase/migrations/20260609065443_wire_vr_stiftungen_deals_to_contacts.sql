-- Migration: 20260609065443_wire_vr_stiftungen_deals_to_contacts
-- Backfilled from supabase_migrations.schema_migrations on project ttgvhqygmgtnjgwunuwz.
-- Originally applied out-of-band via Supabase MCP apply_migration (2026-06-09);
-- recorded here so schema-drift-check CI reconciles repo vs live DB.

UPDATE deals d
SET primary_contact_id = (
  SELECT c.id
  FROM company_contacts cc
  JOIN contacts c ON c.id = cc.contact_id
  WHERE cc.company_id = d.company_id
  AND c.vr_fit_score IS NOT NULL
  ORDER BY c.vr_fit_score DESC
  LIMIT 1
),
updated_at = now()
WHERE d.pipeline_id = '341c067d-39fe-46ae-82c7-33d6c55a2a60'
AND d.primary_contact_id IS NULL
AND d.company_id IS NOT NULL;
