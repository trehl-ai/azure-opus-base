-- Baustufe 2b, Pipeline "Viktoria Rebensburg - Schulen" (ffcb34b3)
-- Die beiden Stufennamen-Trigger, die per pg_net eine WerteRaum-Mail ausloesen,
-- feuern nur noch fuer Deals in "Werteraum - Schulen" (61b1b7e2).
--   notify_second_mailing_scheduled   ("2. Mailing")      -> n8n uEBTJ2SFjkBZLB25
--   notify_erneutes_mailing_scheduled ("Erneutes Mailing") -> n8n eCglxZGdJbJ1dMZW
-- Die F&A-Sperre vom 27.10. (Kampagne 11da18f2) und die Sperre vom 22.09.
-- (2nd_mailing bereits sent) bleiben zusaetzlich erhalten.
-- Signatur, SECURITY DEFINER, search_path, Trigger-Definitionen und Grants unveraendert
-- (CREATE OR REPLACE behaelt proacl). notify_werteraum_infos_versenden nicht angefasst.

CREATE OR REPLACE FUNCTION public.notify_second_mailing_scheduled()
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

  -- 23.11.2026 (Baustufe 2b): nur Deals in "Werteraum - Schulen". Die Pipeline
  -- "Viktoria Rebensburg - Schulen" (ffcb34b3) hat ebenfalls eine Stufe "2. Mailing";
  -- ein Wechsel dorthin darf keine WerteRaum-Mail ausloesen.
  IF NEW.pipeline_id IS DISTINCT FROM '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_stage_name
  FROM pipeline_stages
  WHERE id = NEW.pipeline_stage_id;

  IF v_stage_name != '2. Mailing' THEN
    RETURN NEW;
  END IF;

  -- 22.09.2026: Ist das Nachfass-Mailing schon versendet, wird kein Webhook gefeuert.
  -- Der n8n-Webhook plant per Upsert (merge-duplicates) und haette ein versendetes
  -- Mailing auf pending zurueckgesetzt -> zweite Nachfassmail an die Schule.
  -- Trifft jeden Drag im Board nach "2. Mailing" (auch durch TT).
  IF EXISTS (SELECT 1 FROM scheduled_mailings sm
             WHERE sm.deal_id = NEW.id
               AND sm.mailing_type = '2nd_mailing'
               AND sm.status = 'sent') THEN
    RETURN NEW;
  END IF;

  -- 27.10.2026: Deals mit Fit-&-Aktiv-Erstmail (viktoria-roadshow.com) bekommen keine
  -- WerteRaum-Nachfrage. Sie haben nie eine WerteRaum-Mail erhalten; 10 solche
  -- Nachfragen gingen am 23., 26. und 27.10. raus.
  IF EXISTS (
    SELECT 1 FROM deal_activities a
    WHERE a.deal_id = NEW.id
      AND a.campaign_id = '11da18f2-9ea8-4950-9d2a-42416f0aef39'
      AND a.activity_type = 'email'
      AND a.deleted_at IS NULL
  ) THEN
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
$function$;

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

  -- 23.11.2026 (Baustufe 2b): nur Deals in "Werteraum - Schulen". Die Pipeline
  -- "Viktoria Rebensburg - Schulen" (ffcb34b3) hat heute keine Stufe "Erneutes Mailing";
  -- die Sperre gilt vorsorglich fuer jede andere Pipeline mit diesem Stufennamen.
  IF NEW.pipeline_id IS DISTINCT FROM '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid THEN
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
