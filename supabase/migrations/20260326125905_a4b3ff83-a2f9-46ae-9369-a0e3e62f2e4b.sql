
-- Backfill deals without primary_contact_id using company_contacts
UPDATE deals d
SET primary_contact_id = cc.contact_id,
    updated_at = now()
FROM company_contacts cc
WHERE d.primary_contact_id IS NULL
  AND d.company_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND cc.company_id = d.company_id
  AND cc.is_primary = true;

-- Second pass: if no primary contact found, use any contact linked to the company
UPDATE deals d
SET primary_contact_id = (
  SELECT cc2.contact_id
  FROM company_contacts cc2
  WHERE cc2.company_id = d.company_id
  LIMIT 1
),
updated_at = now()
WHERE d.primary_contact_id IS NULL
  AND d.company_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM company_contacts cc3 WHERE cc3.company_id = d.company_id
  );
