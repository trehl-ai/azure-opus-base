-- 20260729141217_academy_intel_add_selected
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 5b12392ed0d8eadb22e38ba7ea83b670 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
ALTER TABLE public.academy_intel
  ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_reason text;

COMMENT ON COLUMN public.academy_intel.selected IS
  'Bestes Konzept fuer diesen Kontakt. Gesetzt, wenn der fit_score allein nicht entscheidet (Gleichstand an der Spitze) und die Auswahl anhand von why_match/angle getroffen wurde.';
COMMENT ON COLUMN public.academy_intel.selected_reason IS
  'Warum dieses Konzept gewaehlt wurde - Begruendung im Klartext, damit die Entscheidung nachvollziehbar und revidierbar bleibt.';
