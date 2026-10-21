-- wr_status_rangfolge v2 (21.10.2026): Liste UEBERSCHREIBBARER statt geschuetzter Werte.
-- Ein automatischer Versand oder Klick (email_sent, link_clicked) darf nur pending,
-- email_sent und link_clicked ueberschreiben. Jeder andere Wert, auch ein kuenftig
-- neu eingefuehrter (blocked_dublette, pruefung_schulform, blocked_unklare_adresse),
-- bleibt stehen. bounced behaelt seine eigene Regel: gesperrt, solange bounce_at
-- gesetzt und die Adresse unveraendert ist; nach einer Adresskorrektur darf der
-- Versand den Status wieder setzen. Menschen im CRM (auth.uid()) duerfen alles.
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
    IF OLD.outreach_status = 'bounced' THEN
      IF NEW.bounce_at IS NOT NULL
         AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
        NEW.outreach_status := OLD.outreach_status;  -- Bounce steht, Adresse gleich: bleibt gesperrt
      END IF;
    ELSIF COALESCE(OLD.outreach_status, 'pending') NOT IN ('pending', 'email_sent', 'link_clicked') THEN
      NEW.outreach_status := OLD.outreach_status;  -- jeder andere Wert ist eine Sperre oder ein Endzustand
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
