-- Baustufe 2c-2: cal_booking_intake setzt die Stufe eines bestehenden Deals nur noch VORWAERTS.
-- Gewonnen/Verloren ueber is_won_stage/is_lost_stage (wie sync_deal_status_from_stage),
-- Terminiert und Angebot erstellt ueber pipeline_id des Deals + Name, nie feste Stufen-ID.
--   keine Stufe "Terminiert"          -> unveraendert, WARNING
--   Gewonnen                          -> unveraendert, nur Meeting
--   Verloren in WR 61b1b7e2 / VRS ffcb34b3 -> set_deal_reopen auf Terminiert
--                                        (alter lost_reason in metadata.lost_reason_vorher + Aktivitaetstext)
--   Verloren in anderen Pipelines     -> unveraendert + zuordnung_pruefen + intake_unzugeordnet
--   Blacklist / Blocked               -> unveraendert + zuordnung_pruefen + intake_unzugeordnet
--   Terminiert / Angebot erstellt     -> unveraendert, nur Meeting
--   Position < Terminiert             -> Terminiert
--   jede andere Stufe dahinter        -> unveraendert + zuordnung_pruefen + intake_unzugeordnet
-- intake-Zeile: typ cal_buchung, message_id cal:<uid>, status offen, ON CONFLICT DO NOTHING.
-- Ersetzt den Stiftungs-Sonderweg (feste ID 2a52e33e, Position < 4).
-- Signatur, SECURITY DEFINER, search_path und Grants unveraendert (CREATE OR REPLACE
-- behaelt proacl). Rueckgabe/Metadaten nur ergaenzt (stufe_regel, lost_reason_vorher).

CREATE OR REPLACE FUNCTION public.cal_booking_intake(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_pipeline constant uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  c_stage    constant uuid := '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6';
  -- Owner = Provisionszuordnung, nicht wer das Gespraech fuehrt.
  c_owner    constant uuid := '81de2da3-eef1-4b20-955f-09aed66bc1a3';
  v_trigger text := upper(coalesce(p_payload->>'triggerEvent','BOOKING_CREATED'));
  v_pl   jsonb  := coalesce(p_payload->'payload','{}'::jsonb);
  v_email text := lower(nullif(trim(v_pl#>>'{attendees,0,email}'),''));
  v_name  text := nullif(trim(v_pl#>>'{attendees,0,name}'),'');
  v_uid   text := nullif(v_pl->>'uid','');
  v_title text := coalesce(nullif(v_pl->>'title',''), nullif(v_pl->>'type',''), 'Cal.com Termin');
  v_start timestamptz := coalesce(nullif(v_pl->>'startTime','')::timestamptz, nullif(v_pl->>'start_time','')::timestamptz);
  v_end   timestamptz := coalesce(nullif(v_pl->>'endTime','')::timestamptz,   nullif(v_pl->>'end_time','')::timestamptz);
  v_evt   text := coalesce(v_pl->>'eventTypeId', v_pl#>>'{eventType,id}');
  v_ist_wr boolean;
  v_first text; v_last text;
  v_contact_id uuid; v_new_contact boolean := false;
  v_deal_id uuid;    v_new_deal boolean := false;
  v_company_id uuid;
  v_activity_id uuid;
  v_alte_stage text;
  v_stage_geaendert boolean := false;
  v_formular jsonb;
  v_treffer  jsonb;
  v_f_schule text;
  v_f_ort    text;
  -- B13 (02.10.2026): Die im Formular genannte Schule als eigenstaendiger
  -- Suchschluessel. Vorher floss sie NUR in die company_id eines NEUEN Deals
  -- ein und nie in die Suche nach einem BESTEHENDEN -- deshalb entstand am
  -- 01.10. die Dublette 373043da neben dem Outreach-Deal 453febc4, obwohl
  -- beide dieselbe company_id ae825b8c trugen.
  v_firma_formular uuid;
  -- 09.11.2026 Stiftungen
  c_stift_pipeline constant uuid := '341c067d-39fe-46ae-82c7-33d6c55a2a60';
  v_deal_pipeline uuid;
  v_stift_domain boolean := false;
  -- 24.11.2026 Baustufe 2c: Pipeline "Viktoria Rebensburg - Schulen" (F&A-Schulen)
  c_vrs_pipeline constant uuid := 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b';
  -- Projektleiter = wer das Gespraech fuehrt (owner_user_id bleibt Provision).
  c_pl_armin     constant uuid := '35176e4a-953c-4ce4-9bee-2406a81a1dab';
  c_pl_tt        constant uuid := '47a6442b-6840-4787-bae3-477a90490c1c';
  v_projektleiter uuid;
  v_pl_gesetzt   boolean := false;
  v_bevorzugt    uuid;
  v_neu_pipeline uuid;
  v_neu_stage    uuid;
  v_termin_stage uuid;
  v_termin_fehlt boolean := false;
  -- Baustufe 2c-3: Zuordnung Buchung -> Firma -> Deal
  c_freemail constant text[] := ARRAY['gmail.com','googlemail.com','web.de','gmx.de','gmx.net',
       't-online.de','outlook.com','outlook.de','hotmail.com','hotmail.de','live.de','live.com',
       'yahoo.com','yahoo.de','icloud.com','me.com','aol.com','freenet.de','posteo.de',
       'mailbox.org','arcor.de','online.de','email.de','protonmail.com','proton.me'];
  v_dom          text;
  v_kontakte     uuid[];
  v_firmen_mail  uuid[];
  v_firmen_dom   uuid[];
  v_firmen_name  uuid[];
  v_firma        uuid;
  v_weg          text;
  v_pruefen      boolean := false;
  v_pruef_grund  text;
  -- Baustufe 2c-2: Stufe nur vorwaerts
  v_alte_pos     int;
  v_termin_pos   int;
  v_alt_lost     boolean;
  v_lost_reason_vorher text;
  v_stufe_regel  text;
  v_alte_stage_id uuid;
  v_alt_won      boolean;
  v_stufe_pruefen boolean := false;
  v_stufe_grund  text;
BEGIN
  INSERT INTO webhook_log(source, event_type, payload, received_at)
  VALUES ('cal.com', v_trigger, p_payload, now());

  IF v_trigger = 'PING' THEN
    RETURN jsonb_build_object('ok', true, 'status','ping');
  END IF;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status','no_email','logged',true);
  END IF;

  IF v_uid IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('cal_booking:' || v_uid));
  END IF;

  v_formular := cal_schule_aus_responses(v_pl->'responses');
  v_f_schule := v_formular->>'schule';
  v_f_ort    := v_formular->>'ort';
  IF v_f_schule IS NOT NULL THEN
    v_treffer := cal_firma_finden(v_f_schule, v_f_ort);
  END IF;
  -- Nur bei genau einem Firmentreffer gefuellt (cal_firma_finden garantiert das).
  v_firma_formular := nullif(v_treffer->>'company_id','')::uuid;

  v_ist_wr := cal_ist_werteraum_event(v_evt, v_title);

  -- Baustufe 2c: Das Event bestimmt Projektleiter und bevorzugte Pipeline.
  -- Reine Titel-Treffer (keine Event-ID aus der Liste): kein Projektleiter.
  v_projektleiter := CASE v_evt WHEN '6945548' THEN c_pl_armin
                                WHEN '6023888' THEN c_pl_tt
                                WHEN '7457537' THEN c_pl_tt
                                WHEN '5975343' THEN c_pl_tt END;
  v_bevorzugt := CASE WHEN v_evt = '6945548' THEN c_vrs_pipeline ELSE c_pipeline END;

  IF v_trigger IN ('BOOKING_CANCELLED','BOOKING_REJECTED') THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'status','cancel_no_uid','logged',true);
    END IF;
    UPDATE deal_activities
       SET status = 'completed',
           title  = CASE WHEN title LIKE '%[STORNIERT]%' THEN title ELSE '[STORNIERT] ' || title END,
           description = coalesce(description,'') || E'\n--- Storniert am ' || to_char(now(),'DD.MM.YYYY HH24:MI') || ' ---',
           updated_at = now()
     WHERE deleted_at IS NULL
       AND coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid') = v_uid
       AND title NOT LIKE '%[STORNIERT]%'
     RETURNING id INTO v_activity_id;
    RETURN jsonb_build_object('ok', v_activity_id IS NOT NULL, 'status','cancelled',
                              'activity_id',v_activity_id,'found', v_activity_id IS NOT NULL,'cal_uid',v_uid);
  END IF;

  IF v_trigger = 'BOOKING_RESCHEDULED' THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'status','reschedule_no_uid','logged',true);
    END IF;
    UPDATE deal_activities
       SET due_date = coalesce(v_start, due_date),
           description = coalesce(description,'') || E'\n--- Verschoben auf ' || coalesce(to_char(v_start,'DD.MM.YYYY HH24:MI'),'?') || ' ---',
           updated_at = now()
     WHERE deleted_at IS NULL
       AND coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid') = v_uid
     RETURNING id INTO v_activity_id;
    IF v_activity_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'status','rescheduled','activity_id',v_activity_id,'new_start',v_start);
    END IF;
  END IF;

  v_first := split_part(coalesce(v_name,''),' ',1);
  v_last  := nullif(trim(substr(coalesce(v_name,''), length(split_part(coalesce(v_name,''),' ',1))+1)),'');
  IF v_first = '' THEN v_first := 'Cal.com'; END IF;
  IF v_last IS NULL THEN v_last := 'Gast'; END IF;

  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_activity_id FROM deal_activities
     WHERE deleted_at IS NULL
       AND coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid') = v_uid
     LIMIT 1;
    IF v_activity_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'status','ok','duplicate',true,
                                'activity_id',v_activity_id,'cal_uid',v_uid);
    END IF;
  END IF;

  SELECT id INTO v_contact_id FROM contacts WHERE lower(email) = v_email AND deleted_at IS NULL LIMIT 1;
  IF v_contact_id IS NULL THEN
    INSERT INTO contacts(first_name,last_name,email,source,status,owner_user_id)
    VALUES (v_first, v_last, v_email, 'cal-inbound', 'lead', c_owner)
    RETURNING id INTO v_contact_id;
    v_new_contact := true;
  END IF;

  -- Baustufe 2c-3 (Entwurf): erst die FIRMA bestimmen, dann den Deal in ihr.
  --   (a)  exakte Mail: alle Kontakte mit dieser Adresse -> ihre Firmen
  --        (company_contacts + Firma ihrer Deals). Genau eine -> fertig.
  --        Mehrere: Formularfirma, wenn sie darunter ist; sonst die Firma mit der
  --        juengsten Outreach-Mail an diese Adresse; sonst Namensabgleich.
  --   (a0) Formularfirma (B13, genau ein Treffer in cal_firma_finden)
  --   (b)  Domain (kein Freemailer) nur, wenn genau EINE Firma sie nutzt
  --   (c)  mehrere Firmen: booker_name exakt = "Vorname Nachname" eines Kontakts
  --        dieser Domain (lower/btrim, keine ASCII-Faltung), nur ein eindeutiger
  --        Firmentreffer gilt
  --   (d)  sonst: neuer Deal "Zuordnung prüfen: …" + Zeile in intake_unzugeordnet
  --   (e)  Deal in der Firma: Event-Pipeline, WR/VRS, offen, Hauptkontakt,
  --        juengste Outreach-Mail (deal_activities email), created_at.
  -- Der fruehere Stiftungs-Domain-Weg geht in (b) auf.
  v_dom := split_part(v_email,'@',2);
  v_kontakte := ARRAY(SELECT c.id FROM contacts c WHERE lower(c.email) = v_email AND c.deleted_at IS NULL);

  v_firmen_mail := ARRAY(
    SELECT DISTINCT x.company_id FROM (
      SELECT cc.company_id FROM company_contacts cc WHERE cc.contact_id = ANY(v_kontakte)
      UNION SELECT d.company_id FROM deals d WHERE d.primary_contact_id = ANY(v_kontakte) AND d.deleted_at IS NULL
    ) x JOIN companies co ON co.id = x.company_id AND co.deleted_at IS NULL);

  IF cardinality(v_firmen_mail) = 1 THEN
    v_firma := v_firmen_mail[1]; v_weg := 'a_mail';
  ELSIF cardinality(v_firmen_mail) > 1 THEN
    IF v_firma_formular = ANY(v_firmen_mail) THEN
      v_firma := v_firma_formular; v_weg := 'a_mail_formular';
    ELSE
      SELECT d.company_id INTO v_firma
      FROM deal_activities a JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
      WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
        AND a.contact_id = ANY(v_kontakte) AND d.company_id = ANY(v_firmen_mail)
      ORDER BY a.created_at DESC LIMIT 1;
      IF v_firma IS NOT NULL THEN
        v_weg := 'a_mail_outreach';
      ELSE
        v_firmen_name := ARRAY(
          SELECT DISTINCT cc.company_id FROM contacts c JOIN company_contacts cc ON cc.contact_id = c.id
          WHERE c.id = ANY(v_kontakte) AND cc.company_id = ANY(v_firmen_mail)
            AND btrim(c.first_name) <> '' AND btrim(c.last_name) <> ''
            AND lower(btrim(c.first_name))||' '||lower(btrim(c.last_name)) = lower(btrim(v_name)));
        IF cardinality(v_firmen_name) = 1 THEN
          v_firma := v_firmen_name[1]; v_weg := 'a_mail_name';
        ELSE
          v_pruefen := true;
          v_pruef_grund := cardinality(v_firmen_mail)||' Firmen an der exakten Adresse, kein eindeutiger Treffer';
        END IF;
      END IF;
    END IF;
  ELSIF v_firma_formular IS NOT NULL THEN
    v_firma := v_firma_formular; v_weg := 'a0_formular';
  ELSIF EXISTS (SELECT 1 FROM deals d WHERE d.primary_contact_id = ANY(v_kontakte)
                  AND d.deleted_at IS NULL AND d.company_id IS NULL) THEN
    v_weg := 'a_mail_deal_ohne_firma';
  ELSIF NOT (v_dom = ANY(c_freemail)) THEN
    v_firmen_dom := ARRAY(
      SELECT DISTINCT x.company_id FROM (
        SELECT co.id AS company_id FROM companies co WHERE lower(split_part(co.email,'@',2)) = v_dom
        UNION SELECT cc.company_id FROM company_contacts cc JOIN contacts c ON c.id = cc.contact_id AND c.deleted_at IS NULL
              WHERE lower(split_part(c.email,'@',2)) = v_dom
        UNION SELECT d.company_id FROM deals d JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
              WHERE d.deleted_at IS NULL AND lower(split_part(c.email,'@',2)) = v_dom
      ) x JOIN companies co ON co.id = x.company_id AND co.deleted_at IS NULL);
    IF cardinality(v_firmen_dom) = 1 THEN
      v_firma := v_firmen_dom[1]; v_weg := 'b_domain';
    ELSIF cardinality(v_firmen_dom) > 1 THEN
      v_firmen_name := ARRAY(
        SELECT DISTINCT x.company_id FROM (
          SELECT cc.company_id, c.first_name, c.last_name FROM contacts c JOIN company_contacts cc ON cc.contact_id = c.id
          WHERE c.deleted_at IS NULL AND lower(split_part(c.email,'@',2)) = v_dom
          UNION SELECT d.company_id, c.first_name, c.last_name FROM contacts c JOIN deals d ON d.primary_contact_id = c.id AND d.deleted_at IS NULL
          WHERE c.deleted_at IS NULL AND lower(split_part(c.email,'@',2)) = v_dom AND d.company_id IS NOT NULL
        ) x JOIN companies co ON co.id = x.company_id AND co.deleted_at IS NULL
        WHERE btrim(x.first_name) <> '' AND btrim(x.last_name) <> ''
          AND lower(btrim(x.first_name))||' '||lower(btrim(x.last_name)) = lower(btrim(v_name)));
      IF cardinality(v_firmen_name) = 1 THEN
        v_firma := v_firmen_name[1]; v_weg := 'c_name';
      ELSE
        v_pruefen := true;
        v_pruef_grund := cardinality(v_firmen_dom)||' Firmen mit Domain '||v_dom||', Namensabgleich '||cardinality(v_firmen_name)||' Treffer';
      END IF;
    END IF;
  END IF;

  IF v_weg IS NULL AND NOT v_pruefen THEN
    v_pruefen := true;
    v_pruef_grund := 'keine Firma ermittelbar (Mail, Formular, Domain)';
  END IF;

  -- (e) Deal in der Firma bzw. Deal ohne Firma am Kontakt
  IF NOT v_pruefen THEN
    SELECT d.id INTO v_deal_id
    FROM deals d
    WHERE d.deleted_at IS NULL
      AND ( (v_firma IS NOT NULL AND d.company_id = v_firma)
         OR (d.primary_contact_id = ANY(v_kontakte) AND d.company_id IS NULL) )
    -- coalesce: ein Deal ohne Hauptkontakt ergibt sonst NULL, und NULL sortiert bei
    -- DESC zuerst. Genau so landete die Haidenhof-Buchung am 19.11. auf der
    -- kontaktlosen Import-Dublette 9b8d8089 statt auf 0a42adf0.
    ORDER BY coalesce(d.pipeline_id = v_bevorzugt, false) DESC,
             coalesce(d.pipeline_id IN (c_pipeline, c_vrs_pipeline), false) DESC,
             coalesce(d.status = 'open', false) DESC,
             coalesce(d.primary_contact_id = ANY(v_kontakte), false) DESC,
             (SELECT max(a.created_at) FROM deal_activities a
               WHERE a.deal_id = d.id AND a.activity_type = 'email' AND a.deleted_at IS NULL) DESC NULLS LAST,
             d.created_at DESC
    LIMIT 1;
  END IF;
  v_stift_domain := v_weg = 'b_domain'
                    AND EXISTS (SELECT 1 FROM deals d WHERE d.id = v_deal_id AND d.pipeline_id = c_stift_pipeline);

  -- Eindeutiger Kontakt bei mehreren Kontakten derselben Adresse:
  -- Hauptkontakt des Deals, dann an der Firma, dann der aelteste.
  SELECT c.id INTO v_contact_id FROM contacts c
  WHERE c.id = ANY(v_kontakte)
  ORDER BY (c.id = (SELECT d.primary_contact_id FROM deals d WHERE d.id = v_deal_id)) DESC NULLS LAST,
           EXISTS (SELECT 1 FROM company_contacts cc WHERE cc.contact_id = c.id AND cc.company_id = v_firma) DESC,
           c.created_at, c.id
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    IF NOT v_ist_wr THEN
      BEGIN
        INSERT INTO deal_activities(deal_id,contact_id,activity_type,title,description,due_date,status,owner_user_id,metadata)
        VALUES (NULL, v_contact_id,'meeting','📅 '||v_title||' (Cal.com, ausserhalb WerteRaum)',
          'Cal.com-Buchung ohne Bezug zur WerteRaum-Kampagne. Kontakt wurde angelegt, aber KEIN Deal in der Schulpipeline.'||
          E'\nTeilnehmer: '||coalesce(v_name,'?')||' <'||v_email||'>'||E'\nStart: '||coalesce(v_start::text,'?')||
          E'\nEventTypeId: '||coalesce(v_evt,'?')||E'\nUID: '||coalesce(v_uid,'?'),
          v_start,'open',c_owner,
          jsonb_build_object('cal_uid',v_uid,'trigger',v_trigger,
                             'source','cal-inbound','ausserhalb_kampagne',true,'event_type_id',v_evt))
        RETURNING id INTO v_activity_id;
      EXCEPTION WHEN unique_violation THEN
        SELECT id INTO v_activity_id FROM deal_activities
         WHERE deleted_at IS NULL
           AND coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid') = v_uid LIMIT 1;
        RETURN jsonb_build_object('ok', true, 'status','ok','duplicate',true,
                                  'activity_id',v_activity_id,'cal_uid',v_uid,'race',true);
      END;
      RETURN jsonb_build_object('ok', false, 'status','kein_werteraum_event','contact_id',v_contact_id,
        'new_contact',v_new_contact,'activity_id',v_activity_id,'event_type_id',v_evt,
        'attendee_email',v_email,'attendee_name',v_name,
        'hinweis','Kontakt angelegt, kein Deal. Buchung gehoert nicht zur WerteRaum-Kampagne.');
    END IF;

    -- Das FORMULAR hat Vorrang: der Buchende weiss, welche Schule er vertritt.
    -- Die Ableitung ueber den Kontakt ist der Rueckfall — sie greift bei einem
    -- neuen cal-inbound-Kontakt ohnehin nie.
    -- ⚠ count(DISTINCT) statt count(*) OVER (): Fensterfunktionen sind in
    -- HAVING verboten (42P20). Genau dieser Fehler liess die Funktion vom
    -- 14. bis 17.09. scheitern und kostete eine Buchung.
    -- Baustufe 2c-3: Firma aus der Zuordnung oben (NULL bei "Zuordnung prüfen").
    v_company_id := v_firma;

    -- Baustufe 2c: Armins Event legt neue Deals in "Viktoria Rebensburg - Schulen"
    -- an, sobald diese Pipeline aktiv ist; bis dahin wie bisher in WerteRaum.
    -- Umschalten beim Umzug allein ueber pipelines.is_active.
    v_neu_pipeline := c_pipeline;
    v_neu_stage    := c_stage;
    IF v_evt = '6945548'
       AND EXISTS (SELECT 1 FROM pipelines WHERE id = c_vrs_pipeline AND is_active) THEN
      SELECT ps.id INTO v_termin_stage FROM pipeline_stages ps
       WHERE ps.pipeline_id = c_vrs_pipeline AND ps.name = 'Terminiert';
      IF v_termin_stage IS NOT NULL THEN
        v_neu_pipeline := c_vrs_pipeline;
        v_neu_stage    := v_termin_stage;
      END IF;
    END IF;

    INSERT INTO deals(title,pipeline_id,pipeline_stage_id,primary_contact_id,company_id,owner_user_id,source,status,projektleiter_user_id)
    VALUES (CASE WHEN v_pruefen THEN 'Zuordnung prüfen: ' ELSE '' END || coalesce(v_name,v_email)||' — Erstgespräch', v_neu_pipeline, v_neu_stage, v_contact_id, v_company_id, c_owner, 'cal-inbound','open',v_projektleiter)
    RETURNING id INTO v_deal_id;
    v_new_deal := true;
    v_pl_gesetzt := v_projektleiter IS NOT NULL;

    IF v_pruefen THEN
      INSERT INTO intake_unzugeordnet(eingang_at, absender, betreff, typ, grund, message_id, status,
                                      zugeordnet_contact_id, zugeordnet_deal_id, notiz)
      VALUES (now(), v_email, v_title, 'cal_buchung', 'cal_booking_intake: '||v_pruef_grund,
              'cal:'||coalesce(v_uid, gen_random_uuid()::text), 'offen',
              v_contact_id, v_deal_id,
              'Buchung von '||coalesce(v_name,'?')||', Start '||coalesce(v_start::text,'?')||
              ', Formular: '||coalesce(v_f_schule,'-')||'. Deal vorlaeufig angelegt, bitte Firma zuordnen.')
      ON CONFLICT (message_id) WHERE message_id IS NOT NULL DO NOTHING;
    END IF;
  ELSE
    SELECT ps.id, ps.name, ps.position, coalesce(ps.is_won_stage,false), coalesce(ps.is_lost_stage,false),
           d.pipeline_id, d.lost_reason
      INTO v_alte_stage_id, v_alte_stage, v_alte_pos, v_alt_won, v_alt_lost, v_deal_pipeline, v_lost_reason_vorher
    FROM deals d JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    WHERE d.id = v_deal_id;

    -- Baustufe 2c-2: Eine Buchung setzt die Stufe nur VORWAERTS.
    -- Gewonnen/Verloren ueber is_won_stage/is_lost_stage (wie sync_deal_status_from_stage),
    -- Terminiert und Angebot erstellt ueber pipeline_id des Deals + Name, nie feste Stufen-ID.
    --   keine Stufe "Terminiert" in der Pipeline -> unveraendert, WARNING
    --   Gewonnen                                 -> unveraendert, nur Meeting
    --   Verloren in WR / VRS                     -> set_deal_reopen auf Terminiert
    --   Verloren in jeder anderen Pipeline       -> unveraendert + pruefen + intake-Zeile
    --   Blacklist / Blocked                      -> unveraendert + pruefen + intake-Zeile
    --   Terminiert / Angebot erstellt            -> unveraendert, nur Meeting
    --   Position < Terminiert                    -> Terminiert
    --   jede andere Stufe dahinter               -> unveraendert + pruefen + intake-Zeile
    -- Ersetzt den Stiftungs-Sonderweg (feste ID 2a52e33e, Position < 4). Stiftungs-Deals
    -- weiter unabhaengig vom Event, alle anderen nur bei WR-Event.
    IF v_ist_wr OR v_deal_pipeline = c_stift_pipeline THEN
      SELECT ps.id, ps.position INTO v_termin_stage, v_termin_pos FROM pipeline_stages ps
       WHERE ps.pipeline_id = v_deal_pipeline AND ps.name = 'Terminiert';
      IF v_termin_stage IS NULL THEN
        v_termin_fehlt := true;
        v_stufe_regel  := 'keine_terminiert_stufe';
        RAISE WARNING 'cal_booking_intake: Deal % (Pipeline %) hat keine Stufe "Terminiert" - Stufe bleibt', v_deal_id, v_deal_pipeline;
      ELSIF v_alt_won THEN
        v_stufe_regel := 'gewonnen_unveraendert';
      ELSIF v_alt_lost THEN
        IF v_deal_pipeline IN ('61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid,
                               'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid) THEN
          PERFORM set_deal_reopen(v_deal_id, v_termin_stage);
          v_stage_geaendert := true;
          v_stufe_regel     := 'verloren_wiedereroeffnet';
        ELSE
          v_stufe_pruefen := true;
          v_stufe_regel   := 'verloren_unveraendert';
          v_stufe_grund   := 'Buchung an verlorenem Deal ausserhalb WR/VRS - Stufe "'||v_alte_stage||'" bleibt';
        END IF;
      ELSIF v_alte_stage IN ('Blacklist','Blocked') THEN
        v_stufe_pruefen := true;
        v_stufe_regel   := 'gesperrt_unveraendert';
        v_stufe_grund   := 'Buchung an Deal in Stufe "'||v_alte_stage||'" - Stufe bleibt';
      ELSIF v_alte_stage_id = v_termin_stage OR v_alte_stage = 'Angebot erstellt' THEN
        v_stufe_regel := 'unveraendert';
      ELSIF v_alte_pos < v_termin_pos THEN
        UPDATE deals SET pipeline_stage_id = v_termin_stage, updated_at = now()
        WHERE id = v_deal_id;
        v_stage_geaendert := true;
        v_stufe_regel     := 'vorwaerts';
      ELSE
        v_stufe_pruefen := true;
        v_stufe_regel   := 'hinter_terminiert_unveraendert';
        v_stufe_grund   := 'Buchung an Deal in Stufe "'||v_alte_stage||'" hinter Terminiert - Stufe bleibt';
      END IF;
    END IF;

    IF v_stufe_pruefen THEN
      INSERT INTO intake_unzugeordnet(eingang_at, absender, betreff, typ, grund, message_id, status,
                                      zugeordnet_contact_id, zugeordnet_deal_id, notiz)
      VALUES (now(), v_email, v_title, 'cal_buchung', 'cal_booking_intake: '||v_stufe_grund,
              'cal:'||coalesce(v_uid, gen_random_uuid()::text), 'offen',
              v_contact_id, v_deal_id,
              'Buchung von '||coalesce(v_name,'?')||', Start '||coalesce(v_start::text,'?')||
              '. Stufe unveraendert. Bitte pruefen, ob der Termin stattfinden soll und wo der Deal hingehoert.')
      ON CONFLICT (message_id) WHERE message_id IS NOT NULL DO NOTHING;
    END IF;

    -- Baustufe 2c: Projektleiter nur setzen, wenn leer. Kein Stufenwechsel ->
    -- die Stufen-Trigger (OLD.stage = NEW.stage) feuern nicht.
    IF v_projektleiter IS NOT NULL THEN
      UPDATE deals SET projektleiter_user_id = v_projektleiter
      WHERE id = v_deal_id AND projektleiter_user_id IS NULL;
      v_pl_gesetzt := FOUND;
    END IF;
  END IF;

  BEGIN
    INSERT INTO deal_activities(deal_id,contact_id,activity_type,title,description,due_date,status,owner_user_id,metadata)
    VALUES (
      v_deal_id, v_contact_id,'meeting','📅 '||v_title||' (Cal.com)',
      'Cal.com Buchung'||E'\n'||'Teilnehmer: '||coalesce(v_name,'?')||' <'||v_email||'>'||E'\n'||
        'Start: '||coalesce(v_start::text,'?')||E'\n'||'Ende: '||coalesce(v_end::text,'?')||E'\n'||'UID: '||coalesce(v_uid,'?')||
        CASE WHEN v_stage_geaendert THEN E'\nStage von "'||coalesce(v_alte_stage,'?')||'" auf "Terminiert".' ELSE '' END ||
        CASE WHEN v_stufe_regel = 'verloren_wiedereroeffnet' THEN E'\nDeal war verloren'||coalesce(' (Grund: '||v_lost_reason_vorher||')','')||' und wurde wieder geoeffnet.' ELSE '' END ||
        CASE WHEN v_stufe_regel IN ('unveraendert','gewonnen_unveraendert') THEN E'\nStufe "'||coalesce(v_alte_stage,'?')||'" bleibt, Termin nur angehaengt.' ELSE '' END ||
        CASE WHEN v_stufe_pruefen THEN E'\n⚠ STUFE PRUEFEN: '||v_stufe_grund||'. Zeile in intake_unzugeordnet.' ELSE '' END ||
        CASE WHEN v_pruefen THEN E'\n⚠ ZUORDNUNG PRUEFEN: '||v_pruef_grund||' — Deal vorlaeufig ohne Firma angelegt, Zeile in intake_unzugeordnet.' ELSE '' END ||
        CASE WHEN v_termin_fehlt THEN E'\n⚠ Die Pipeline des Deals hat keine Stufe "Terminiert" — Stufe unveraendert, bitte von Hand pruefen.' ELSE '' END ||
        CASE WHEN v_f_schule IS NOT NULL THEN
          E'\n\nIM BUCHUNGSFORMULAR ANGEGEBEN:'||E'\nSchule: '||v_f_schule||
          coalesce(E'\nOrt: '||v_f_ort,'')||
          CASE WHEN (v_treffer->>'treffer')::int = 1
               THEN E'\n-> Firma zugeordnet: '||coalesce(v_treffer->>'name','?')
               WHEN (v_treffer->>'treffer')::int > 1
               THEN E'\n⚠ '||(v_treffer->>'treffer')||' Firmen passen — keine zugeordnet, bitte von Hand pruefen.'
               ELSE E'\n⚠ Keine passende Firma im Bestand — bitte anlegen oder von Hand zuordnen.' END
        ELSE E'\n\n⚠ KEINE SCHULE IM FORMULAR ANGEGEBEN. Sind die Pflichtfelder in cal.com gesetzt?' END,
      v_start,'open',c_owner,
      jsonb_build_object('cal_uid',v_uid,'trigger',v_trigger,
                         'source','cal-inbound','stage_vorher',v_alte_stage,'booker_name',v_name,
                         'starts_at',v_start,'event_type_id',v_evt,
                         'formular_schule',v_f_schule,'formular_ort',v_f_ort,
                         -- Alle Schulfelder, nicht nur der Gewinner: Armins
                         -- Event hat zwei, und wenn sie auseinandergehen,
                         -- soll das sichtbar sein statt still zu verschwinden.
                         'schulfelder_alle',v_formular->'schulfelder_alle',
                         'firma_treffer',v_treffer,
                         -- B13: ueber welchen Weg der Deal gefunden wurde,
                         -- damit die Wirkung des Fixes zaehlbar ist.
                         'deal_gefunden_ueber',
                           CASE WHEN v_new_deal THEN 'neu_angelegt'
                                WHEN v_firma_formular IS NOT NULL THEN 'formular_firma_oder_kontakt'
                                ELSE 'kontakt' END,
                         'projektleiter_gesetzt',v_pl_gesetzt,
                         'terminiert_fehlt',v_termin_fehlt,
                         'zuordnung_weg',coalesce(v_weg,'pruefen'),
                         'zuordnung_pruefen',(v_pruefen OR v_stufe_pruefen),
                         'stufe_regel',v_stufe_regel,
                         'lost_reason_vorher',v_lost_reason_vorher,
                         'firmen_mail',cardinality(v_firmen_mail),
                         'firmen_domain',cardinality(v_firmen_dom))
    )
    RETURNING id INTO v_activity_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_activity_id FROM deal_activities
     WHERE deleted_at IS NULL
       AND coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid') = v_uid LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'status','ok','duplicate',true,
                              'activity_id',v_activity_id,'cal_uid',v_uid,'race',true);
  END;

  IF v_ist_wr THEN
    UPDATE contacts SET outreach_status = 'terminated', updated_at = now()
    WHERE id = v_contact_id AND coalesce(outreach_status,'') <> 'terminated';
  END IF;

  RETURN jsonb_build_object('ok', true, 'status','ok','contact_id',v_contact_id,'deal_id',v_deal_id,
    'activity_id',v_activity_id,'new_contact',v_new_contact,'new_deal',v_new_deal,'duplicate',false,
    'company_id',v_company_id,'firma_formular',v_firma_formular,
    'stage_vorher',v_alte_stage,'stage_geaendert',v_stage_geaendert,'werteraum_event',v_ist_wr,
    'attendee_name',v_name,'attendee_email',v_email,'start_time',v_start,
    'stiftung_domain_match',v_stift_domain,'deal_pipeline',v_deal_pipeline,
    'neu_angelegt_in',v_neu_pipeline,'projektleiter_user_id',v_projektleiter,
    'projektleiter_gesetzt',v_pl_gesetzt,'terminiert_fehlt',v_termin_fehlt,
    'zuordnung_weg',coalesce(v_weg,'pruefen'),'zuordnung_pruefen',(v_pruefen OR v_stufe_pruefen),'firma',v_firma,
    'stufe_regel',v_stufe_regel);
END;
$function$
;
