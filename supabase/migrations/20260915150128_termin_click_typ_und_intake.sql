-- 15.09.2026: Terminklicks zaehlbar machen.
--
-- ANLASS: Von allen Klicks im Bestand ist KEINER ein Terminklick. Die
-- Mailtexte tragen ${cal_link} und ${buchungslink}, beide zeigen direkt auf
-- cal.com — eine fremde Domain ohne Plausible.
-- ⚠ DAMIT IST DER WERTVOLLSTE UEBERGANG IM TRICHTER UNSICHTBAR: Bei WerteRaum
-- antworten 37 Prozent der Info-Klicker. Wer bis zum Buchungslink kommt und
-- dort abspringt, weiss niemand.
--
-- ZWEI AENDERUNGEN:
--
-- 1. NEUER AKTIVITAETSTYP termin_click.
-- ⚠ WARUM NICHT link_click: Das Gate "Already Tracked?" im Tracker
-- iGT9tpIXutCBoZMg ueberspringt jeden Kontakt mit outreach_status
-- link_clicked oder replied. Ein Terminklick NACH einem Infoklick wuerde
-- verworfen — und genau diese Reihenfolge ist der interessante Fall.
--
-- 2. FUNKTION termin_click_intake(hash, ziel, quelle).
-- Der Weiterleiter ruft sie, bevor er auf cal.com weiterleitet. Sie loest den
-- Hash auf, schreibt die Aktivitaet und gibt das Ziel zurueck.
--
-- ⚠ SIE GIBT DAS ZIEL IMMER ZURUECK, auch wenn der Hash auf nichts zeigt.
-- Der bestehende Info-Weiterleiter auf werteraum-schule.de prueft den Hash auf
-- genau 8 Hex und leitet sonst auf / ohne utm — STILLER VERLUST. Wer einen
-- Termin wollte, soll bei cal.com landen, auch wenn wir ihn nicht zaehlen
-- koennen. Die Zaehlung ist das Zweitwichtigste, nicht das Wichtigste.
--
-- ⚠ KEIN "Already Tracked"-GATE. Ein zweiter Terminklick desselben Kontakts
-- ist eine Information, keine Dublette — er zeigt, dass jemand zurueckkam.
-- Die Funktion schreibt jeden Klick.
--
-- Der Hash ist wie beim Infoklick contact_id.substring(0,8), aufgeloest ueber
-- einen UUID-Range.

ALTER TABLE public.deal_activities DROP CONSTRAINT IF EXISTS deal_activities_type_check;
ALTER TABLE public.deal_activities ADD CONSTRAINT deal_activities_type_check
  CHECK (activity_type = ANY (ARRAY[
    'call'::text, 'email'::text, 'note'::text, 'meeting'::text, 'task'::text,
    'briefing'::text, 'casting'::text, 'link_click'::text, 'email_reply'::text,
    'bounce'::text, 'termin_click'::text]));

CREATE OR REPLACE FUNCTION public.termin_click_intake(
  p_hash   text,
  p_ziel   text,
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
BEGIN
  -- Das Ziel wird IMMER zurueckgegeben. Ohne gueltigen Hash nur nicht gezaehlt.
  IF p_ziel IS NULL OR btrim(p_ziel) = '' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'kein_ziel');
  END IF;

  IF v_hash !~ '^[0-9a-f]{8}$' THEN
    INSERT INTO webhook_log(source, event_type, payload, received_at)
    VALUES ('termin_click', 'hash_ungueltig',
            jsonb_build_object('hash', p_hash, 'ziel', p_ziel, 'quelle', p_quelle), now());
    RETURN jsonb_build_object('ok', true, 'ziel', p_ziel, 'gezaehlt', false,
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
            jsonb_build_object('hash', v_hash, 'ziel', p_ziel, 'quelle', p_quelle), now());
    RETURN jsonb_build_object('ok', true, 'ziel', p_ziel, 'gezaehlt', false,
                              'grund', 'kontakt_unbekannt');
  END IF;

  -- Kampagne aus der Quelle, wenn sie mitkommt.
  IF p_quelle IS NOT NULL THEN
    v_campaign_id := campaign_id_aus_utm(p_quelle);
  END IF;

  -- Deal des Kontakts. Passt die Kampagne, gewinnt ihr Deal; sonst der juengste.
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
    coalesce(v_schule || ': ', '') || 'Der Kontakt hat den Terminlink in der Mail angeklickt und wurde zu ' || p_ziel || ' weitergeleitet.' || E'\n' ||
    'Das ist der Uebergang von Interesse zu Termin — ob dort auch gebucht wurde, zeigt erst cal_booking_intake.',
    v_campaign_id, true, 'completed',
    jsonb_build_object('hash', v_hash, 'ziel', p_ziel, 'quelle', p_quelle,
                       'kampagne_aufgeloest', v_campaign_id IS NOT NULL),
    now(), now())
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object('ok', true, 'ziel', p_ziel, 'gezaehlt', true,
    'activity_id', v_activity_id, 'contact_id', v_contact_id,
    'deal_id', v_deal_id, 'campaign_id', v_campaign_id);
END;
$function$;

COMMENT ON FUNCTION public.termin_click_intake(text, text, text) IS
  'Zaehlt einen Klick auf den Buchungslink und gibt das cal.com-Ziel zurueck. Der Weiterleiter ruft sie, bevor er weiterleitet. GIBT DAS ZIEL IMMER ZURUECK, auch bei ungueltigem Hash — wer einen Termin wollte, soll bei cal.com landen, auch wenn wir ihn nicht zaehlen koennen. Kein Already-Tracked-Gate: ein zweiter Terminklick zeigt, dass jemand zurueckkam, und ist eine Information. Nicht gezaehlte Faelle landen in webhook_log.';

REVOKE ALL ON FUNCTION public.termin_click_intake(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.termin_click_intake(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.termin_click_intake(text, text, text) TO service_role;