-- 14.09.2026: Einen Deal nach einer nicht angekommenen Mail wieder freigeben.
--
-- ANLASS: Am 11.09. wurden 56 Mail-Aktivitaeten soft-geloescht, damit 47
-- Schulen wieder in die Versandstrecke laufen — ihre Erstmail war gebounct
-- oder an einen Dienstleister gegangen.
-- ⚠ DABEI BLIEBEN ZWEI ANDERE STELLEN STEHEN:
--   contacts.outreach_status  blieb auf email_sent -> 5 Schulen galten als
--     angeschrieben, ohne es zu sein. Weder Kandidat noch erreicht.
--   scheduled_mailings.status blieb auf sent -> 9 Eintraege behaupteten eine
--     Zustellung, die nie stattfand.
-- Gefunden erst am 14.09. vom Konsistenzwaechter, drei Tage spaeter.
--
-- EINE MAIL HAENGT AN DREI STELLEN. Wer eine davon zurueecknimmt, muss alle
-- drei anfassen. Genau diese Regel setzt korrigiere_mailadresse fuer Adressen
-- schon durch — fuer Aktivitaeten fehlte sie.
--
-- WAS DIESE FUNKTION TUT, in einem Zug:
--   1. Mail-Aktivitaeten des Deals soft-loeschen (nur activity_type email)
--   2. contacts.outreach_status auf pending, wenn er auf email_sent stand
--   3. scheduled_mailings mit status sent auf cancelled
--   4. eine Notiz mit dem Grund
--
-- ⚠ WAS SIE NICHT TUT:
--   Bounce-Aktivitaeten anfassen. Sie sind der Beleg dafuer, WARUM die Mail
--     nicht ankam.
--   Einen Kontakt entsperren, der bounce_at oder einen Widerspruch traegt.
--     Wer gesperrt ist, bleibt gesperrt — die Freigabe der Aktivitaet macht
--     eine tote Adresse nicht lebendig.
--   Antworten oder Klicks loeschen. Wer geantwortet hat, hat die Mail gesehen.
--     Traegt der Deal eine Antwort oder einen Klick, bricht sie ab.
--
-- p_trockenlauf zeigt an, ohne zu schreiben.

CREATE OR REPLACE FUNCTION public.gib_deal_wieder_frei(
  p_deal_id     uuid,
  p_grund       text,
  p_trockenlauf boolean DEFAULT true
)
 RETURNS TABLE(
   ergebnis text, schule text, email text,
   mails_geloescht integer, status_alt text, status_neu text,
   mailings_storniert integer, hinweis text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
  v_email text;
  v_schule text;
  v_status_alt text;
  v_status_neu text;
  v_bounce boolean;
  v_mails integer;
  v_mailings integer;
  v_reaktion integer;
BEGIN
  SELECT d.primary_contact_id, c.email, co.name, c.outreach_status,
         (c.bounce_at IS NOT NULL
          OR c.outreach_status IN ('blocked_widerspruch','blocked_behoerde','blocked_unklare_adresse')
          OR EXISTS (SELECT 1 FROM marketing_opt_out mo
                     WHERE mo.email_normalized = lower(btrim(c.email))))
    INTO v_contact_id, v_email, v_schule, v_status_alt, v_bounce
  FROM deals d
  LEFT JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
  LEFT JOIN companies co ON co.id = d.company_id
  WHERE d.id = p_deal_id AND d.deleted_at IS NULL;

  IF v_contact_id IS NULL THEN
    RETURN QUERY SELECT 'FEHLER'::text, NULL::text, NULL::text, 0, NULL::text, NULL::text, 0,
                        'Deal nicht gefunden oder ohne lebenden Hauptkontakt'::text;
    RETURN;
  END IF;

  -- Wer reagiert hat, hat die Mail gesehen.
  SELECT count(*) INTO v_reaktion FROM deal_activities a
  WHERE a.deal_id = p_deal_id AND a.deleted_at IS NULL
    AND a.activity_type IN ('email_reply','link_click');
  IF v_reaktion > 0 THEN
    RETURN QUERY SELECT 'ABGELEHNT'::text, v_schule, v_email, 0, v_status_alt, NULL::text, 0,
      ('Der Deal traegt ' || v_reaktion || ' Antwort(en) oder Klick(s). Die Mail wurde gesehen — sie gilt als zugestellt.')::text;
    RETURN;
  END IF;

  SELECT count(*) INTO v_mails FROM deal_activities a
  WHERE a.deal_id = p_deal_id AND a.deleted_at IS NULL AND a.activity_type = 'email';

  SELECT count(*) INTO v_mailings FROM scheduled_mailings sm
  WHERE sm.deal_id = p_deal_id AND sm.status = 'sent';

  -- Gesperrte bleiben gesperrt. Die Freigabe macht eine tote Adresse nicht lebendig.
  v_status_neu := CASE WHEN v_bounce THEN v_status_alt
                       WHEN v_status_alt = 'email_sent' THEN 'pending'
                       ELSE v_status_alt END;

  IF p_trockenlauf THEN
    RETURN QUERY SELECT 'TROCKENLAUF'::text, v_schule, v_email, v_mails, v_status_alt, v_status_neu, v_mailings,
      (CASE WHEN v_bounce THEN 'Kontakt ist gesperrt — Status bleibt. Nur Aktivitaet und Mailings wuerden zurueckgenommen. '
            ELSE '' END || 'Nichts geschrieben.')::text;
    RETURN;
  END IF;

  UPDATE deal_activities SET deleted_at = now(), updated_at = now()
  WHERE deal_id = p_deal_id AND deleted_at IS NULL AND activity_type = 'email';

  UPDATE scheduled_mailings SET status = 'cancelled'
  WHERE deal_id = p_deal_id AND status = 'sent';

  IF v_status_neu <> v_status_alt THEN
    UPDATE contacts SET outreach_status = v_status_neu, updated_at = now()
    WHERE id = v_contact_id;
  END IF;

  INSERT INTO deal_activities (deal_id, activity_type, title, description, created_at)
  VALUES (p_deal_id, 'note', 'Deal wieder freigegeben',
    'GRUND: ' || p_grund || E'\n' ||
    'Mail-Aktivitaeten soft-geloescht: ' || v_mails || E'\n' ||
    'scheduled_mailings auf cancelled: ' || v_mailings || E'\n' ||
    'Kontaktstatus: ' || COALESCE(v_status_alt,'?') || ' -> ' || COALESCE(v_status_neu,'?') ||
    CASE WHEN v_bounce THEN ' (unveraendert, Kontakt ist gesperrt)' ELSE '' END || E'\n' ||
    'Bounce-Aktivitaeten wurden NICHT angefasst — sie belegen, warum die Mail nicht ankam.' || E'\n' ||
    'REVERSIBEL: deal_activities.deleted_at = NULL, scheduled_mailings.status = sent, outreach_status zurueck.',
    now());

  RETURN QUERY SELECT 'FREIGEGEBEN'::text, v_schule, v_email, v_mails, v_status_alt, v_status_neu, v_mailings,
    NULLIF(CASE WHEN v_bounce THEN 'Kontakt bleibt gesperrt.' ELSE '' END,'')::text;
END
$function$;

COMMENT ON FUNCTION public.gib_deal_wieder_frei(uuid, text, boolean) IS
  'Nimmt eine Mail zurueck, die ihr Ziel nicht erreicht hat, und stellt den Deal in die Versandstrecke. Fasst ALLE DREI Stellen an: deal_activities (soft-delete der email-Aktivitaeten), contacts.outreach_status und scheduled_mailings.status. Am 11.09.2026 wurde nur die erste zurueckgenommen — fuenf Schulen galten danach als angeschrieben, ohne es zu sein, und neun Mailings behaupteten eine Zustellung, die nie stattfand. Bricht ab, wenn der Deal eine Antwort oder einen Klick traegt: wer reagiert hat, hat die Mail gesehen. Laesst gesperrte Kontakte gesperrt und Bounce-Aktivitaeten unberuehrt.';

REVOKE ALL ON FUNCTION public.gib_deal_wieder_frei(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gib_deal_wieder_frei(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.gib_deal_wieder_frei(uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gib_deal_wieder_frei(uuid, text, boolean) TO authenticated;