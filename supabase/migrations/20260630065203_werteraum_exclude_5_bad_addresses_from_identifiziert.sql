-- 5 Bad-Address-Deals aus Identifiziert zurueck nach Qualifiziert-NRW. Angewandt 2026-06-30.
UPDATE deals d SET pipeline_stage_id='616dd027-993c-4875-bca7-0f5cc436a38b'::uuid, updated_at=now()
FROM contacts c, pipelines p
WHERE d.primary_contact_id=c.id AND d.pipeline_id=p.id AND p.name ILIKE '%werteraum%'
  AND d.deleted_at IS NULL AND d.pipeline_stage_id='e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid
  AND lower(c.email) IN ('email@adresse.de','info@rhein-kreis-neuss.de');
