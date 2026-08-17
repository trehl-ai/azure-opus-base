-- 17.08.2026 — Aktivitaeten ohne deal_id sind im CRM unsichtbar.
-- Befund: der Plausible-Sync schrieb link_click-Aktivitaeten mit deal_id NULL,
-- der Klick erschien damit in keiner Deal-Ansicht. Insgesamt 87 Aktivitaeten
-- ohne deal_id im Bestand (46 note, 35 email, 5 call, 1 link_click).
-- Statt jeden Writer einzeln zu reparieren, loest ein BEFORE-INSERT-Trigger
-- die deal_id deterministisch auf. Bewusst konservativ: nur wenn der Kontakt
-- GENAU EIN nicht geloeschtes Deal als primary_contact hat. Bei Mehrdeutigkeit
-- bleibt deal_id NULL — falsch zugeordnet ist schlimmer als nicht zugeordnet
-- (siehe Fehlzuordnung von 7 Mails am 17.08. durch Aufloesung ueber companies).

CREATE OR REPLACE FUNCTION public.fill_activity_deal_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_id uuid;
  v_anzahl  int;
BEGIN
  IF NEW.deal_id IS NOT NULL OR NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*), min(d.id) INTO v_anzahl, v_deal_id
  FROM deals d
  WHERE d.primary_contact_id = NEW.contact_id
    AND d.deleted_at IS NULL;

  IF v_anzahl = 1 THEN
    NEW.deal_id := v_deal_id;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_fill_activity_deal_id ON public.deal_activities;
CREATE TRIGGER trg_fill_activity_deal_id
  BEFORE INSERT ON public.deal_activities
  FOR EACH ROW EXECUTE FUNCTION public.fill_activity_deal_id();