-- Backfill. Applied out-of-band via MCP am 2026-07-28.
-- Diese Datei re-applied nichts Neues; sie holt die bereits live in ttgvhqygmgtnjgwunuwz
-- angewendete Migration in das Repo nach, damit CI drift-check gruen bleibt.
-- Quelle: supabase_migrations.schema_migrations, version 20260728180015 (verbatim).

-- Cal.com-Buchung setzt den WerteRaum-Deal auf "Terminiert".
-- Einziger automatischer Weg in diese Stage. Telefonische Termine setzt TT manuell im Kanban.
-- Idempotent ueber booking_uid: mehrfache Webhook-Zustellung erzeugt keine Dubletten.
CREATE OR REPLACE FUNCTION public.set_werteraum_termin(
  p_email        text,
  p_booking_uid  text,
  p_starts_at    timestamptz DEFAULT NULL,
  p_booker_name  text        DEFAULT NULL,
  p_titel        text        DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline   uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';  -- Werteraum - Schulen
  v_terminiert uuid := '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6';  -- Stage "Terminiert"
  v_contact    uuid;
  v_deal       uuid;
  v_alte_stage text;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'keine_email');
  END IF;

  -- Bereits verarbeitet? (Webhook-Wiederholung)
  IF EXISTS (SELECT 1 FROM deal_activities
              WHERE deleted_at IS NULL
                AND metadata->>'calcom_booking_uid' = p_booking_uid) THEN
    RETURN jsonb_build_object('ok', true, 'grund', 'bereits_verarbeitet',
                              'booking_uid', p_booking_uid);
  END IF;

  SELECT c.id INTO v_contact
  FROM contacts c
  WHERE c.deleted_at IS NULL AND lower(c.email) = lower(btrim(p_email))
  ORDER BY c.created_at
  LIMIT 1;

  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kontakt_nicht_gefunden', 'email', p_email);
  END IF;

  -- WerteRaum-Deal des Kontakts: Primaerkontakt bevorzugt, sonst ueber die Firma
  SELECT d.id INTO v_deal
  FROM deals d
  WHERE d.deleted_at IS NULL AND d.pipeline_id = v_pipeline
    AND (d.primary_contact_id = v_contact
         OR d.company_id IN (SELECT cc.company_id FROM company_contacts cc WHERE cc.contact_id = v_contact))
  ORDER BY (d.primary_contact_id = v_contact) DESC, d.created_at
  LIMIT 1;

  IF v_deal IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_werteraum_deal',
                              'email', p_email, 'contact_id', v_contact);
  END IF;

  SELECT ps.name INTO v_alte_stage
  FROM deals d JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  WHERE d.id = v_deal;

  -- pipeline_id und pipeline_stage_id gemeinsam setzen (FK deals_stage_matches_pipeline)
  UPDATE deals
  SET pipeline_id = v_pipeline, pipeline_stage_id = v_terminiert, updated_at = now()
  WHERE id = v_deal;

  INSERT INTO deal_activities (deal_id, contact_id, activity_type, status, title, description, metadata)
  VALUES (
    v_deal, v_contact, 'meeting', 'completed',
    coalesce(p_titel, 'Termin gebucht via Cal.com'),
    'Cal.com-Buchung' ||
      coalesce(' von ' || p_booker_name, '') ||
      coalesce(' am ' || to_char(p_starts_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI'), '') ||
      '. Stage von "' || coalesce(v_alte_stage, 'unbekannt') || '" auf "Terminiert".',
    jsonb_build_object('calcom_booking_uid', p_booking_uid,
                       'starts_at', p_starts_at,
                       'booker_name', p_booker_name,
                       'stage_vorher', v_alte_stage)
  );

  UPDATE contacts SET outreach_status = 'terminated', updated_at = now()
  WHERE id = v_contact AND coalesce(outreach_status,'') <> 'terminated';

  RETURN jsonb_build_object('ok', true, 'deal_id', v_deal, 'contact_id', v_contact,
                            'stage_vorher', v_alte_stage, 'booking_uid', p_booking_uid);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_werteraum_termin(text,text,timestamptz,text,text) TO authenticated, service_role;