-- Trigger: fires when a deal moves to "Infos versenden" in Werteraum - Schulen
-- Stage ID: cea6539e-7041-4017-8288-da0555914153
-- Pipeline ID: 61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e
--
-- HISTORICAL NOTE:
-- Diese Migration wurde ursprünglich 2026-05-19 08:09 UTC direkt auf
-- die Produktiv-DB via Lovable-Bypass appliziert mit halluzinierten
-- Spaltennamen (NEW.stage_id, OLD.stage_id, NEW.name). Konsequenz:
-- alle UPDATEs auf deals failten — Issue #60. Folge-Migration
-- 20260519082000_fix_notify_werteraum_infos_versenden_columns hat
-- die Function via CREATE OR REPLACE korrigiert (PR #62).
--
-- Diese Repo-Datei wurde 2026-05-19 nachgereicht (PR #6X), enthält
-- aber direkt die korrigierte Function-Definition — damit auf einem
-- frischen `supabase db reset` der korrekte End-Zustand mit einem
-- statt zwei Schritten erreicht wird. Die spätere Fix-Migration
-- bleibt idempotent (gleiche CREATE OR REPLACE) und brichts nicht.

CREATE OR REPLACE FUNCTION public.notify_werteraum_infos_versenden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
BEGIN
  IF (NEW.pipeline_stage_id = 'cea6539e-7041-4017-8288-da0555914153'::uuid
      AND (OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id)) THEN

    PERFORM net.http_post(
      url := 'https://n8n.ts-connect.cloud/webhook/eic-werteraum-infos-versenden',
      headers := '{"Content-Type": "application/json"}'::jsonb,
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

DROP TRIGGER IF EXISTS trg_werteraum_infos_versenden ON deals;

CREATE TRIGGER trg_werteraum_infos_versenden
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION notify_werteraum_infos_versenden();
