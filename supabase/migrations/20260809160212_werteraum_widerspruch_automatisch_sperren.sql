CREATE OR REPLACE FUNCTION public.wr_widerspruch_erkennen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_text text;
BEGIN
  IF NEW.activity_type <> 'email_reply' THEN
    RETURN NEW;
  END IF;

  v_text := lower(coalesce(NEW.description,'') || ' ' || coalesce(NEW.title,''));

  IF v_text ~ '(kein interesse|kein bedarf|nicht interessiert|keine weiteren (nachrichten|mails|e-mails|zusendungen)|bitte (loeschen|löschen|austragen|keine weiteren)|austragen|abmelden|widerspruch|unsubscribe|nehmen sie mich|nehmen sie uns|von ihrem verteiler|aus dem verteiler|keine werbung|stop)'
  THEN
    UPDATE public.contacts c
    SET outreach_status = 'blocked_widerspruch',
        outreach_hook = COALESCE(c.outreach_hook,'')
                        || ' [WIDERSPRUCH ' || to_char(now(),'DD.MM.YYYY')
                        || ': Empfaenger hat einer weiteren Kontaktaufnahme widersprochen. Nicht erneut anschreiben.]'
    WHERE c.deleted_at IS NULL
      AND c.outreach_status NOT IN ('blocked_widerspruch')
      AND (
        c.id = (SELECT d.primary_contact_id FROM public.deals d WHERE d.id = NEW.deal_id)
        OR c.id IN (
          SELECT cc.contact_id FROM public.company_contacts cc
          JOIN public.deals d2 ON d2.company_id = cc.company_id
          WHERE d2.id = NEW.deal_id
        )
      );
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_wr_widerspruch ON public.deal_activities;

CREATE TRIGGER trg_wr_widerspruch
  AFTER INSERT ON public.deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.wr_widerspruch_erkennen();
