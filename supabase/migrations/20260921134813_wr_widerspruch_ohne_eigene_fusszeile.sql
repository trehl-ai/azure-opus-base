CREATE OR REPLACE FUNCTION public.wr_ist_widerspruch(p_text text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  -- 21.09.2026: Erkennung aus dem Trigger herausgeloest, damit sie per SELECT pruefbar ist.
  -- Schritt 1: HTML-Tags, Zitatzeichen am Zeilenanfang und Mehrfach-Leerraum entfernen.
  -- Schritt 2: UNSEREN EIGENEN Satz entfernen. In jeder unserer Mails steht die Fusszeile
  --   "Kein Interesse? Eine kurze Antwort genuegt, dann schreiben wir Sie nicht wieder an."
  --   Wer beim Antworten zitiert, traf damit bis heute das Muster - unabhaengig vom eigenen Text
  --   (gemessen: Dresden 28.08., Schwanthalerstr. 07.09., Schwaerzesee 09.09.).
  --   Bewusst NICHT "alles ab dem Zitat abschneiden": wer unter dem Zitat antwortet, wuerde
  --   sonst mit einem echten Widerspruch uebersehen.
  -- Schritt 3: Muster mit Wortgrenzen. Alleinstehendes "austragen" entfaellt ("Konflikte austragen").
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(lower(coalesce(p_text, '')), '<[^>]+>', ' ', 'g'),
               '[\n\r]\s*>+', ' ', 'g'),
             '\s+', ' ', 'g'),
           'kein interesse\?[^.!?]{0,200}', ' ', 'g')
         ~ '(kein interesse|kein bedarf|nicht interessiert|keine weiteren (nachrichten|mails|e-mails|zusendungen)|bitte (loeschen|löschen|austragen|keine weiteren)|\mabmelden\M|\mwiderspr(uch|eche|echen)\M|\munsubscribe\M|nehmen sie mich|nehmen sie uns|von ihrem verteiler|aus dem verteiler|aus ihrem verteiler|keine werbung|\mstopp?\M)';
$function$;

REVOKE EXECUTE ON FUNCTION public.wr_ist_widerspruch(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.wr_widerspruch_erkennen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.activity_type <> 'email_reply' THEN
    RETURN NEW;
  END IF;

  IF public.wr_ist_widerspruch(coalesce(NEW.description,'') || ' ' || coalesce(NEW.title,''))
  THEN
    UPDATE public.contacts c
    SET outreach_status = 'blocked_widerspruch',
        outreach_hook = COALESCE(c.outreach_hook,'')
                        || ' [WIDERSPRUCH ' || to_char(now(),'DD.MM.YYYY')
                        || ': Empfaenger hat einer weiteren Kontaktaufnahme widersprochen. Nicht erneut anschreiben.]'
    WHERE c.deleted_at IS NULL
      AND c.outreach_status IS DISTINCT FROM 'blocked_widerspruch'
      AND c.id IN (
        NEW.contact_id,
        (SELECT d.primary_contact_id FROM public.deals d WHERE d.id = NEW.deal_id)
      );
  END IF;

  RETURN NEW;
END
$function$;