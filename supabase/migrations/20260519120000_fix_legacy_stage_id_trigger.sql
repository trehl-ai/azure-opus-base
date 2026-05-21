-- Fix: Deal-Stage kann nicht zurueckgesetzt werden (#60)
--
-- Symptom beim UPDATE auf public.deals (z.B. Stage 'Wiedervorlage' -> 'Infomaterial'):
--   ERROR: record "new" has no field "stage_id"
--
-- Root Cause: Eine Trigger-Funktion auf public.deals referenziert noch NEW.stage_id /
-- OLD.stage_id. Die Spalte heisst aber pipeline_stage_id — vermutlich wurde die Spalte
-- umbenannt, ohne den (textuell opaken) Funktionsrumpf anzupassen. Die betroffene
-- Trigger-Funktion ist nicht in den Repo-Migrationen erfasst (vermutlich ueber das
-- Supabase Dashboard erstellt), daher kann sie nicht direkt geaendert werden.
--
-- Fix: Defensiv jede Trigger-Funktion auf public.deals patchen, deren Body
-- NEW.stage_id oder OLD.stage_id enthaelt — Referenzen werden auf
-- NEW.pipeline_stage_id / OLD.pipeline_stage_id umgeschrieben und die Funktion
-- via pg_get_functiondef + EXECUTE neu definiert. Funktionen ohne diese
-- Referenzen bleiben unveraendert.

DO $$
DECLARE
  r RECORD;
  v_def text;
BEGIN
  FOR r IN
    SELECT DISTINCT p.oid, n.nspname, p.proname
    FROM pg_trigger t
    JOIN pg_class  c ON c.oid = t.tgrelid
    JOIN pg_proc   p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE c.relname = 'deals'
      AND c.relnamespace = 'public'::regnamespace
      AND NOT t.tgisinternal
      AND pg_get_functiondef(p.oid) ~* '\m(NEW|OLD)\.stage_id\M'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(v_def, '\mNEW\.stage_id\M', 'NEW.pipeline_stage_id', 'gi');
    v_def := regexp_replace(v_def, '\mOLD\.stage_id\M', 'OLD.pipeline_stage_id', 'gi');
    EXECUTE v_def;
    RAISE NOTICE 'Patched trigger function %.% (stage_id -> pipeline_stage_id)', r.nspname, r.proname;
  END LOOP;
END
$$;
