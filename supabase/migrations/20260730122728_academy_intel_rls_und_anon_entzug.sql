-- 20260730122728_academy_intel_rls_und_anon_entzug
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 ec5f20f0f66e707d9bac4fe203c02adc verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- academy_intel lief ohne RLS und war per GRANT fuer anon voll schreibbar.
-- Frontend (Ideas.tsx) greift ausschliesslich ueber SECURITY-DEFINER-RPCs zu,
-- der Massenlauf ueber service_role. Beide sind von RLS nicht betroffen.
alter table public.academy_intel enable row level security;

revoke insert, update, delete, truncate on public.academy_intel from anon;
revoke insert, update, delete, truncate on public.academy_intel from authenticated;
revoke select on public.academy_intel from anon;
