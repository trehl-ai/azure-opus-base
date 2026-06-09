-- Fix net.http_post signature in both deal-stage trigger functions
-- body must be jsonb (not text), headers not needed (default Content-Type: application/json)

CREATE OR REPLACE FUNCTION notify_second_mailing_scheduled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_stage_name text;
  v_contact_id uuid;
BEGIN
  IF OLD.pipeline_stage_id = NEW.pipeline_stage_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_stage_name
  FROM pipeline_stages
  WHERE id = NEW.pipeline_stage_id;

  IF v_stage_name != '2. Mailing' THEN
    RETURN NEW;
  END IF;

  v_contact_id := NEW.primary_contact_id;

  PERFORM net.http_post(
    url := 'https://n8n.ts-connect.cloud/webhook/werteraum-schedule-2nd-mailing',
    body := json_build_object(
      'deal_id', NEW.id,
      'contact_id', v_contact_id
    )::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_werteraum_infos_versenden()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (NEW.pipeline_stage_id = 'cea6539e-7041-4017-8288-da0555914153'::uuid
      AND (OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id)) THEN

    PERFORM net.http_post(
      url := 'https://n8n.ts-connect.cloud/webhook/eic-werteraum-infos-versenden',
      body := json_build_object(
        'deal_id', NEW.id,
        'deal_name', NEW.title,
        'stage_id', NEW.pipeline_stage_id,
        'pipeline_id', NEW.pipeline_id,
        'primary_contact_id', NEW.primary_contact_id,
        'owner_user_id', NEW.owner_user_id,
        'triggered_at', now()
      )::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;
