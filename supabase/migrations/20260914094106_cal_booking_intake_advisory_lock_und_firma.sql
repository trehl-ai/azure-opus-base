-- 14.09.2026: cal_booking_intake gegen den Webhook-Wettlauf absichern.
--
-- BEFUND, von Claude Code gemessen: Cal.com liefert JEDE Buchung an ZWEI
-- aktive n8n-Workflows, die beide diese Funktion rufen:
--   zdKzWw1JwmNTMG89 "EIC — Cal.com Buchung -> CRM", Pfad cal-booking
--   fzQkhnDHPjH974Dv "EIC — WerteRaum Cal.com Termin-Sync", Pfad
--     werteraum-calcom-termin
-- Abstand der Executions: 6 bzw. 7 Millisekunden. webhook_log traegt je zwei
-- Zeilen mit identischer Payload-md5. Cal.com hat zwei Abonnements.
--
-- DER FEHLER: Beide Aufrufe laufen parallel, sehen den Kontakt des anderen
-- noch nicht (nicht committet) und legen JE EINEN Kontakt und JE EINEN Deal
-- an. Erst beim Aktivitaets-INSERT greift deal_activities_cal_uid_uidx, der
-- Verlierer faengt die unique_violation und gibt duplicate:true zurueck.
-- ⚠ ABER: der BEGIN/EXCEPTION-Block umschliesst NUR den Aktivitaets-INSERT.
-- Kontakt und Deal davor bleiben stehen und werden committet.
-- Folge: zwei Buchungen, VIER Deals. Einer traegt die Aktivitaet und steht auf
-- terminated, der andere ist leer und bleibt auf pending — das UPDATE auf
-- outreach_status steht NACH dem Aktivitaetsblock und wird vom
-- Exception-Handler nie erreicht.
-- Betroffen: Alena Frank (10.09.), Detlef Baier (11.09.). Frueher gab es nur
-- ein Abonnement; das zweite wirkt erstmals am 10.09.
--
-- DIE REPARATUR: pg_advisory_xact_lock ueber die cal_uid, GANZ AM ANFANG.
-- Damit serialisieren sich Aufrufe zur selben Buchung. Der zweite wartet,
-- sieht dann die Aktivitaet des ersten und gibt duplicate:true zurueck, BEVOR
-- er Kontakt oder Deal anlegt.
-- ⚠ DAS BEHEBT DIE URSACHE UNABHAENGIG VOM ABONNEMENT. Auch wenn cal.com
-- spaeter wieder doppelt sendet oder ein dritter Workflow dazukommt, entsteht
-- kein zweiter Deal. Das doppelte Abonnement gehoert trotzdem entfernt — es
-- kostet zwei Executions je Buchung.
-- Die Sperre wird am Transaktionsende automatisch freigegeben. Jeder
-- PostgREST-Aufruf ist eine eigene Transaktion.
--
-- ZWEITE AENDERUNG, gleicher Anlass: DER DEAL BEKOMMT EINE FIRMA.
-- Die Funktion setzte nie company_id. Alle vier cal-inbound-Deals stehen ohne
-- Firma — und ein Deal ohne company_id ist fuer get_werteraum_candidates
-- unsichtbar (Befund vom selben Tag: 286 Deals waren so verschwunden).
-- Bei einem Terminvereinbarer ist das weniger schlimm, weil er nicht mehr
-- angeschrieben werden soll. Aber er erscheint in keiner Firmenauswertung.
-- NEU: existiert der Kontakt bereits und haengt an genau EINER lebenden Firma,
-- wird sie gesetzt. Bei null oder mehreren bleibt es NULL — raten waere
-- schlechter als leer lassen.

CREATE OR REPLACE FUNCTION public.cal_booking_intake(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_pipeline constant uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  c_stage    constant uuid := '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6';
  c_owner    constant uuid := '47a6442b-6840-4787-bae3-477a90490c1c';
  c_wr_event constant text := '5975343';
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
BEGIN
  INSERT INTO webhook_log(source, event_type, payload, received_at)
  VALUES ('cal.com', v_trigger, p_payload, now());

  IF v_trigger = 'PING' THEN
    RETURN jsonb_build_object('ok', true, 'status','ping');
  END IF;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status','no_email','logged',true);
  END IF;

  -- ⚠ DIE SPERRE. Serialisiert alle Aufrufe zur selben Buchung. Ohne sie legen
  -- zwei parallele Webhooks je einen Kontakt und je einen Deal an, bevor die
  -- Dublettenpruefung ueberhaupt greifen kann.
  IF v_uid IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('cal_booking:' || v_uid));
  END IF;

  v_ist_wr := (v_evt = c_wr_event) OR (v_title ILIKE '%werteraum%');

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

  SELECT d.id INTO v_deal_id
  FROM deals d
  WHERE d.deleted_at IS NULL
    AND (d.primary_contact_id = v_contact_id
         OR d.company_id IN (SELECT cc.company_id FROM company_contacts cc WHERE cc.contact_id = v_contact_id))
  ORDER BY (d.pipeline_id = c_pipeline) DESC,
           (d.primary_contact_id = v_contact_id) DESC,
           d.updated_at DESC NULLS LAST
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

    -- NEU: Firma uebernehmen, wenn der Kontakt an GENAU EINER lebenden haengt.
    -- Bei null oder mehreren bleibt es NULL — raten waere schlechter als leer.
    SELECT cc.company_id INTO v_company_id
    FROM company_contacts cc
    JOIN companies co ON co.id = cc.company_id AND co.deleted_at IS NULL
    WHERE cc.contact_id = v_contact_id
    GROUP BY cc.company_id
    HAVING count(*) OVER () = 1
    LIMIT 1;

    INSERT INTO deals(title,pipeline_id,pipeline_stage_id,primary_contact_id,company_id,owner_user_id,source,status)
    VALUES (coalesce(v_name,v_email)||' — Erstgespräch', c_pipeline, c_stage, v_contact_id, v_company_id, c_owner, 'cal-inbound','open')
    RETURNING id INTO v_deal_id;
    v_new_deal := true;
  ELSE
    SELECT ps.name INTO v_alte_stage
    FROM deals d JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    WHERE d.id = v_deal_id;

    IF v_ist_wr AND v_alte_stage IS DISTINCT FROM 'Terminiert' THEN
      UPDATE deals
      SET pipeline_id = c_pipeline, pipeline_stage_id = c_stage, updated_at = now()
      WHERE id = v_deal_id;
      v_stage_geaendert := true;
    END IF;
  END IF;

  BEGIN
    INSERT INTO deal_activities(deal_id,contact_id,activity_type,title,description,due_date,status,owner_user_id,metadata)
    VALUES (
      v_deal_id, v_contact_id,'meeting','📅 '||v_title||' (Cal.com)',
      'Cal.com Buchung'||E'\n'||'Teilnehmer: '||coalesce(v_name,'?')||' <'||v_email||'>'||E'\n'||
        'Start: '||coalesce(v_start::text,'?')||E'\n'||'Ende: '||coalesce(v_end::text,'?')||E'\n'||'UID: '||coalesce(v_uid,'?')||
        CASE WHEN v_stage_geaendert THEN E'\nStage von "'||coalesce(v_alte_stage,'?')||'" auf "Terminiert".' ELSE '' END,
      v_start,'open',c_owner,
      jsonb_build_object('cal_uid',v_uid,'trigger',v_trigger,
                         'source','cal-inbound','stage_vorher',v_alte_stage,'booker_name',v_name,
                         'starts_at',v_start,'event_type_id',v_evt)
    )
    RETURNING id INTO v_activity_id;
  EXCEPTION WHEN unique_violation THEN
    -- Erreichbar nur ohne cal_uid (dann greift die Sperre oben nicht).
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
    'company_id',v_company_id,
    'stage_vorher',v_alte_stage,'stage_geaendert',v_stage_geaendert,'werteraum_event',v_ist_wr,
    'attendee_name',v_name,'attendee_email',v_email,'start_time',v_start);
END;
$function$;

COMMENT ON FUNCTION public.cal_booking_intake(jsonb) IS
  'Nimmt Cal.com-Webhooks entgegen. Seit 14.09.2026 mit pg_advisory_xact_lock ueber die cal_uid am Anfang: Cal.com liefert jede Buchung an ZWEI n8n-Workflows, die 6 Millisekunden auseinander liefen und je einen Kontakt und einen Deal anlegten, bevor die Dublettenpruefung greifen konnte. Der bisherige EXCEPTION-Block umschloss nur den Aktivitaets-INSERT. Die Sperre behebt das unabhaengig davon, wie viele Abonnements cal.com hat. Der Deal uebernimmt ausserdem die Firma des Kontakts, wenn er an genau einer lebenden haengt — ein Deal ohne company_id ist fuer get_werteraum_candidates unsichtbar.';