-- Backfill: WerteRaum-Orphan-Deals (company_id NULL, primary_contact_id gesetzt)
-- erhalten je eine Company + company_contacts-Verknuepfung; deal.company_id wird gesetzt.
-- Bereits angewandt auf ttgvhqygmgtnjgwunuwz am 2026-06-30 (194 Companies). NICHT idempotent.
DO $$
DECLARE r RECORD; new_co uuid; n_co int := 0;
BEGIN
  FOR r IN
    SELECT d.id AS deal_id, d.title, d.primary_contact_id
    FROM deals d
      JOIN pipelines p ON p.id = d.pipeline_id
    WHERE p.name ILIKE '%werteraum%'
      AND d.deleted_at IS NULL
      AND d.company_id IS NULL
      AND d.primary_contact_id IS NOT NULL
  LOOP
    INSERT INTO companies (id, name, status, source, created_at, updated_at)
    VALUES (gen_random_uuid(), r.title, 'prospect', 'nrw-import-backfill', now(), now())
    RETURNING id INTO new_co;

    INSERT INTO company_contacts (id, company_id, contact_id, is_primary, relationship_type, created_at)
    VALUES (gen_random_uuid(), new_co, r.primary_contact_id, true, 'mitarbeiter', now());

    UPDATE deals SET company_id = new_co, updated_at = now()
    WHERE id = r.deal_id;

    n_co := n_co + 1;
  END LOOP;
  RAISE NOTICE 'Backfill abgeschlossen: % Companies + Verknuepfungen angelegt', n_co;
END $$;
