-- Defensive guard: wenn ein Intake-Webhook eine Email mit komplett leerem
-- raw_body UND raw_body_html zustellt, gibt es nichts zu parsen — Gemini
-- kann kein parsed_payload_json extrahieren, die Row bleibt orphan auf
-- status='new' und löst den EIC-Health-Check-Alarm aus.
--
-- Statt das in jeden Intake-Workflow zu duplizieren, setzt dieser
-- BEFORE-INSERT-Trigger die Row direkt auf status='rejected', sobald beide
-- Body-Felder leer/NULL sind. Health-Check filtert dann normal weg.
--
-- Inserts mit explizit gesetztem nicht-'new'-Status werden NICHT überschrieben
-- (z.B. wenn ein Workflow eine Row aus anderem Grund auf 'review_required'
-- legt). Nur Default-Pfad (status='new') wird gerejected.

CREATE OR REPLACE FUNCTION public.intake_messages_reject_empty_body()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'new'
     AND (NEW.raw_body IS NULL OR length(NEW.raw_body) = 0)
     AND (NEW.raw_body_html IS NULL OR length(NEW.raw_body_html) = 0)
  THEN
    NEW.status := 'rejected';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intake_messages_reject_empty_body_trigger ON public.intake_messages;

CREATE TRIGGER intake_messages_reject_empty_body_trigger
  BEFORE INSERT ON public.intake_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.intake_messages_reject_empty_body();

COMMENT ON FUNCTION public.intake_messages_reject_empty_body() IS
  'BEFORE INSERT trigger auf intake_messages: rejected-Status setzen wenn raw_body und raw_body_html beide leer/NULL und Default-status=new. Verhindert orphane Rows die den EIC-Health-Check triggern.';
