-- 17.08.2026 — Reply- und Bounce-Intake fuer WerteRaum.
-- Vorbedingung fuer die Follow-up-Automation ab 18.08.: ohne Bounce-Erkennung
-- geht das 2. Mailing an tote Adressen.

-- 1) Bounce-Felder auf contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS bounce_at    timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_typ   text,
  ADD COLUMN IF NOT EXISTS bounce_grund text;

-- 2) Aktivitaetstyp 'bounce' zulassen
ALTER TABLE public.deal_activities DROP CONSTRAINT IF EXISTS deal_activities_type_check;
ALTER TABLE public.deal_activities ADD CONSTRAINT deal_activities_type_check
  CHECK (activity_type = ANY (ARRAY['call','email','note','meeting','task','briefing',
                                    'casting','link_click','email_reply','bounce']));

-- 3) Widerspruchserkennung kontaktscharf machen.
-- Bisher wurde ueber company_contacts die gesamte Company gesperrt. Da companies
-- ueber Bundeslaender hinweg namensdedupliziert sind (446 Companies, 973 Deals),
-- haette ein Widerspruch aus Wetzlar die Schule in Luebeck mitgesperrt.
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
      AND c.outreach_status IS DISTINCT FROM 'blocked_widerspruch'
      AND c.id IN (
        NEW.contact_id,
        (SELECT d.primary_contact_id FROM public.deals d WHERE d.id = NEW.deal_id)
      );
  END IF;

  RETURN NEW;
END
$function$;

-- 4) Zentrale Intake-RPC fuer n8n. Ein Aufruf pro eingehender Mail.
CREATE OR REPLACE FUNCTION public.wr_mail_event(
  p_email   text,
  p_typ     text,                      -- hard_bounce | soft_bounce | reply | ooo
  p_subject text DEFAULT NULL,
  p_body    text DEFAULT NULL,
  p_grund   text DEFAULT NULL          -- z.B. SMTP 550 5.1.1
)
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
BEGIN
  IF p_typ NOT IN ('hard_bounce','soft_bounce','reply','ooo') THEN
    RETURN json_build_object('ok', false, 'fehler', 'unbekannter typ: ' || coalesce(p_typ,'null'));
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

  IF p_typ IN ('hard_bounce','soft_bounce') THEN
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'bounce',
            CASE WHEN p_typ = 'hard_bounce' THEN 'Hard Bounce' ELSE 'Soft Bounce' END,
            coalesce(p_grund,'') , 'completed', true,
            json_build_object('typ', p_typ, 'subject', p_subject)::jsonb, now())
    RETURNING id INTO v_activity_id;

    UPDATE contacts
    SET bounce_at = now(), bounce_typ = p_typ, bounce_grund = p_grund,
        outreach_status = CASE WHEN p_typ = 'hard_bounce' THEN 'bounced'
                               ELSE outreach_status END
    WHERE id = v_contact_id;

    v_aktion := CASE WHEN p_typ = 'hard_bounce' THEN 'kontakt gesperrt' ELSE 'soft bounce vermerkt' END;

  ELSIF p_typ = 'reply' THEN
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'email_reply',
            coalesce(p_subject,'Antwort erhalten'), coalesce(p_body,''),
            'completed', true, json_build_object('quelle','imap_intake')::jsonb, now())
    RETURNING id INTO v_activity_id;

    UPDATE contacts SET outreach_status = 'replied'
    WHERE id = v_contact_id AND outreach_status NOT IN ('blocked_widerspruch','bounced');

    -- Stage nur vorwaerts bewegen, nie zurueck (Antwort erhalten = position 7)
    IF v_stage_pos < 7 THEN
      UPDATE deals SET pipeline_stage_id = 'ce17aedc-ec18-46b7-8f17-1ad6bd9f9115'::uuid,
                       updated_at = now()
      WHERE id = v_deal_id;
      v_aktion := 'stage -> Antwort erhalten';
    ELSE
      v_aktion := 'antwort geloggt, stage unveraendert';
    END IF;

  ELSE -- ooo
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'note',
            'Abwesenheitsnotiz', coalesce(p_subject,''),
            'completed', true, json_build_object('typ','ooo')::jsonb, now())
    RETURNING id INTO v_activity_id;
    v_aktion := 'ooo ignoriert';
  END IF;

  RETURN json_build_object('ok', true, 'typ', p_typ, 'aktion', v_aktion,
                           'contact_id', v_contact_id, 'deal_id', v_deal_id,
                           'activity_id', v_activity_id);
END
$function$;

REVOKE ALL ON FUNCTION public.wr_mail_event(text,text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.wr_mail_event(text,text,text,text,text) TO service_role, authenticated;