-- 15.09.2026: termin_click_intake fuer die oeffentliche Route vorbereiten.
--
-- DREI AENDERUNGEN, alle aus der Messung von Claude Code:
--
-- 1. FALLBACK AUF campaigns.buchungslink, wenn p_ziel NULL ist.
-- ⚠ DER cal.com-LINK DARF NICHT IN DER ROUTE STEHEN. Genau dieser Fehler hat
-- auf viktoria-roadshow.com drei Monate lang ein 404 erzeugt: ein Bot setzte
-- einen Link ins Bundle, und niemand sah es. Die Quelle ist die Datenbank.
--
-- 2. GRANT EXECUTE FUER anon.
-- Die Lovable-Route ist oeffentlich und hat keinen Service-Key. Die
-- Alternative waere der Service-Key als Lovable-Secret — eine zehnte Flaeche
-- fuer e65e025f. Der anon-Weg braucht kein Geheimnis.
-- Die Schreibweite bleibt eine Zeile je Aufruf, und die Route reicht das JSON
-- nie durch, nur den Redirect.
--
-- 3. ⚠ HAERTUNG GEGEN DIE FLUT, die der anon-Grant eroeffnet:
-- Bisher schrieb die Funktion bei JEDEM ungueltigen Hash eine Zeile in
-- webhook_log. Oeffentlich aufrufbar waere das ein Fuellvektor — wer die URL
-- kennt, kann die Tabelle beliebig gross machen.
-- NEU: Bei einem SYNTAKTISCH ungueltigen Hash wird NICHTS geschrieben, nur
-- zurueckgegeben. Nur der Fall "acht Hex, aber kein Kontakt" wird protokolliert
-- — der ist selten und deutet auf ein echtes Problem hin (geloeschter Kontakt,
-- alter Link).
--
-- Unveraendert: Das Ziel kommt IMMER zurueck, solange eines ermittelbar ist.
-- Kein Already-Tracked-Gate.

CREATE OR REPLACE FUNCTION public.termin_click_intake(
  p_hash   text,
  p_ziel   text DEFAULT NULL,
  p_quelle text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hash text := lower(btrim(coalesce(p_hash,'')));
  v_contact_id uuid;
  v_deal_id uuid;
  v_campaign_id uuid;
  v_activity_id uuid;
  v_schule text;
  v_ziel text;
BEGIN
  IF p_quelle IS NOT NULL THEN
    v_campaign_id := campaign_id_aus_utm(p_quelle);
  END IF;

  -- Das Ziel kommt aus der Datenbank, nicht aus der Route.
  v_ziel := NULLIF(btrim(coalesce(p_ziel,'')), '');
  IF v_ziel IS NULL AND v_campaign_id IS NOT NULL THEN
    SELECT NULLIF(btrim(k.buchungslink),'') INTO v_ziel
    FROM campaigns k WHERE k.id = v_campaign_id;
  END IF;

  IF v_ziel IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_ziel',
      'hinweis', 'Weder p_ziel noch campaigns.buchungslink der aufgeloesten Kampagne gesetzt.');
  END IF;

  -- ⚠ Syntaktisch ungueltiger Hash: NICHTS schreiben. Oeffentlich aufrufbar
  -- waere ein Protokolleintrag hier ein Fuellvektor.
  IF v_hash !~ '^[0-9a-f]{8}$' THEN
    RETURN jsonb_build_object('ok', true, 'ziel', v_ziel, 'gezaehlt', false,
                              'grund', 'hash_ungueltig');
  END IF;

  SELECT c.id INTO v_contact_id
  FROM contacts c
  WHERE c.deleted_at IS NULL
    AND c.id >= (v_hash || '-0000-0000-0000-000000000000')::uuid
    AND c.id <  (to_hex(('x' || v_hash)::bit(32)::int + 1) || '-0000-0000-0000-000000000000')::uuid
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    -- Acht Hex, aber kein Kontakt: selten und aussagekraeftig. Wird
    -- protokolliert, weil es auf einen geloeschten Kontakt oder einen alten
    -- Link hindeutet.
    INSERT INTO webhook_log(source, event_type, payload, received_at)
    VALUES ('termin_click', 'kontakt_unbekannt',
            jsonb_build_object('hash', v_hash, 'ziel', v_ziel, 'quelle', p_quelle), now());
    RETURN jsonb_build_object('ok', true, 'ziel', v_ziel, 'gezaehlt', false,
                              'grund', 'kontakt_unbekannt');
  END IF;

  SELECT d.id, co.name INTO v_deal_id, v_schule
  FROM deals d
  LEFT JOIN companies co ON co.id = d.company_id
  WHERE d.primary_contact_id = v_contact_id AND d.deleted_at IS NULL
  ORDER BY (v_campaign_id IS NOT NULL
            AND d.pipeline_id = (SELECT k.pipeline_id FROM campaigns k WHERE k.id = v_campaign_id)) DESC,
           d.created_at DESC
  LIMIT 1;

  INSERT INTO deal_activities(deal_id, contact_id, activity_type, title, description,
                              campaign_id, auto_generated, status, metadata, created_at, updated_at)
  VALUES (v_deal_id, v_contact_id, 'termin_click',
    'Buchungslink geklickt',
    coalesce(v_schule || ': ', '') || 'Der Kontakt hat den Terminlink in der Mail angeklickt und wurde zu ' || v_ziel || ' weitergeleitet.' || E'\n' ||
    'Das ist der Uebergang von Interesse zu Termin — ob dort auch gebucht wurde, zeigt erst cal_booking_intake.',
    v_campaign_id, true, 'completed',
    jsonb_build_object('hash', v_hash, 'ziel', v_ziel, 'quelle', p_quelle,
                       'kampagne_aufgeloest', v_campaign_id IS NOT NULL,
                       'ziel_aus_db', p_ziel IS NULL),
    now(), now())
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('ok', true, 'ziel', v_ziel, 'gezaehlt', true,
    'activity_id', v_activity_id, 'contact_id', v_contact_id,
    'deal_id', v_deal_id, 'campaign_id', v_campaign_id);
END;
$function$;

COMMENT ON FUNCTION public.termin_click_intake(text, text, text) IS
  'Zaehlt einen Klick auf den Buchungslink und gibt das cal.com-Ziel zurueck. Ohne p_ziel faellt sie auf campaigns.buchungslink der aufgeloesten Kampagne zurueck — der Link gehoert in die Datenbank, nicht in die Route: derselbe Fehler hat auf viktoria-roadshow.com drei Monate lang ein 404 erzeugt. Gibt das Ziel IMMER zurueck, solange eines ermittelbar ist. Kein Already-Tracked-Gate. Bei syntaktisch ungueltigem Hash wird NICHTS geschrieben, weil die Funktion oeffentlich aufrufbar ist und ein Protokolleintrag dort ein Fuellvektor waere; nur "acht Hex ohne Kontakt" wird protokolliert.';

GRANT EXECUTE ON FUNCTION public.termin_click_intake(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.termin_click_intake(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.termin_click_intake(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.campaign_id_aus_utm(text) TO anon;