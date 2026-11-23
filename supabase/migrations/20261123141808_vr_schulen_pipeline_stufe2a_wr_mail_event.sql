-- Baustufe 2a, Pipeline "Viktoria Rebensburg - Schulen" (ffcb34b3)
-- wr_mail_event verbucht Antworten und Bounces auch fuer Deals in der neuen Pipeline.
--
-- Uebergangsfaehig: ein F&A-Deal kann in "Werteraum - Schulen" (heute) ODER schon in
-- "Viktoria Rebensburg - Schulen" (nach dem Umzug) liegen. Beide Pipelines werden in
-- EINER Suche mit derselben Sortierung (created_at) durchsucht. Damit trifft die
-- Funktion nach dem Umzug denselben Deal wie vorher, als beide noch in WR lagen.
-- Stiftungen bleibt der Fallback wie bisher.
--
-- Zielstufe nicht mehr als feste ID, sondern als "Stufe mit diesem Namen in der
-- Pipeline des gefundenen Deals" (pipeline_id + name). Schwelle = Position dieser
-- Zielstufe statt fester Zahl. Gemessen 23.11.: WR "Antwort erhalten" pos 7 (ce17aedc),
-- VRS "Antwort erhalten" pos 7 (ae11b0dc), Stiftungen "Wiedervorlage" pos 3 (a79ab374)
-- -> fuer WR und Stiftungen identisch zu den bisherigen Literalen 7 und 3.
-- Fehlt die Zielstufe (oder ist der Name in der Pipeline nicht eindeutig): Antwort
-- wird trotzdem geloggt, Stufe bleibt, 'aktion' nennt die Luecke (Telegram zeigt
-- 'aktion'), zusaetzlich RAISE WARNING. Keine stille Annahme, kein Verlust der Antwort.
--
-- Signatur, Rueckgabe-Schluessel, SECURITY DEFINER, search_path unveraendert.
-- Grants bewusst NICHT angefasst (CREATE OR REPLACE behaelt proacl).

CREATE OR REPLACE FUNCTION public.wr_mail_event(p_email text, p_typ text, p_subject text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_grund text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_wr          constant uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'; -- Werteraum - Schulen
  c_vr_schulen  constant uuid := 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'; -- Viktoria Rebensburg - Schulen
  c_stiftungen  constant uuid := '341c067d-39fe-46ae-82c7-33d6c55a2a60'; -- Viktoria Rebensburg - Stiftungen
  v_contact_id  uuid;
  v_deal_id     uuid;
  v_pipeline_id uuid;
  v_stage_pos   int;
  v_activity_id uuid;
  v_aktion      text := 'logged';
  v_typ         text := p_typ;
  v_degradiert  boolean := false;
  v_stiftung    boolean := false;
  v_ziel_name   text;
  v_ziel_id     uuid;
  v_ziel_pos    int;
  v_ziel_n      int;
  v_praefix     text;
BEGIN
  IF p_typ NOT IN ('hard_bounce','soft_bounce','reply','ooo') THEN
    RETURN json_build_object('ok', false, 'fehler', 'unbekannter typ: ' || coalesce(p_typ,'null'));
  END IF;

  -- HAERTUNG: reply -> ooo, wenn das Subject ein maschinelles Autoreply-Praefix traegt.
  IF p_typ = 'reply' AND p_subject IS NOT NULL THEN
    IF btrim(regexp_replace(p_subject, '^((AW|RE|WG|FW|FWD)\s*:\s*)+', '', 'i')) ~*
       '^(automatische antwort|automatic reply|autoreply|auto-reply|automatische eingangsbest|abwesenheit|abwesenheitsnotiz|out of office|out-of-office|ooo|urlaubsmeldung|auto\s*:)'
    THEN
      v_typ        := 'ooo';
      v_degradiert := true;
    END IF;
  END IF;

  SELECT c.id INTO v_contact_id
  FROM contacts c
  WHERE lower(c.email) = lower(btrim(p_email)) AND c.deleted_at IS NULL
  ORDER BY c.created_at
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RETURN json_build_object('ok', false, 'fehler', 'kontakt nicht gefunden', 'email', p_email);
  END IF;

  -- NEU 23.11.2026 (Baustufe 2a): Schulen-Deals in WR ODER in der neuen VR-Schulen-Pipeline.
  -- Eine Suche ueber beide, aeltester Deal zuerst = dieselbe Wahl wie vor dem Umzug.
  SELECT d.id, ps.position, d.pipeline_id INTO v_deal_id, v_stage_pos, v_pipeline_id
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  WHERE d.primary_contact_id = v_contact_id
    AND d.deleted_at IS NULL
    AND d.pipeline_id IN (c_wr, c_vr_schulen)
  ORDER BY d.created_at
  LIMIT 1;

  -- NEU 06.11.2026: Fallback Stiftungs-Pipeline (VR Fit & Aktiv — Stiftungen).
  IF v_deal_id IS NULL THEN
    SELECT d.id, ps.position, d.pipeline_id INTO v_deal_id, v_stage_pos, v_pipeline_id
    FROM deals d
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    WHERE d.primary_contact_id = v_contact_id
      AND d.deleted_at IS NULL
      AND d.pipeline_id = c_stiftungen
    ORDER BY d.created_at
    LIMIT 1;
    IF v_deal_id IS NOT NULL THEN
      v_stiftung := true;
    END IF;
  END IF;

  IF v_deal_id IS NULL THEN
    RETURN json_build_object('ok', false, 'fehler', 'kein WerteRaum-Deal zum Kontakt',
                             'contact_id', v_contact_id);
  END IF;

  IF v_typ IN ('hard_bounce','soft_bounce') THEN
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'bounce',
            CASE WHEN v_typ = 'hard_bounce' THEN 'Hard Bounce' ELSE 'Soft Bounce' END,
            coalesce(p_grund,'') , 'completed', true,
            json_build_object('typ', v_typ, 'subject', p_subject)::jsonb, now())
    RETURNING id INTO v_activity_id;

    UPDATE contacts
    SET bounce_at = now(), bounce_typ = v_typ, bounce_grund = p_grund,
        outreach_status = CASE WHEN v_typ = 'hard_bounce' THEN 'bounced'
                               ELSE outreach_status END
    WHERE id = v_contact_id;

    v_aktion := CASE WHEN v_typ = 'hard_bounce' THEN 'kontakt gesperrt' ELSE 'soft bounce vermerkt' END;

  ELSIF v_typ = 'reply' THEN
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'email_reply',
            coalesce(p_subject,'Antwort erhalten'), coalesce(p_body,''),
            'completed', true, json_build_object('quelle','imap_intake')::jsonb, now())
    RETURNING id INTO v_activity_id;

    UPDATE contacts SET outreach_status = 'replied'
    WHERE id = v_contact_id AND outreach_status NOT IN ('blocked_widerspruch','bounced');

    -- Zielstufe je Pipeline des gefundenen Deals, ueber pipeline_id + name (nie nur name).
    -- Stiftungs-Pipeline hat keine Stufe "Antwort erhalten": Antwort -> "Wiedervorlage"
    -- (wartet auf einen Menschen).
    v_ziel_name := CASE WHEN v_stiftung THEN 'Wiedervorlage' ELSE 'Antwort erhalten' END;
    v_praefix   := CASE WHEN v_stiftung THEN 'stiftung: ' ELSE '' END;

    SELECT count(*)::int, (array_agg(ps.id))[1], (array_agg(ps.position))[1]
      INTO v_ziel_n, v_ziel_id, v_ziel_pos
    FROM pipeline_stages ps
    WHERE ps.pipeline_id = v_pipeline_id
      AND ps.name = v_ziel_name;

    IF v_ziel_n <> 1 THEN
      v_aktion := v_praefix || 'ZIELSTUFE FEHLT: "' || v_ziel_name || '" in pipeline '
                  || v_pipeline_id::text || ' (' || v_ziel_n || ' treffer), antwort geloggt, stage unveraendert';
      RAISE WARNING 'wr_mail_event deal %: %', v_deal_id, v_aktion;
    ELSIF v_stage_pos < v_ziel_pos THEN
      UPDATE deals SET pipeline_stage_id = v_ziel_id,
                       updated_at = now()
      WHERE id = v_deal_id;
      v_aktion := v_praefix || 'stage -> ' || v_ziel_name;
    ELSE
      v_aktion := v_praefix || 'antwort geloggt, stage unveraendert';
    END IF;

  ELSE -- ooo (inkl. degradierter reply)
    INSERT INTO deal_activities (deal_id, contact_id, activity_type, title, description,
                                 status, auto_generated, metadata, completed_at)
    VALUES (v_deal_id, v_contact_id, 'note',
            CASE WHEN v_degradiert THEN 'Automatische Antwort (kein Kontakt)'
                 ELSE 'Abwesenheitsnotiz' END,
            coalesce(p_subject,''),
            'completed', true,
            json_build_object('typ','ooo','degradiert_von_reply', v_degradiert,
                              'subject', p_subject)::jsonb, now())
    RETURNING id INTO v_activity_id;
    v_aktion := CASE WHEN v_degradiert THEN 'reply als autoreply erkannt, stage unveraendert'
                     ELSE 'ooo ignoriert' END;
  END IF;

  RETURN json_build_object('ok', true, 'typ', v_typ, 'typ_uebergeben', p_typ,
                           'degradiert', v_degradiert, 'aktion', v_aktion,
                           'contact_id', v_contact_id, 'deal_id', v_deal_id,
                           'activity_id', v_activity_id, 'stiftung', v_stiftung);
END
$function$;
