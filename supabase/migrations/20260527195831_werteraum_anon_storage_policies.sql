-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260527195831].statements[1]

-- Scoped anon access to the project-files bucket, limited to the werteraum/ folder,
-- so the (anon) supabaseEIC client can createSignedUrl + upload for the WerteRaum panel.
DROP POLICY IF EXISTS "werteraum_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "werteraum_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "werteraum_anon_update" ON storage.objects;

CREATE POLICY "werteraum_anon_select" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'werteraum');

CREATE POLICY "werteraum_anon_insert" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'werteraum');

CREATE POLICY "werteraum_anon_update" ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'werteraum')
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'werteraum');
