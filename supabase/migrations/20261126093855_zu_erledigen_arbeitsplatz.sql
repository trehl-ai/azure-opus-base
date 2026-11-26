-- Zu erledigen als Arbeitsplatz (26.11.2026, go mit Auflagen 1-7)
-- Einzelmail bearbeiten / anlegen / Vorlage, Deal verloren setzen; get_einzelmails_offen um
-- Kontakt und Zustaendigkeit erweitert.
--
-- Rechte: Jede neue Funktion bekommt REVOKE ALL FROM PUBLIC, anon, authenticated, service_role
-- und danach ein ausdrueckliches GRANT. Beide Formen sind noetig: Funktionen tragen den
-- eingebauten EXECUTE-Default fuer PUBLIC UND per pg_default_acl eigene Eintraege fuer anon und
-- service_role (gemessen 15.10.2026).
--
-- Gemessen am 26.11.2026 vor dem Entwurf:
--  * Trigger trg_einzelmailing_freigabe setzt freigegeben -> entwurf nur, wenn text, betreff oder
--    email sich aendern. status 'fehler' fasst er nicht an.
--  * get_einzelmails_faellig_v2 versendet nur, wenn contacts.email (von contact_id) = einzelmailings.email.
--    Wer die Adresse wechselt, muss deshalb auch contact_id wechseln.
--  * Werteraum-Kampagne nach Bundesland des Hauptkontakts: Bayern -> 8c51eca8 (286/286 Deals),
--    sonst -> 34c7d3ee (2012/2012 Deals). Ohne Bundesland gibt es keinen Standard.
--  * 2 offene Deals in VR-Schulen haben als letzte Mail-Kampagne „WerteRaum 2.0“. Die letzte
--    Kampagne zaehlt deshalb nur, wenn sie zur Pipeline des Deals gehoert.

-- ---------------------------------------------------------------------------------------------
-- 0. Hilfsfunktion: Kampagne fuer eine neue Einzelmail (nur intern, kein GRANT)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.einzelmail_kampagne_fuer_deal(p_deal_id uuid, p_contact_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH d AS (SELECT * FROM deals WHERE id = p_deal_id),
  letzte AS (
    -- Letzte ausgehende Mail einer Kampagne DIESER Pipeline mit gueltiger Absender-Domain.
    SELECT a.campaign_id
      FROM deal_activities a
      JOIN campaigns k ON k.id = a.campaign_id
      JOIN d ON d.id = a.deal_id
     WHERE a.deleted_at IS NULL AND a.activity_type = 'email'
       AND k.pipeline_id = d.pipeline_id
       AND k.absender_domain IN ('werteraum-schule.de','viktoria-roadshow.com')
     ORDER BY a.created_at DESC
     LIMIT 1
  ),
  bl AS (
    SELECT coalesce(nullif(btrim(hk.bundesland), ''), nullif(btrim(gk.bundesland), '')) AS bundesland
      FROM d
      LEFT JOIN contacts hk ON hk.id = d.primary_contact_id
      LEFT JOIN contacts gk ON gk.id = p_contact_id
  )
  SELECT coalesce(
    (SELECT campaign_id FROM letzte),
    (SELECT CASE d.pipeline_id
              WHEN 'ffcb34b3-7fa6-48b2-986d-2705ed6f730b'::uuid           -- Viktoria Rebensburg - Schulen (F&A)
                THEN '11da18f2-9ea8-4950-9d2a-42416f0aef39'::uuid          -- VR Fit & Aktiv — Schulen
              WHEN '341c067d-39fe-46ae-82c7-33d6c55a2a60'::uuid           -- Viktoria Rebensburg - Stiftungen
                THEN 'c12ee0d1-5b66-4497-bfd3-73cdf1e19d94'::uuid          -- VR Fit & Aktiv — Stiftungen
              WHEN '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid           -- Werteraum - Schulen
                THEN CASE WHEN bl.bundesland = 'Bayern'
                            THEN '8c51eca8-8e2b-480d-8825-7329d57d166a'::uuid    -- WerteRaum 1.0 — Bayern
                          WHEN bl.bundesland IS NOT NULL
                            THEN '34c7d3ee-a90f-4d74-86f9-006579cc4e55'::uuid    -- WerteRaum 2.0 — Bundesweit
                     END
            END
       FROM d, bl)
  );
$function$;

REVOKE ALL ON FUNCTION public.einzelmail_kampagne_fuer_deal(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 1. einzelmail_bearbeiten
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.einzelmail_bearbeiten(p_id uuid, p_betreff text, p_text text, p_email text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e        einzelmailings%ROWTYPE;
  d        deals%ROWTYPE;
  v_kontakt uuid;
  v_email  text;
  v_name   text;
  v_neu    text;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'einzelmail_bearbeiten: nur admin' USING ERRCODE = '42501';
  END IF;
  IF p_betreff IS NULL OR btrim(p_betreff) = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'betreff_leer', 'detail', NULL);
  END IF;
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'text_leer', 'detail', NULL);
  END IF;

  SELECT * INTO e FROM einzelmailings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'nicht_gefunden', 'detail', NULL);
  END IF;
  IF e.status NOT IN ('entwurf','freigegeben','fehler') THEN
    RETURN jsonb_build_object('ok', false, 'status', 'nicht_bearbeitbar', 'detail', e.status);
  END IF;
  -- Auflage 26.11.: 'fehler' nur zurueck auf entwurf, wenn sicher nichts rausging.
  -- deal_activities bewusst OHNE deleted_at-Filter (vorsichtig).
  IF e.status = 'fehler' AND (
       e.message_id IS NOT NULL OR e.gesendet_am IS NOT NULL
       OR EXISTS (SELECT 1 FROM deal_activities a
                   WHERE a.deal_id = e.deal_id AND a.activity_type = 'email'
                     AND a.sequence_type = 'einzelmail'
                     AND a.created_at > coalesce(e.freigegeben_am, e.created_at))) THEN
    RETURN jsonb_build_object('ok', false, 'status', 'evtl_schon_gesendet', 'detail', NULL);
  END IF;

  SELECT * INTO d FROM deals WHERE id = e.deal_id;

  v_kontakt := e.contact_id;
  v_email   := e.email;
  IF p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    -- Nur eine Adresse, die einem Kontakt des Deals gehoert (Hauptkontakt oder Kontakt der Firma).
    -- contact_id wandert mit, sonst verweigert get_einzelmails_faellig_v2 den Versand.
    SELECT c.id, btrim(c.email) INTO v_kontakt, v_email
      FROM contacts c
     WHERE c.deleted_at IS NULL
       AND lower(btrim(c.email)) = lower(btrim(p_email))
       AND (c.id = d.primary_contact_id
            OR EXISTS (SELECT 1 FROM company_contacts cc
                        WHERE cc.company_id = d.company_id AND cc.contact_id = c.id))
     ORDER BY coalesce(c.id = d.primary_contact_id, false) DESC, c.created_at
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'email_nicht_am_deal', 'detail', btrim(p_email));
    END IF;
  END IF;

  IF btrim(p_betreff) = e.betreff AND p_text = e.text
     AND v_email = e.email AND v_kontakt = e.contact_id AND e.status <> 'fehler' THEN
    RETURN jsonb_build_object('ok', true, 'status', e.status, 'detail', 'unveraendert');
  END IF;

  SELECT btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,''))
    INTO v_name FROM users u WHERE u.id = auth.uid();

  BEGIN
    -- freigegeben -> entwurf erledigt der Trigger trg_einzelmailing_freigabe.
    -- fehler -> entwurf setzen wir selbst: einzelmail_freigeben nimmt nur Entwuerfe an.
    UPDATE einzelmailings
       SET betreff    = btrim(p_betreff),
           text       = p_text,
           email      = v_email,
           contact_id = v_kontakt,
           status     = CASE WHEN status = 'fehler' THEN 'entwurf' ELSE status END,
           hinweis    = concat_ws(E'\n', nullif(hinweis, ''),
                          'Bearbeitet ' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI')
                          || ' von ' || coalesce(nullif(v_name, ''), auth.uid()::text, 'unbekannt'))
     WHERE id = e.id
     RETURNING status INTO v_neu;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'status', 'schon_offene_einzelmail', 'detail', NULL);
  END;

  RETURN jsonb_build_object('ok', true, 'status', v_neu,
    'detail', CASE WHEN e.status <> 'entwurf' AND v_neu = 'entwurf'
                   THEN 'Freigabe zurückgesetzt – bitte erneut freigeben'
                   ELSE 'gespeichert' END);
END
$function$;

REVOKE ALL ON FUNCTION public.einzelmail_bearbeiten(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.einzelmail_bearbeiten(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. einzelmail_anlegen
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.einzelmail_anlegen(p_deal_id uuid, p_betreff text, p_text text, p_contact_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d         deals%ROWTYPE;
  v_kontakt uuid;
  v_email   text;
  v_kamp    uuid;
  v_id      uuid;
  v_offen   uuid;
  v_name    text;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'einzelmail_anlegen: nur admin' USING ERRCODE = '42501';
  END IF;
  IF p_betreff IS NULL OR btrim(p_betreff) = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'betreff_leer', 'detail', NULL);
  END IF;
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'text_leer', 'detail', NULL);
  END IF;

  SELECT * INTO d FROM deals WHERE id = p_deal_id FOR UPDATE;   -- serialisiert parallele Aufrufe je Deal
  IF NOT FOUND OR d.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'deal_nicht_gefunden', 'detail', NULL);
  END IF;
  IF d.status IS DISTINCT FROM 'open' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'deal_nicht_offen', 'detail', d.status);
  END IF;

  SELECT e.id INTO v_offen FROM einzelmailings e
   WHERE e.deal_id = d.id AND e.status IN ('entwurf','freigegeben','fehler') LIMIT 1;
  IF v_offen IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'schon_offene_einzelmail', 'detail', v_offen::text);
  END IF;

  IF p_contact_id IS NOT NULL THEN
    SELECT c.id, btrim(c.email) INTO v_kontakt, v_email
      FROM contacts c
     WHERE c.id = p_contact_id AND c.deleted_at IS NULL
       AND (c.id = d.primary_contact_id
            OR EXISTS (SELECT 1 FROM company_contacts cc
                        WHERE cc.company_id = d.company_id AND cc.contact_id = c.id));
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'kontakt_nicht_am_deal', 'detail', p_contact_id::text);
    END IF;
  ELSE
    SELECT c.id, btrim(c.email) INTO v_kontakt, v_email
      FROM contacts c WHERE c.id = d.primary_contact_id AND c.deleted_at IS NULL;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'kein_hauptkontakt', 'detail', NULL);
    END IF;
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'kontakt_ohne_email', 'detail', v_kontakt::text);
  END IF;

  v_kamp := public.einzelmail_kampagne_fuer_deal(d.id, v_kontakt);
  IF v_kamp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'keine_kampagne',
      'detail', 'Pipeline ohne Standardkampagne oder Bundesland fehlt');
  END IF;

  SELECT btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,''))
    INTO v_name FROM users u WHERE u.id = auth.uid();

  BEGIN
    -- absender_domain setzt trg_einzelmailing_domain aus der Kampagne.
    INSERT INTO einzelmailings (charge, reihenfolge, deal_id, contact_id, campaign_id, email,
                                betreff, text, hinweis, status)
    VALUES (NULL, 1, d.id, v_kontakt, v_kamp, v_email, btrim(p_betreff), p_text,
            'Angelegt ' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI')
              || ' von ' || coalesce(nullif(v_name, ''), auth.uid()::text, 'unbekannt') || ' (Zu erledigen)',
            'entwurf')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'status', 'schon_offene_einzelmail', 'detail', NULL);
  END;

  RETURN jsonb_build_object('ok', true, 'status', 'entwurf', 'detail', v_id::text);
END
$function$;

REVOKE ALL ON FUNCTION public.einzelmail_anlegen(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.einzelmail_anlegen(uuid, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. get_einzelmail_vorlage (lesend)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.get_einzelmail_vorlage(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d       deals%ROWTYPE;
  hk      contacts%ROWTYPE;
  v_kamp  uuid;
  v_res   jsonb;
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'get_einzelmail_vorlage: nur admin' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'deal_nicht_gefunden', 'detail', NULL);
  END IF;
  SELECT * INTO hk FROM contacts WHERE id = d.primary_contact_id AND deleted_at IS NULL;
  v_kamp := public.einzelmail_kampagne_fuer_deal(d.id, NULL);

  SELECT jsonb_build_object(
    'deal_id', d.id,
    'deal_status', d.status,
    'schule', coalesce(co.name, d.title),
    'stufe', ps.name,
    'pipeline', p.name,
    'contact_id', hk.id,
    'empfaenger', nullif(btrim(hk.email), ''),
    'kontakt_name', nullif(btrim(coalesce(hk.first_name,'') || ' ' || coalesce(hk.last_name,'')), ''),
    'anrede_vorschlag',
      CASE WHEN hk.anrede = 'Frau' AND nullif(btrim(hk.last_name), '') IS NOT NULL
             THEN 'Sehr geehrte Frau ' || btrim(hk.last_name) || ','
           WHEN hk.anrede = 'Herr' AND nullif(btrim(hk.last_name), '') IS NOT NULL
             THEN 'Sehr geehrter Herr ' || btrim(hk.last_name) || ','
           -- keine Person: Vor- oder Nachname leer oder Nachname ist eine Funktion/Stelle
           WHEN nullif(btrim(hk.first_name), '') IS NULL OR nullif(btrim(hk.last_name), '') IS NULL
                OR btrim(hk.last_name) ~* '(schulleitung|sekretariat|verwaltung|rektorat|poststelle|info|steuer|team|leitung)'
             THEN 'Sehr geehrte Damen und Herren,'
           ELSE 'Guten Tag ' || btrim(hk.first_name) || ' ' || btrim(hk.last_name) || ',' END,
    'campaign_id', v_kamp,
    'kampagne', k.name,
    'absender_domain', k.absender_domain,
    'zustaendig_id', coalesce(d.projektleiter_user_id, d.owner_user_id),
    'zustaendig_name', nullif(btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''),
    'offene_einzelmail_id', (SELECT e.id FROM einzelmailings e
                              WHERE e.deal_id = d.id AND e.status IN ('entwurf','freigegeben','fehler') LIMIT 1),
    'kontakte', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'contact_id', c.id,
               'name', nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
               'email', btrim(c.email),
               'hauptkontakt', coalesce(c.id = d.primary_contact_id, false),
               'anrede_vorschlag',
                 CASE WHEN c.anrede = 'Frau' AND nullif(btrim(c.last_name), '') IS NOT NULL
                        THEN 'Sehr geehrte Frau ' || btrim(c.last_name) || ','
                      WHEN c.anrede = 'Herr' AND nullif(btrim(c.last_name), '') IS NOT NULL
                        THEN 'Sehr geehrter Herr ' || btrim(c.last_name) || ','
                      -- keine Person: Vor- oder Nachname leer oder Nachname ist eine Funktion/Stelle
                      WHEN nullif(btrim(c.first_name), '') IS NULL OR nullif(btrim(c.last_name), '') IS NULL
                           OR btrim(c.last_name) ~* '(schulleitung|sekretariat|verwaltung|rektorat|poststelle|info|steuer|team|leitung)'
                        THEN 'Sehr geehrte Damen und Herren,'
                      ELSE 'Guten Tag ' || btrim(c.first_name) || ' ' || btrim(c.last_name) || ',' END)
             ORDER BY coalesce(c.id = d.primary_contact_id, false) DESC, c.last_name)
        FROM contacts c
       WHERE c.deleted_at IS NULL AND nullif(btrim(c.email), '') IS NOT NULL
         AND (c.id = d.primary_contact_id
              OR EXISTS (SELECT 1 FROM company_contacts cc
                          WHERE cc.company_id = d.company_id AND cc.contact_id = c.id))), '[]'::jsonb)
  ) INTO v_res
  FROM pipeline_stages ps
  JOIN pipelines p ON p.id = d.pipeline_id
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN campaigns k ON k.id = v_kamp
  LEFT JOIN users u ON u.id = coalesce(d.projektleiter_user_id, d.owner_user_id)
  WHERE ps.id = d.pipeline_stage_id;

  RETURN jsonb_build_object('ok', true, 'status', 'ok', 'detail', v_res);
END
$function$;

REVOKE ALL ON FUNCTION public.get_einzelmail_vorlage(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_einzelmail_vorlage(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. deal_verloren_setzen
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION public.deal_verloren_setzen(p_deal_id uuid, p_grund text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d        deals%ROWTYPE;
  v_grund  text := nullif(btrim(p_grund), '');
  v_stage  uuid;
  v_sname  text;
  v_user   uuid;
  v_name   text;
  v_status text;
  v_em     int;
BEGIN
  SELECT * INTO d FROM deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'nicht_gefunden', 'detail', NULL);
  END IF;

  -- Zugriff wie vorschlag_entscheiden: admin, sonst zustaendig (Projektleitung, sonst Owner)
  -- UND Zugriff auf die Pipeline.
  IF NOT (coalesce(public.is_admin(), false)
          OR (public.user_can_access_pipeline(d.pipeline_id)
              AND coalesce(d.projektleiter_user_id, d.owner_user_id) = auth.uid())) THEN
    RAISE EXCEPTION 'deal_verloren_setzen: kein Zugriff' USING ERRCODE = '42501';
  END IF;

  IF v_grund IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'grund_fehlt', 'detail', NULL);
  END IF;
  IF d.deleted_at IS NOT NULL OR d.status IS DISTINCT FROM 'open' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'deal_nicht_offen', 'detail', d.status);
  END IF;

  SELECT ps.id, ps.name INTO v_stage, v_sname FROM pipeline_stages ps
   WHERE ps.pipeline_id = d.pipeline_id AND ps.is_lost_stage
   ORDER BY (ps.name = 'Verloren') DESC, ps.position LIMIT 1;
  IF v_stage IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'keine_verloren_stufe', 'detail', NULL);
  END IF;

  SELECT u.id, btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,''))
    INTO v_user, v_name FROM users u WHERE u.id = auth.uid();

  BEGIN  -- Teiltransaktion: jeder Fehler nimmt alle Aenderungen dieses Aufrufs zurueck.
    PERFORM public.set_deal_lost(d.id, v_stage, v_grund);
    SELECT status INTO v_status FROM deals WHERE id = d.id;
    IF v_status IS DISTINCT FROM 'lost' THEN
      RAISE EXCEPTION 'set_deal_lost ohne Wirkung (status %)', v_status;
    END IF;

    -- Offene Einzelmail am Deal zurueckstellen; sonst laege sie unversendbar in der Freigabe-Karte.
    UPDATE einzelmailings
       SET status = 'zurueckgestellt',
           hinweis = concat_ws(E'\n', nullif(hinweis, ''),
                     'Zurueckgestellt ' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI')
                     || ': Deal verloren')
     WHERE deal_id = d.id AND status IN ('entwurf','freigegeben','fehler');
    GET DIAGNOSTICS v_em = ROW_COUNT;

    INSERT INTO deal_activities (deal_id, activity_type, title, description, status, auto_generated,
                                 owner_user_id, created_by_user_id, metadata)
    VALUES (d.id, 'note', 'Deal verloren',
            'Als verloren markiert von ' || coalesce(nullif(v_name, ''), auth.uid()::text, 'unbekannt') || E'\n'
              || 'Grund: ' || v_grund
              || CASE WHEN v_em > 0 THEN E'\n' || 'Offene Einzelmail zurückgestellt.' ELSE '' END,
            'completed', false, v_user, v_user,
            jsonb_build_object('quelle', 'deal_verloren_setzen', 'lost_stage_id', v_stage,
                               'einzelmail_zurueckgestellt', v_em));
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'status', 'fehler', 'detail', SQLERRM);
  END;

  RETURN jsonb_build_object('ok', true, 'status', 'lost', 'detail', v_sname);
END
$function$;

REVOKE ALL ON FUNCTION public.deal_verloren_setzen(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deal_verloren_setzen(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. get_einzelmails_offen: vier Spalten angehaengt (Rueckgabetyp aendert sich -> DROP + CREATE).
--    Rumpf und Rechte sonst wie bisher (authenticated + service_role, is_admin-Pruefung).
-- ---------------------------------------------------------------------------------------------
DROP FUNCTION public.get_einzelmails_offen();
CREATE FUNCTION public.get_einzelmails_offen()
 RETURNS TABLE(einzelmail_id uuid, status text, deal_id uuid, schule text, stufe text, empfaenger text,
               betreff text, text text, absender_domain text, kampagne text, hinweis text, kontext text,
               fehler text, reihenfolge integer, freigegeben_am timestamp with time zone,
               created_at timestamp with time zone,
               contact_id uuid, kontakt_name text, zustaendig_id uuid, zustaendig_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT coalesce(is_admin(), false) THEN
    RAISE EXCEPTION 'get_einzelmails_offen: nur admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.status, e.deal_id, coalesce(co.name, d.title), ps.name, e.email,
         e.betreff, e.text, e.absender_domain, k.name, e.hinweis, e.kontext,
         e.fehler, e.reihenfolge, e.freigegeben_am, e.created_at,
         e.contact_id,
         nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
         coalesce(d.projektleiter_user_id, d.owner_user_id),
         nullif(btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), '')
  FROM einzelmailings e
  JOIN deals d ON d.id = e.deal_id
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  LEFT JOIN campaigns k ON k.id = e.campaign_id
  LEFT JOIN contacts c ON c.id = e.contact_id
  LEFT JOIN users u ON u.id = coalesce(d.projektleiter_user_id, d.owner_user_id)
  WHERE e.status IN ('entwurf','freigegeben','fehler')
  ORDER BY CASE e.status WHEN 'fehler' THEN 0 WHEN 'entwurf' THEN 1 ELSE 2 END,
           e.reihenfolge, e.created_at;
END
$function$;

-- Rechte GENAU wie vor dem DROP (gemessen 26.11.2026 09:35Z: {postgres=X, service_role=X, authenticated=X}).
-- service_role wird bewusst NICHT entzogen.
REVOKE ALL ON FUNCTION public.get_einzelmails_offen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_einzelmails_offen() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
