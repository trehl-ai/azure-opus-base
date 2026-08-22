-- Deterministische Autoreply-Erkennung VOR dem reply-Zweig.
-- Greift nur bei Subject-Praefixen, die Mailserver selbst setzen (RFC-nahe Muster),
-- NICHT bei Fliesstext-Heuristik: eine echte Antwort still als ooo zu verbuchen
-- ist teurer als eine Autoreply faelschlich als Antwort zu zeigen.
CREATE OR REPLACE FUNCTION public.wr_mail_event(
  p_email text, p_typ text, p_subject text DEFAULT NULL::text,
  p_body text DEFAULT NULL::text, p_grund text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id  uuid;
  v_deal_id     uuid;
  v_stage_pos   int;
  v_activity_id uuid;
  v_aktion      text := 'logged';
  v_typ         text := p_typ;
  v_degradiert  boolean := false;
BEGIN
  IF p_typ NOT IN ('hard_bounce','soft_bounce','reply','ooo') THEN
    RETURN json_build_object('ok', false, 'fehler', 'unbekannter typ: ' || coalesce(p_typ,'null'));
  END IF;

  -- HAERTUNG: reply -> ooo, wenn das Subject ein maschinelles Autoreply-Praefix traegt.
  IF p_typ = 'reply' AND p_subject IS NOT NULL THEN
    IF btrim(regexp_replace(p_subject, '^((AW|RE|WG|FW|FWD)\s*:\s*)+', '', 'i')) ~*
       '^(automatische antwort|automatic reply|autoreply|auto-reply|automatische eingangsbest|abwesenheit|abwesenheitsnotiz|out of office|out-of-office|ooo|urlaubsmeldung|auto\s*:)'
    THEN
      v_typ        := 'ooo';
      v_degradiert := true;
    END IF;
  END IF;

  SELECT c.id INTO v_contact_id
  FROM contacts c
  WHERE lower(c.email) = lower(btrim(p_email)) AND c.deleted_at IS NULL
  ORDER BY c.created_at
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RETURN json_build_object('ok', false, 'fehler', 'kontakt nicht gefunden', 'email', p_email);
  END IF;

  SELECT d.id, ps.position INTO v_deal_id, v_stage_pos
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  WHERE d.primary_contact_id = v_contact_id
    AND d.deleted_at IS NULL
    AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
  ORDER BY d.created_at
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    RETURN json_build_object('ok', false, 'fehler', 'kein WerteRaum-Deal zum Kontakt',
                             'contact_id', v_contact_id);
  END IF;

  IF v_typ IN ('hard_bounce','soft_bounce') THEN
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'bounce',
            CASE WHEN v_typ = 'hard_bounce' THEN 'Hard Bounce' ELSE 'Soft Bounce' END,
            coalesce(p_grund,'') , 'completed', true,
            json_build_object('typ', v_typ, 'subject', p_subject)::jsonb, now())
    RETURNING id INTO v_activity_id;

    UPDATE contacts
    SET bounce_at = now(), bounce_typ = v_typ, bounce_grund = p_grund,
        outreach_status = CASE WHEN v_typ = 'hard_bounce' THEN 'bounced'
                               ELSE outreach_status END
    WHERE id = v_contact_id;

    v_aktion := CASE WHEN v_typ = 'hard_bounce' THEN 'kontakt gesperrt' ELSE 'soft bounce vermerkt' END;

  ELSIF v_typ = 'reply' THEN
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'email_reply',
            coalesce(p_subject,'Antwort erhalten'), coalesce(p_body,''),
            'completed', true, json_build_object('quelle','imap_intake')::jsonb, now())
    RETURNING id INTO v_activity_id;

    UPDATE contacts SET outreach_status = 'replied'
    WHERE id = v_contact_id AND outreach_status NOT IN ('blocked_widerspruch','bounced');

    IF v_stage_pos < 7 THEN
      UPDATE deals SET pipeline_stage_id = 'ce17aedc-ec18-46b7-8f17-1ad6bd9f9115'::uuid,
                       updated_at = now()
      WHERE id = v_deal_id;
      v_aktion := 'stage -> Antwort erhalten';
    ELSE
      v_aktion := 'antwort geloggt, stage unveraendert';
    END IF;

  ELSE -- ooo (inkl. degradierter reply)
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'note',
            CASE WHEN v_degradiert THEN 'Automatische Antwort (kein Kontakt)'
                 ELSE 'Abwesenheitsnotiz' END,
            coalesce(p_subject,''),
            'completed', true,
            json_build_object('typ','ooo','degradiert_von_reply', v_degradiert,
                              'subject', p_subject)::jsonb, now())
    RETURNING id INTO v_activity_id;
    v_aktion := CASE WHEN v_degradiert THEN 'reply als autoreply erkannt, stage unveraendert'
                     ELSE 'ooo ignoriert' END;
  END IF;

  RETURN json_build_object('ok', true, 'typ', v_typ, 'typ_uebergeben', p_typ,
                           'degradiert', v_degradiert, 'aktion', v_aktion,
                           'contact_id', v_contact_id, 'deal_id', v_deal_id,
                           'activity_id', v_activity_id);
END
$function$;