-- 20260729154551_academy_intel_evidence_cache_drop_hits
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 cce7c61b439674f7fcd525338e413793 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- 'hits' wurde nie inkrementiert und waere dauerhaft 0 - eine Spalte, die
-- Auswertungen in die Irre fuehrt. Die Trefferquote steht stattdessen pro
-- Datensatz in academy_intel.entity_gate->>'evidence_source' ('cache'|'brave'),
-- geschrieben vom Node 'Write Success'.
alter table public.academy_intel_evidence_cache drop column if exists hits;
