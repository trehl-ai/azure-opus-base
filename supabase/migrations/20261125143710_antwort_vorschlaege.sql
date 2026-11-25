-- Antwort-Assistent Phase 1 (25.11.2026)
-- Vorschlaege zu Rueckmeldungen: Claude/Review legt sie an (vorschlag_anlegen, nur service_role),
-- ein Mensch entscheidet mit einem Klick in "Zu erledigen" (vorschlag_entscheiden).
-- Der Anlegeweg kann NIE bestaetigen; bestaetigen kann nur, wer den Deal sehen darf
-- (admin alle; sonst zustaendig = coalesce(projektleiter, owner) und user_can_access_pipeline).

-- 1. Tabelle ---------------------------------------------------------------------------------
CREATE TABLE public.antwort_vorschlaege (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid NOT NULL REFERENCES public.deals(id),
  reply_activity_id uuid REFERENCES public.deal_activities(id),
  art               text NOT NULL
                    CHECK (art IN ('verloren','wiedervorlage','einzelmail','adresse','keine_aktion')),
  begruendung       text NOT NULL CHECK (btrim(begruendung) <> ''),
  lost_reason       text,
  wiedervorlage_am  date,
  einzelmail_id     uuid REFERENCES public.einzelmailings(id),
  neue_email        text,
  status            text NOT NULL DEFAULT 'offen'
                    CHECK (status IN ('offen','bestaetigt','geaendert','abgelehnt')),
  erstellt_von      text NOT NULL CHECK (btrim(erstellt_von) <> ''),
  created_at        timestamptz NOT NULL DEFAULT now(),
  entschieden_von   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  entschieden_am    timestamptz,
  -- Begruendung der Entscheidung: Pflicht bei 'abgelehnt', gefuellt bei 'geaendert'.
  entscheidung_grund text,
  -- Pflichtfelder je Art
  CONSTRAINT antwort_vorschlaege_verloren_grund
    CHECK (art <> 'verloren' OR (lost_reason IS NOT NULL AND btrim(lost_reason) <> '')),
  CONSTRAINT antwort_vorschlaege_wiedervorlage_datum
    CHECK (art <> 'wiedervorlage' OR wiedervorlage_am IS NOT NULL),
  CONSTRAINT antwort_vorschlaege_einzelmail_id
    CHECK (art <> 'einzelmail' OR einzelmail_id IS NOT NULL),
  CONSTRAINT antwort_vorschlaege_adresse_email
    CHECK (art <> 'adresse' OR (neue_email IS NOT NULL AND btrim(neue_email) <> '')),
  -- offen <=> noch nicht entschieden
  CONSTRAINT antwort_vorschlaege_entschieden
    CHECK ((status = 'offen') = (entschieden_am IS NULL)),
  CONSTRAINT antwort_vorschlaege_grund_bei_entscheidung
    CHECK (status NOT IN ('abgelehnt','geaendert')
           OR (entscheidung_grund IS NOT NULL AND btrim(entscheidung_grund) <> ''))
);

CREATE UNIQUE INDEX antwort_vorschlaege_ein_offener_je_deal
  ON public.antwort_vorschlaege (deal_id) WHERE status = 'offen';

ALTER TABLE public.antwort_vorschlaege ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.antwort_vorschlaege FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.antwort_vorschlaege TO service_role;

-- 2. Anlegen (nur service_role; legt IMMER 'offen' an, bestaetigt nie) ----------------------------
CREATE OR REPLACE FUNCTION public.vorschlag_anlegen(
  p_deal_id           uuid,
  p_art               text,
  p_begruendung       text,
  p_erstellt_von      text,
  p_reply_activity_id uuid DEFAULT NULL,
  p_lost_reason       text DEFAULT NULL,
  p_wiedervorlage_am  date DEFAULT NULL,
  p_einzelmail_id     uuid DEFAULT NULL,
  p_neue_email        text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM deals d WHERE d.id = p_deal_id AND d.deleted_at IS NULL AND d.status = 'open') THEN
    RETURN jsonb_build_object('ok', false, 'status', 'deal_nicht_offen', 'detail', NULL);
  END IF;
  IF p_reply_activity_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM deal_activities a WHERE a.id = p_reply_activity_id AND a.deal_id = p_deal_id) THEN
    RETURN jsonb_build_object('ok', false, 'status', 'antwort_gehoert_nicht_zum_deal', 'detail', NULL);
  END IF;
  IF p_einzelmail_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM einzelmailings e WHERE e.id = p_einzelmail_id AND e.deal_id = p_deal_id) THEN
    RETURN jsonb_build_object('ok', false, 'status', 'einzelmail_gehoert_nicht_zum_deal', 'detail', NULL);
  END IF;

  INSERT INTO antwort_vorschlaege (deal_id, reply_activity_id, art, begruendung, lost_reason,
                                   wiedervorlage_am, einzelmail_id, neue_email, erstellt_von)
  VALUES (p_deal_id, p_reply_activity_id, p_art, p_begruendung, nullif(btrim(p_lost_reason), ''),
          p_wiedervorlage_am, p_einzelmail_id, nullif(lower(btrim(p_neue_email)), ''), p_erstellt_von)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'status', 'angelegt', 'detail', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'status', 'schon_ein_offener_vorschlag', 'detail', NULL);
  WHEN check_violation OR not_null_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('ok', false, 'status', 'ungueltig', 'detail', SQLERRM);
END
$fn$;

-- 3. Offene Vorschlaege, die der Aufrufer sehen darf ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vorschlaege_offen()
 RETURNS TABLE(vorschlag_id uuid, deal_id uuid, deal_title text, art text, begruendung text,
               lost_reason text, wiedervorlage_am date, einzelmail_id uuid, neue_email text,
               reply_activity_id uuid, erstellt_von text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  SELECT v.id, v.deal_id, d.title, v.art, v.begruendung, v.lost_reason, v.wiedervorlage_am,
         v.einzelmail_id, v.neue_email, v.reply_activity_id, v.erstellt_von, v.created_at
  FROM antwort_vorschlaege v
  JOIN deals d ON d.id = v.deal_id AND d.deleted_at IS NULL
  WHERE v.status = 'offen'
    AND (public.is_admin()
         OR (public.user_can_access_pipeline(d.pipeline_id)
             AND coalesce(d.projektleiter_user_id, d.owner_user_id) = auth.uid()))
  ORDER BY v.created_at;
$fn$;

-- 4. Entscheiden ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vorschlag_entscheiden(
  p_id          uuid,
  p_aktion      text,
  p_lost_reason text DEFAULT NULL,
  p_datum       date DEFAULT NULL,
  p_grund       text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v       antwort_vorschlaege%ROWTYPE;
  d       deals%ROWTYPE;
  v_user  uuid;
  v_name  text;
  v_neu   text;            -- bestaetigt | geaendert | abgelehnt
  v_det   text;
  v_egrund text;           -- entscheidung_grund (abgelehnt / geaendert)
  v_reason text;
  v_datum date;
  v_stage uuid;
  v_res   jsonb;
  k       record;
BEGIN
  SELECT * INTO v FROM antwort_vorschlaege WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'nicht_gefunden', 'detail', NULL);
  END IF;
  SELECT * INTO d FROM deals WHERE id = v.deal_id;

  -- Dieselbe Sichtbarkeit wie get_vorschlaege_offen, sonst 42501.
  IF NOT (coalesce(public.is_admin(), false)
          OR (public.user_can_access_pipeline(d.pipeline_id)
              AND coalesce(d.projektleiter_user_id, d.owner_user_id) = auth.uid())) THEN
    RAISE EXCEPTION 'vorschlag_entscheiden: kein Zugriff' USING ERRCODE = '42501';
  END IF;

  IF v.status <> 'offen' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'schon_entschieden', 'detail', v.status);
  END IF;
  IF p_aktion NOT IN ('bestaetigen','ablehnen') THEN
    RETURN jsonb_build_object('ok', false, 'status', 'unbekannte_aktion', 'detail', p_aktion);
  END IF;

  SELECT u.id, btrim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,''))
    INTO v_user, v_name FROM users u WHERE u.id = auth.uid();

  BEGIN  -- Teiltransaktion: jeder Fehler unten nimmt ALLE Aenderungen dieses Aufrufs zurueck.
    IF p_aktion = 'ablehnen' THEN
      IF p_grund IS NULL OR btrim(p_grund) = '' THEN
        RETURN jsonb_build_object('ok', false, 'status', 'grund_fehlt', 'detail', NULL);
      END IF;
      v_neu := 'abgelehnt';
      v_egrund := btrim(p_grund);
      v_det := 'Grund: ' || v_egrund;

    ELSIF v.art = 'verloren' THEN
      IF d.status <> 'open' OR d.deleted_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 'deal_nicht_offen', 'detail', d.status);
      END IF;
      v_reason := coalesce(nullif(btrim(p_lost_reason), ''), v.lost_reason);
      SELECT ps.id INTO v_stage FROM pipeline_stages ps
       WHERE ps.pipeline_id = d.pipeline_id AND ps.is_lost_stage
       ORDER BY (ps.name = 'Verloren') DESC, ps.position LIMIT 1;
      IF v_stage IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 'keine_verloren_stufe', 'detail', NULL);
      END IF;
      PERFORM public.set_deal_lost(d.id, v_stage, v_reason);
      v_neu := CASE WHEN v_reason IS DISTINCT FROM v.lost_reason THEN 'geaendert' ELSE 'bestaetigt' END;
      IF v_neu = 'geaendert' THEN
        v_egrund := coalesce(nullif(btrim(p_grund), ''), 'Verlustgrund geaendert: ' || v_reason);
      END IF;
      v_det := 'Deal verloren, Grund: ' || v_reason;

    ELSIF v.art = 'wiedervorlage' THEN
      v_datum := coalesce(p_datum, v.wiedervorlage_am);
      IF v_datum <= (now() AT TIME ZONE 'Europe/Berlin')::date THEN
        RETURN jsonb_build_object('ok', false, 'status', 'datum_nicht_in_der_zukunft', 'detail', v_datum);
      END IF;
      UPDATE deals SET wiedervorlage_am = v_datum WHERE id = d.id;
      v_neu := CASE WHEN v_datum IS DISTINCT FROM v.wiedervorlage_am THEN 'geaendert' ELSE 'bestaetigt' END;
      IF v_neu = 'geaendert' THEN
        v_egrund := coalesce(nullif(btrim(p_grund), ''), 'Datum geaendert: ' || to_char(v_datum, 'DD.MM.YYYY'));
      END IF;
      v_det := 'Wiedervorlage ab ' || to_char(v_datum, 'DD.MM.YYYY');

    ELSIF v.art = 'einzelmail' THEN
      IF NOT coalesce(public.is_admin(), false) THEN
        RETURN jsonb_build_object('ok', false, 'status', 'einzelmail_nur_admin', 'detail', NULL);
      END IF;
      v_res := public.einzelmail_freigeben(v.einzelmail_id);
      IF NOT coalesce((v_res ->> 'ok')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'status', 'einzelmail_' || coalesce(v_res ->> 'status', 'fehler'), 'detail', NULL);
      END IF;
      v_neu := 'bestaetigt';
      v_det := 'Einzelmail freigegeben (' || v.einzelmail_id || ')';

    ELSIF v.art = 'adresse' THEN
      -- korrigiere_mailadresse setzt den Deal auf die Quellstufe zurueck und kann eine neue
      -- Erstmail ausloesen. Bei laufendem Gespraech (Antwort vorhanden oder Aktionsstufe) nie.
      IF EXISTS (SELECT 1 FROM deal_activities r
                  WHERE r.deal_id = d.id AND r.deleted_at IS NULL AND r.activity_type = 'email_reply')
         OR EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.id = d.pipeline_stage_id AND ps.braucht_aktion) THEN
        RETURN jsonb_build_object('ok', false, 'status', 'adresse_bei_laufendem_gespraech', 'detail', NULL);
      END IF;
      SELECT * INTO k FROM public.korrigiere_mailadresse(d.id, v.neue_email, 'vorschlag ' || v.id);
      IF k.ergebnis NOT IN ('KORRIGIERT','KORRIGIERT_OHNE_VERSAND') THEN
        RETURN jsonb_build_object('ok', false, 'status', 'adresse_' || lower(coalesce(k.ergebnis, 'fehler')), 'detail', k.hinweis);
      END IF;
      v_neu := 'bestaetigt';
      v_det := 'Adresse ' || coalesce(k.email_alt, '?') || ' -> ' || k.email_neu || ' (' || k.ergebnis || '). ' || coalesce(k.hinweis, '');

    ELSE  -- keine_aktion
      v_neu := 'bestaetigt';
      v_det := 'Keine Aktion';
    END IF;

    UPDATE antwort_vorschlaege
       SET status = v_neu, entschieden_von = v_user, entschieden_am = now(), entscheidung_grund = v_egrund
     WHERE id = v.id;

    INSERT INTO deal_activities (deal_id, activity_type, title, description, owner_user_id, created_by_user_id, metadata)
    VALUES (d.id, 'note',
            'Vorschlag ' || CASE v_neu WHEN 'abgelehnt' THEN 'abgelehnt' WHEN 'geaendert' THEN 'geändert bestätigt' ELSE 'bestätigt' END
              || ': ' || v.art,
            'Vorschlag (' || v.erstellt_von || '): ' || v.begruendung || E'\n'
              || 'Entscheidung: ' || v_neu || ' durch ' || coalesce(nullif(v_name, ''), coalesce(auth.uid()::text, 'unbekannt')) || E'\n'
              || v_det
              || CASE WHEN v_egrund IS NOT NULL AND v_neu = 'geaendert' THEN E'\n' || 'Begruendung: ' || v_egrund ELSE '' END,
            v_user, v_user,
            jsonb_build_object('vorschlag_id', v.id, 'art', v.art, 'entscheidung', v_neu));
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'status', 'fehler', 'detail', SQLERRM);
  END;

  RETURN jsonb_build_object('ok', true, 'status', v_neu, 'detail', v_det);
END
$fn$;

-- 5. Rechte --------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.vorschlag_anlegen(uuid, text, text, text, uuid, text, date, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_vorschlaege_offen()                                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vorschlag_entscheiden(uuid, text, text, date, text)                   FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vorschlag_anlegen(uuid, text, text, text, uuid, text, date, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_vorschlaege_offen()                                               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vorschlag_entscheiden(uuid, text, text, date, text)                   TO authenticated;
