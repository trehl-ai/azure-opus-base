-- 28.09.2026: outreach_status hatte keine Rangfolge — jeder Schreiber ueberschrieb jeden. Belegt: Stralsund 8ea555c9
-- (12:22 Widerspruch -> blocked_widerspruch, 12:30 Klick-Intake -> link_clicked, Sperre weg), Sandersdorf a1a94e87 und
-- Bad Nauheim 4fbfb0c1 (terminated -> link_clicked nach der Buchung), Wiesbaden 21.09. (link_clicked -> email_sent durch Nachfass).
-- Regel: Automatik (auth.uid() IS NULL) darf einen Endzustand nicht auf einen schwaecheren Zustand zuruecksetzen.
--   geschuetzt: blocked_widerspruch, blocked_behoerde, blocked_namenskollision, terminated, replied, bounced
--   schwaecher: link_clicked, email_sent
--   Ausnahmen: Menschen im CRM (auth.uid() gesetzt) duerfen alles; bounced -> email_sent ist erlaubt, wenn im selben UPDATE
--   bounce_at geloescht wird (Entsperren) oder die Adresse geaendert wird (Korrektur). Wechsel nach pending bleibt frei
--   (korrigiere_mailadresse). Die Aktivitaet (Klick) bleibt immer erhalten, nur der Status wird gehalten.
CREATE OR REPLACE FUNCTION public.wr_status_rangfolge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NEW.outreach_status IS NOT DISTINCT FROM OLD.outreach_status THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;  -- Mensch im CRM darf alles
  END IF;
  IF NEW.outreach_status IN ('link_clicked', 'email_sent') THEN
    IF OLD.outreach_status IN ('blocked_widerspruch', 'blocked_behoerde', 'blocked_namenskollision', 'terminated', 'replied') THEN
      NEW.outreach_status := OLD.outreach_status;
    ELSIF OLD.outreach_status = 'bounced'
          AND NEW.bounce_at IS NOT NULL
          AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
      NEW.outreach_status := OLD.outreach_status;  -- Bounce steht, Adresse gleich: bleibt gesperrt
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.wr_status_rangfolge() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_wr_status_rangfolge ON public.contacts;
CREATE TRIGGER trg_wr_status_rangfolge
  BEFORE UPDATE OF outreach_status ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.wr_status_rangfolge();