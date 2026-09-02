-- Schutz gegen das Ueberschreiben eines Hard-Bounce-Status durch den Dispatch-Workflow.
-- Anlass 25.08.2026: Kandidaten werden um 08:00:00 geholt, Bounces treffen zwischen
-- 08:00:20 und 08:00:40 ein, der Dispatch schreibt danach outreach_status='email_sent'
-- zurueck. Drei Kontakte betroffen. bounce_at verhindert zwar den Folgeversand, aber der
-- Status wird falsch. Was garantiert sein muss, gehoert in Code, nicht in einen Workflow.
-- Eng gefasst: greift NUR wenn ein Hard Bounce vorliegt UND jemand auf email_sent setzt.
CREATE OR REPLACE FUNCTION public.wr_bounce_status_schutz()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bounce_typ = 'hard_bounce'
     AND NEW.bounce_at IS NOT NULL
     AND NEW.outreach_status = 'email_sent' THEN
    NEW.outreach_status := 'bounced';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_wr_bounce_status_schutz ON public.contacts;

CREATE TRIGGER trg_wr_bounce_status_schutz
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.wr_bounce_status_schutz();