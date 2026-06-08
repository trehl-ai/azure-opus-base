-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


DROP POLICY IF EXISTS "project_files_insert" ON storage.objects;

CREATE POLICY "project_files_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-files');
