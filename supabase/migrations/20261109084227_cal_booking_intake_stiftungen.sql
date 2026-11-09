-- 09.11.2026 cal_booking_intake: Stiftungs-Buchungen bleiben in der Stiftungs-Pipeline.
-- Befund: Stiftungen buchen ueber Armins F&A-Event 6945548 (cal_ist_werteraum_event = true).
-- (a) Bucht der angeschriebene Stiftungskontakt, zog die Funktion den Stiftungs-Deal in die
--     Schulpipeline (pipeline_id = 61b1b7e2, Stufe Terminiert).
-- (b) Bucht jemand mit anderer Adresse, entstand ein neuer "Erstgespraech"-Deal in der Schulpipeline;
--     der Stiftungs-Deal blieb in Qualifiziert/Infomaterial und waere weiter im Nachfass gewesen.
-- Fix: (a) Stiftungs-Deal bleibt in 341c067d, Stufe -> Terminiert (2a52e33e), falls position < 4.
--      (b) Rueckfall ueber die Absenderdomain (ohne Freemailer) auf GENAU einen offenen Stiftungs-Deal.
--      Alle anderen Pipelines: Verhalten unveraendert.
DO $patch$
DECLARE
  v_sig text := 'public.cal_booking_intake(jsonb)';
  v_def text;
  v_n int;
  r record;
BEGIN
  v_def := pg_get_functiondef(v_sig::regprocedure);
  IF position('c_stift_pipeline' IN v_def) > 0 THEN
    RAISE EXCEPTION 'Bereits gepatcht: %', v_sig;
  END IF;
  FOR r IN SELECT * FROM (VALUES
    (1,
     E'  v_firma_formular uuid;\nBEGIN\n',
     E'  v_firma_formular uuid;\n  -- 09.11.2026 Stiftungen\n  c_stift_pipeline constant uuid := ''341c067d-39fe-46ae-82c7-33d6c55a2a60'';\n  c_stift_termin   constant uuid := ''2a52e33e-00f1-4f4c-a138-213b144fd33c'';\n  v_deal_pipeline uuid;\n  v_stift_pos int;\n  v_stift_domain boolean := false;\nBEGIN\n'),
    (2,
     E'  LIMIT 1;\n\n  IF v_deal_id IS NULL THEN\n',
     E'  LIMIT 1;\n\n  -- 09.11.2026 Stiftungen: Bucht jemand mit einer anderen Adresse als der angeschriebenen,\n  -- ueber die Domain (keine Freemailer) GENAU einem offenen Stiftungs-Deal zuordnen.\n  IF v_deal_id IS NULL\n     AND split_part(v_email,''@'',2) NOT IN (''gmail.com'',''googlemail.com'',''web.de'',''gmx.de'',''gmx.net'',\n       ''t-online.de'',''outlook.com'',''outlook.de'',''hotmail.com'',''hotmail.de'',''live.de'',''live.com'',\n       ''yahoo.com'',''yahoo.de'',''icloud.com'',''me.com'',''aol.com'',''freenet.de'',''posteo.de'',\n       ''mailbox.org'',''arcor.de'',''online.de'',''email.de'',''protonmail.com'',''proton.me'') THEN\n    SELECT CASE WHEN count(DISTINCT d.id) = 1 THEN min(d.id::text)::uuid END\n      INTO v_deal_id\n    FROM deals d\n    JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL\n    WHERE d.deleted_at IS NULL AND d.status = ''open'' AND d.pipeline_id = c_stift_pipeline\n      AND lower(split_part(c.email,''@'',2)) = split_part(v_email,''@'',2);\n    v_stift_domain := v_deal_id IS NOT NULL;\n  END IF;\n\n  IF v_deal_id IS NULL THEN\n'),
    (3,
     E'    IF v_ist_wr AND v_alte_stage IS DISTINCT FROM ''Terminiert'' THEN\n      UPDATE deals\n      SET pipeline_id = c_pipeline, pipeline_stage_id = c_stage, updated_at = now()\n      WHERE id = v_deal_id;\n      v_stage_geaendert := true;\n    END IF;\n',
     E'    SELECT d.pipeline_id INTO v_deal_pipeline FROM deals d WHERE d.id = v_deal_id;\n    -- 09.11.2026: Stiftungs-Deals bleiben in ihrer Pipeline.\n    IF v_deal_pipeline = c_stift_pipeline THEN\n      SELECT ps.position INTO v_stift_pos\n      FROM deals d JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id\n      WHERE d.id = v_deal_id;\n      IF coalesce(v_stift_pos, 0) < 4 THEN\n        UPDATE deals SET pipeline_stage_id = c_stift_termin, updated_at = now()\n        WHERE id = v_deal_id;\n        v_stage_geaendert := true;\n      END IF;\n    ELSIF v_ist_wr AND v_alte_stage IS DISTINCT FROM ''Terminiert'' THEN\n      UPDATE deals\n      SET pipeline_id = c_pipeline, pipeline_stage_id = c_stage, updated_at = now()\n      WHERE id = v_deal_id;\n      v_stage_geaendert := true;\n    END IF;\n'),
    (4,
     E'''attendee_name'',v_name,''attendee_email'',v_email,''start_time'',v_start);\n',
     E'''attendee_name'',v_name,''attendee_email'',v_email,''start_time'',v_start,\n    ''stiftung_domain_match'',v_stift_domain,''deal_pipeline'',v_deal_pipeline);\n')
  ) AS t(nr, anker, ersatz) ORDER BY nr
  LOOP
    v_n := (length(v_def) - length(replace(v_def, r.anker, ''))) / length(r.anker);
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Anker % kommt % mal vor (Soll 1)', r.nr, v_n;
    END IF;
    v_def := replace(v_def, r.anker, r.ersatz);
  END LOOP;
  EXECUTE v_def;
END
$patch$;