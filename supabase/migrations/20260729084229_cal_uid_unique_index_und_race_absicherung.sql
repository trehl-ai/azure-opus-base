-- applied out-of-band via MCP am 2026-07-29, backfill
-- Quelle: supabase_migrations.schema_migrations, Version 20260729084229
-- md5 des Rumpfs unterhalb dieses Kopfes == DB: 0fa2f7c6349e984418237f93631252d4

-- Race-Absicherung fuer die zwei Cal.com-Webhook-Pfade.
-- Cal.com feuert beide quasi zeitgleich (am 29.07. lagen 72 ms zwischen den Aktivitaeten).
-- Die reine SELECT-Pruefung in der RPC reicht dann nicht: beide Transaktionen koennen lesen,
-- bevor die erste committet. Der Unique-Index schliesst das hart aus, der EXCEPTION-Handler
-- verwandelt die Kollision in ein sauberes duplicate:true statt HTTP 500 an Cal.com.
CREATE UNIQUE INDEX IF NOT EXISTS deal_activities_cal_uid_uidx
  ON public.deal_activities ((coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid')))
  WHERE deleted_at IS NULL
    AND coalesce(metadata->>'cal_uid', metadata->>'calcom_booking_uid') IS NOT NULL;

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

    INSERT INTO deals(title,pipeline_id,pipeline_stage_id,primary_contact_id,owner_user_id,source,status)
    VALUES (coalesce(v_name,v_email)||' — Erstgespräch', c_pipeline, c_stage, v_contact_id, c_owner, 'cal-inbound','open')
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
    -- Der andere Webhook-Pfad war schneller. Kein Fehler, nur eine Dublette.
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
    'stage_vorher',v_alte_stage,'stage_geaendert',v_stage_geaendert,'werteraum_event',v_ist_wr,
    'attendee_name',v_name,'attendee_email',v_email,'start_time',v_start);
END;
$function$;;