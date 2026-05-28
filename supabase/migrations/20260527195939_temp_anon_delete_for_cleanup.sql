-- Backfilled 2026-05-29 from live ttgvhqygmgtnjgwunuwz.
-- Source: supabase_migrations.schema_migrations[version=20260527195939].statements[1]
-- Temporary policy used for one-off cleanup; dropped again by 20260527200011.
CREATE POLICY "werteraum_anon_delete_temp" ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = 'werteraum');
