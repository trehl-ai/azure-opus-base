-- Fix malformed email (at)->@ und gated Stage-Move versandreifer NRW-Deals -> Identifiziert.
-- 6 Bad-Address-Deals (Platzhalter/Sammeladressen) bleiben bewusst auf Qualifiziert-NRW.
-- Bereits angewandt auf ttgvhqygmgtnjgwunuwz am 2026-06-30 (142 Deals verschoben).
UPDATE contacts
SET email = 'kontakt@gs-intrup.de', updated_at = now()
WHERE lower(email) = 'kontakt(at)gs-intrup.de';

UPDATE deals d
SET pipeline_stage_id = 'e090b0f7-a646-494d-b069-2dcd0726c5f9'::uuid,
    updated_at = now()
FROM contacts c, pipelines p
WHERE d.primary_contact_id = c.id
  AND d.pipeline_id = p.id
  AND p.name ILIKE '%werteraum%'
  AND d.deleted_at IS NULL
  AND d.pipeline_stage_id = '616dd027-993c-4875-bca7-0f5cc436a38b'::uuid
  AND c.email IS NOT NULL
  AND c.outreach_cluster IS NOT NULL
  AND c.outreach_status = 'pending'
  AND c.email LIKE '%@%.%'
  AND lower(c.email) NOT IN ('email@adresse.de','info@rhein-kreis-neuss.de','info@duesseldorf.de');
