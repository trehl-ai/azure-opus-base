-- Standard-Projektleitung je Pipeline (25.11.2026)
-- pipelines.default_projektleiter_user_id; Trigger setzt deals.projektleiter_user_id beim Eintritt
-- in 'Terminiert' / 'Angebot erstellt' / 'Verhandlung', wenn noch keine Projektleitung gesetzt ist.
-- Eine vorhandene Projektleitung wird nie ueberschrieben, owner_user_id (Provision) nie angefasst.
-- Bestehende Deals werden NICHT nachgezogen (kein Backfill).

ALTER TABLE public.pipelines
  ADD COLUMN default_projektleiter_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Nur Werteraum - Schulen -> T. Timmer. Andere Pipelines bleiben NULL.
DO $guard$
DECLARE n int;
BEGIN
  UPDATE public.pipelines
     SET default_projektleiter_user_id = '47a6442b-6840-4787-bae3-477a90490c1c'
   WHERE id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'GUARD default_projektleiter: % Zeilen statt 1', n;
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.deals_projektleiter_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  -- SECURITY DEFINER: pipelines/pipeline_stages muessen unabhaengig von der RLS des
  -- aufrufenden Nutzers lesbar sein, sonst griffe der Standard je nach Rolle nicht.
  IF NEW.projektleiter_user_id IS NULL
     AND EXISTS (SELECT 1 FROM pipeline_stages ps
                  WHERE ps.id = NEW.pipeline_stage_id
                    AND ps.name IN ('Terminiert','Angebot erstellt','Verhandlung'))
  THEN
    SELECT p.default_projektleiter_user_id INTO NEW.projektleiter_user_id
      FROM pipelines p WHERE p.id = NEW.pipeline_id;
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.deals_projektleiter_default() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_deals_projektleiter_default
  BEFORE INSERT OR UPDATE OF pipeline_stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_projektleiter_default();
