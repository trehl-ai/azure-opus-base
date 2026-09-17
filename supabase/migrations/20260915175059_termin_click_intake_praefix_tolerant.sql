-- 15.09.2026: termin_click_intake toleriert ein vorangestelltes "werteraum-".
--
-- ANLASS: Fit & Aktiv soll Terminklicks zaehlen. Der Ort der Route wird
-- t.viktoria-roadshow.com als ZWEITDOMAIN am bestehenden Lovable-Projekt —
-- Lovable leitet Zweitdomains per 302 MIT PFAD auf die Primaerdomain, gemessen
-- an www.werteraum-schule.de. Damit laeuft ein Viktoria-Klick durch dieselbe
-- Route wie ein WerteRaum-Klick.
-- ⚠ DIE ROUTE BAUT ABER quelle = "werteraum-" + seg. Aus vr-fua-schulen-w1
-- wird werteraum-vr-fua-schulen-w1, und das trifft per laengstem Praefix
-- "werteraum" — also WerteRaum 2.0 Bundesweit.
-- KEIN FEHLER, KEIN LEERES ERGEBNIS, nur die falsche Kampagne am Klick.
-- Gemessen: alle drei Viktoria-Praefixe haetten als Bundesweit gezaehlt.
--
-- DIE LOESUNG LIEGT IN DER DATENBANK, nicht in der Route: erst OHNE das
-- vorangestellte "werteraum-" aufloesen, dann MIT.
--   werteraum-vr-fua-schulen-w1 -> vr-fua-schulen-w1 -> VR Fit & Aktiv Schulen
--   werteraum-nrw-w1            -> nrw-w1 trifft nichts
--                               -> werteraum-nrw-w1 -> WerteRaum 2.0
-- Gegengeprueft an allen sechs Praefixen: die drei WerteRaum-Werte bleiben
-- unveraendert, die drei Viktoria-Werte treffen ihre eigene Kampagne.
--
-- ⚠ WARUM NICHT IN DER ROUTE: Jede Aenderung dort kostet einen Lovable-Lauf
-- und einen Publish, und die Route ist die Stelle, die wir am wenigsten
-- einsehen koennen. Die DB ist messbar.
--
-- Alles Uebrige unveraendert.

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
  -- NEU 15.09.2026: erst ohne vorangestelltes "werteraum-", dann mit.
  IF p_quelle IS NOT NULL THEN
    v_campaign_id := COALESCE(
      campaign_id_aus_utm(regexp_replace(p_quelle, '^werteraum-', '')),
      campaign_id_aus_utm(p_quelle));
  END IF;

  v_ziel := NULLIF(btrim(coalesce(p_ziel,'')), '');
  IF v_ziel IS NULL AND v_campaign_id IS NOT NULL THEN
    SELECT NULLIF(btrim(k.buchungslink),'') INTO v_ziel
    FROM campaigns k WHERE k.id = v_campaign_id;
  END IF;

  IF v_ziel IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_ziel',
      'hinweis', 'Weder p_ziel noch campaigns.buchungslink der aufgeloesten Kampagne gesetzt.');
  END IF;

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
  'Zaehlt einen Klick auf den Buchungslink und gibt das cal.com-Ziel zurueck. Loest die Kampagne erst OHNE, dann MIT vorangestelltem "werteraum-" auf: die gemeinsame Route baut quelle = "werteraum-" + seg, und vr-fua-schulen-w1 wuerde sonst als WerteRaum 2.0 zaehlen — still falsch, nicht leer. Ohne p_ziel faellt sie auf campaigns.buchungslink zurueck; der Link gehoert in die Datenbank, nicht in die Route. Gibt das Ziel IMMER zurueck. Kein Already-Tracked-Gate. Bei syntaktisch ungueltigem Hash wird nichts geschrieben (oeffentlich aufrufbar, Fuellvektor).';