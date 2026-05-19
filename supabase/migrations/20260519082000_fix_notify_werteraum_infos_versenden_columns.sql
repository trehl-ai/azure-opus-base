-- Fix Issue #60: Deal-Stage kann nicht zurückgesetzt werden
--
-- Die heute morgen 2026-05-19 08:09 UTC deployte Migration
-- `20260519080922_werteraum_infos_versenden_webhook_trigger` (direkt auf
-- Produktiv-DB ohne Repo-PR appliziert, vermutlich via Lovable oder
-- Dashboard) referenziert in der Trigger-Function `notify_werteraum_infos_versenden`
-- Spaltennamen die auf `public.deals` nicht existieren:
--
--   NEW.stage_id   → muss NEW.pipeline_stage_id heißen
--   OLD.stage_id   → muss OLD.pipeline_stage_id heißen
--   NEW.name       → muss NEW.title heißen
--
-- Konsequenz: JEDE UPDATE-Operation auf `deals` schlägt mit
-- "record \"new\" has no field \"stage_id\"" fehl — Kanban-Board ist
-- de facto read-only, Stage-Reset (Wiedervorlage → Infomaterial)
-- gemeldet als Issue #60.
--
-- Fix: CREATE OR REPLACE FUNCTION mit den korrekten Spaltennamen.
-- Trigger selbst bleibt identisch (gleicher Name, gleiches Timing,
-- gleiche Tabelle).

CREATE OR REPLACE FUNCTION public.notify_werteraum_infos_versenden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
BEGIN
  -- Fire only when pipeline_stage_id changes TO "Infos versenden"
  -- (Stage ID: cea6539e-7041-4017-8288-da0555914153,
  --  Pipeline: Werteraum - Schulen, 61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e)
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
