-- Backfilled from supabase_migrations.schema_migrations (applied out-of-band via Lovable/Dashboard).
-- Version 20260612073607 — exact statements as recorded in the live DB. Already applied; present for repo/drift-check parity.

-- Trigger-Funktion für "Erneutes Mailing"
CREATE OR REPLACE FUNCTION public.notify_erneutes_mailing_scheduled()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $function$
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

  IF v_stage_name != 'Erneutes Mailing' THEN
    RETURN NEW;
  END IF;

  v_contact_id := NEW.primary_contact_id;

  PERFORM net.http_post(
    url := 'https://n8n.ts-connect.cloud/webhook/werteraum-erneutes-mailing',
    body := json_build_object(
      'deal_id', NEW.id,
      'contact_id', v_contact_id
    )::jsonb
  );

  RETURN NEW;
END;
$function$;

-- Trigger auf deals
CREATE TRIGGER trg_erneutes_mailing_scheduled
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_erneutes_mailing_scheduled();
