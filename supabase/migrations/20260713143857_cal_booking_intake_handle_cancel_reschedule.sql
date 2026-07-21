CREATE OR REPLACE FUNCTION public.cal_booking_intake(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_pipeline constant uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  c_stage    constant uuid := '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6';
  c_owner    constant uuid := '47a6442b-6840-4787-bae3-477a90490c1c';
  v_trigger text := upper(coalesce(p_payload->>'triggerEvent','BOOKING_CREATED'));
  v_pl   jsonb  := coalesce(p_payload->'payload','{}'::jsonb);
  v_email text := lower(nullif(trim(v_pl#>>'{attendees,0,email}'),''));
  v_name  text := nullif(trim(v_pl#>>'{attendees,0,name}'),'');
  v_uid   text := nullif(v_pl->>'uid','');
  v_title text := coalesce(nullif(v_pl->>'title',''), nullif(v_pl->>'type',''), 'Cal.com Termin');
  v_start timestamptz := coalesce(nullif(v_pl->>'startTime','')::timestamptz, nullif(v_pl->>'start_time','')::timestamptz);
  v_end   timestamptz := coalesce(nullif(v_pl->>'endTime','')::timestamptz,   nullif(v_pl->>'end_time','')::timestamptz);
  v_first text; v_last text;
  v_contact_id uuid; v_new_contact boolean := false;
  v_deal_id uuid;    v_new_deal boolean := false;
  v_activity_id uuid; v_dup boolean := false;
BEGIN
  INSERT INTO webhook_log(source, event_type, payload, received_at)
  VALUES ('cal.com', v_trigger, p_payload, now());

  IF v_trigger = 'PING' THEN
    RETURN jsonb_build_object('status','ping');
  END IF;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('status','no_email','logged',true);
  END IF;

  -- CANCELLED / REJECTED: bestehende Activity markieren, NIEMALS neu anlegen
  IF v_trigger IN ('BOOKING_CANCELLED','BOOKING_REJECTED') THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('status','cancel_no_uid','logged',true);
    END IF;
    UPDATE deal_activities
       SET status = 'completed',
           title  = CASE WHEN title LIKE '%[STORNIERT]%' THEN title ELSE '[STORNIERT] ' || title END,
           description = coalesce(description,'') || E'\n--- Storniert am ' || to_char(now(),'DD.MM.YYYY HH24:MI') || ' ---',
           updated_at = now()
     WHERE metadata->>'cal_uid' = v_uid
       AND title NOT LIKE '%[STORNIERT]%'
     RETURNING id INTO v_activity_id;
    RETURN jsonb_build_object('status','cancelled','activity_id',v_activity_id,
                              'found', v_activity_id IS NOT NULL, 'cal_uid', v_uid);
  END IF;

  -- RESCHEDULED: bestehende Activity umdatieren, NIEMALS neu anlegen
  IF v_trigger = 'BOOKING_RESCHEDULED' THEN
    IF v_uid IS NULL THEN
      RETURN jsonb_build_object('status','reschedule_no_uid','logged',true);
    END IF;
    UPDATE deal_activities
       SET due_date = coalesce(v_start, due_date),
           description = coalesce(description,'') || E'\n--- Verschoben auf ' || coalesce(to_char(v_start,'DD.MM.YYYY HH24:MI'),'?') || ' ---',
           updated_at = now()
     WHERE metadata->>'cal_uid' = v_uid
     RETURNING id INTO v_activity_id;
    IF v_activity_id IS NOT NULL THEN
      RETURN jsonb_build_object('status','rescheduled','activity_id',v_activity_id,'new_start',v_start);
    END IF;
    -- kein Treffer -> wie eine Neuanlage behandeln (faellt durch)
  END IF;

  -- Ab hier: BOOKING_CREATED (oder RESCHEDULED ohne bekannte Activity)
  v_first := split_part(coalesce(v_name,''),' ',1);
  v_last  := nullif(trim(substr(coalesce(v_name,''), length(split_part(coalesce(v_name,''),' ',1))+1)),'');
  IF v_first = '' THEN v_first := 'Cal.com'; END IF;
  IF v_last IS NULL THEN v_last := 'Gast'; END IF;

  -- Globale Idempotenz: existiert schon irgendeine Activity mit dieser cal_uid?
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_activity_id FROM deal_activities WHERE metadata->>'cal_uid' = v_uid LIMIT 1;
    IF v_activity_id IS NOT NULL THEN
      RETURN jsonb_build_object('status','ok','duplicate',true,'activity_id',v_activity_id,'cal_uid',v_uid);
    END IF;
  END IF;

  SELECT id INTO v_contact_id FROM contacts WHERE lower(email) = v_email AND deleted_at IS NULL LIMIT 1;
  IF v_contact_id IS NULL THEN
    INSERT INTO contacts(first_name,last_name,email,source,status,owner_user_id)
    VALUES (v_first, v_last, v_email, 'cal-inbound', 'lead', c_owner)
    RETURNING id INTO v_contact_id;
    v_new_contact := true;
  END IF;

  SELECT id INTO v_deal_id FROM deals
   WHERE primary_contact_id = v_contact_id AND deleted_at IS NULL
   ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  IF v_deal_id IS NULL THEN
    INSERT INTO deals(title,pipeline_id,pipeline_stage_id,primary_contact_id,owner_user_id,source,status)
    VALUES (coalesce(v_name,v_email)||' — Erstgespräch', c_pipeline, c_stage, v_contact_id, c_owner, 'cal-inbound','open')
    RETURNING id INTO v_deal_id;
    v_new_deal := true;
  END IF;

  INSERT INTO deal_activities(deal_id,activity_type,title,description,due_date,status,owner_user_id,metadata)
  VALUES (
    v_deal_id,'meeting','📅 '||v_title||' (Cal.com)',
    'Cal.com Buchung'||E'\n'||'Teilnehmer: '||coalesce(v_name,'?')||' <'||v_email||'>'||E'\n'||
      'Start: '||coalesce(v_start::text,'?')||E'\n'||'Ende: '||coalesce(v_end::text,'?')||E'\n'||'UID: '||coalesce(v_uid,'?'),
    v_start,'open',c_owner,
    jsonb_build_object('cal_uid',v_uid,'trigger',v_trigger,'source','cal-inbound')
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('status','ok','contact_id',v_contact_id,'deal_id',v_deal_id,
    'activity_id',v_activity_id,'new_contact',v_new_contact,'new_deal',v_new_deal,'duplicate',false,
    'attendee_name',v_name,'attendee_email',v_email,'start_time',v_start);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cal_booking_intake(jsonb) TO service_role;
