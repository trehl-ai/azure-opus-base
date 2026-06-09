-- Migration: 20260609101144_add_trigger_2nd_mailing_webhook
-- Backfilled from supabase_migrations.schema_migrations on project ttgvhqygmgtnjgwunuwz.
-- Originally applied out-of-band via Supabase MCP apply_migration (2026-06-09);
-- recorded here so schema-drift-check CI reconciles repo vs live DB.


-- Funktion: ruft n8n Webhook auf wenn Deal auf "2. Mailing" Stage gesetzt wird
CREATE OR REPLACE FUNCTION notify_second_mailing_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_name text;
  v_contact_id uuid;
BEGIN
  -- Nur bei Stage-Änderungen
  IF OLD.pipeline_stage_id = NEW.pipeline_stage_id THEN
    RETURN NEW;
  END IF;

  -- Stage-Name der neuen Stage prüfen
  SELECT name INTO v_stage_name
  FROM pipeline_stages
  WHERE id = NEW.pipeline_stage_id;

  IF v_stage_name != '2. Mailing' THEN
    RETURN NEW;
  END IF;

  -- Contact-ID holen
  v_contact_id := NEW.primary_contact_id;

  -- n8n Webhook via pg_net aufrufen
  PERFORM net.http_post(
    url := 'https://n8n.ts-connect.cloud/webhook/werteraum-schedule-2nd-mailing',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object(
      'deal_id', NEW.id,
      'contact_id', v_contact_id
    )::text
  );

  RETURN NEW;
END;
$$;

-- Trigger auf deals Tabelle
DROP TRIGGER IF EXISTS trg_second_mailing_scheduled ON deals;
CREATE TRIGGER trg_second_mailing_scheduled
  AFTER UPDATE OF pipeline_stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_second_mailing_scheduled();
