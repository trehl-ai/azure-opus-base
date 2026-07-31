-- 20260729121606_contacts_tags_und_schule_backfill
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 64420a1b9ad9fb0478b11cb25b0fe1f3 verifiziert.
-- Kontakt-Typisierung ueber ein Tag-Array.
-- Bewusst kein weiteres Boolean neben werteraum_potential/markenfestival/smm_2025/plsc_kampagne:
-- jene bezeichnen Kampagnen-Zugehoerigkeit, tags bezeichnet den Kontakttyp. Ein Kontakt kann
-- mehrere Typen tragen (Schule + Stiftung), ein Boolean-Paar pro Typ waere Wildwuchs.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contacts_tags
  ON public.contacts USING gin (tags)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.contacts.tags IS
'Kontakttyp-Tags fuer Segmentierung und Ausblendung in Listenansichten. Aktuell vergeben: "Schule". Filterung im Frontend ueber NOT (''Schule'' = ANY(tags)) bzw. tags @> ARRAY[''Schule''].';

-- Backfill: Schule = hat einen Deal in der WerteRaum-Pipeline UND ein Bundesland.
-- Beide Kriterien liefern unabhaengig voneinander exakt 1213 Zeilen.
UPDATE public.contacts c
SET tags = array_append(c.tags, 'Schule'),
    updated_at = now()
WHERE c.deleted_at IS NULL
  AND NOT ('Schule' = ANY(c.tags))
  AND c.bundesland IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM deals d
    WHERE d.deleted_at IS NULL
      AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
      AND (d.primary_contact_id = c.id
           OR d.company_id IN (SELECT cc.company_id FROM company_contacts cc WHERE cc.contact_id = c.id))
  );
