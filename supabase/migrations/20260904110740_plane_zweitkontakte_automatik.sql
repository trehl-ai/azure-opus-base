-- 04.09.2026: Die zweite Welle fuellt sich selbst nach.
--
-- ANLASS: Bisher gibt es KEINEN Automatismus, der Deals in die Stufe
-- "2. Mailing" bewegt. trg_second_mailing_scheduled reagiert ausschliesslich auf
-- einen Stufenwechsel — jemand muss ihn ausloesen. Im Juni war das Handarbeit,
-- seit dem 06.08. passiert es gar nicht. Deshalb steht Welle 2 bei 43 Prozent
-- in Bayern und 2 Prozent bundesweit, dauerhaft.
--
-- Anforderung Tomi: die Kampagne muss OHNE Zutun auf 100 Prozent laufen.
--
-- DIESE FUNKTION ist der fehlende Schritt. Ein n8n-Cron ruft sie taeglich vor
-- dem Versand auf; sie verschiebt faellige Deals nach "2. Mailing", der
-- vorhandene Trigger feuert je Zeile den Webhook, der Scheduler plant ein, der
-- Versand liefert.
--
-- AUSWAHLREGEL, identisch zu dem SELECT, das am 04.09. die 430 hergeleitet hat:
--   in den Nachfassstufen (Mailing erhalten, Wiedervorlage, Erneutes Mailing)
--   genau EINE Mail bisher
--   diese Mail aelter als p_mindestalter Tage (Standard 25, Entscheidung Tomi)
--   Deal offen, Kontakt und Firma nicht geloescht
--   Mailadresse vorhanden, kein Hardbounce
--   outreach_status nicht replied/terminated/blocked_*
--   keine Adresssperre in marketing_opt_out
--   noch nicht in scheduled_mailings eingeplant
--
-- ⚠ DECKEL: p_limit, Standard 50. Der Trigger feuert je verschobener Zeile einen
-- net.http_post. Gemessen am 03.09.: 5 Zeilen in 151 ms, kein Verlust. 50 sind
-- rechnerisch rund 1,5 Sekunden. Ohne Deckel waeren es 430 auf einen Schlag.
--
-- ⚠ Die Funktion SENDET NICHTS. Sie verschiebt nur. Der Versand haengt weiterhin
-- am Workflow kgFT8aGHP7tOjsQP, der aktiviert werden muss, und an der Freigabe
-- des Mailings.

CREATE OR REPLACE FUNCTION public.plane_zweitkontakte(
  p_limit integer DEFAULT 50,
  p_mindestalter_tage integer DEFAULT 25,
  p_trockenlauf boolean DEFAULT false
)
 RETURNS TABLE(deal_id uuid, deal_title text, email text, bundesland text, letzte_mail date, tage_her integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id uuid;
BEGIN
  SELECT id INTO v_stage_id
  FROM pipeline_stages
  WHERE pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e' AND name = '2. Mailing';

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'Stufe "2. Mailing" nicht gefunden — Abbruch statt stiller Fehlschlag';
  END IF;

  RETURN QUERY
  WITH faellig AS (
    SELECT d.id,
           d.title,
           c.email AS mail,
           c.bundesland AS land,
           (SELECT max(x.created_at) FROM deal_activities x
              WHERE x.deal_id = d.id AND x.activity_type = 'email' AND x.deleted_at IS NULL) AS letzte
    FROM deals d
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE d.deleted_at IS NULL
      AND d.status = 'open'
      AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND ps.name IN ('Mailing erhalten','Wiedervorlage','Erneutes Mailing')
      AND c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      AND COALESCE(c.outreach_status,'') NOT IN
          ('replied','terminated','blocked_widerspruch','blocked_behoerde','blocked_unklare_adresse')
      AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo
                        WHERE mo.email_normalized = lower(btrim(c.email)))
      AND NOT EXISTS (SELECT 1 FROM scheduled_mailings sm
                        WHERE sm.deal_id = d.id AND sm.mailing_type = '2nd_mailing')
      AND (SELECT count(*) FROM deal_activities x
             WHERE x.deal_id = d.id AND x.activity_type = 'email' AND x.deleted_at IS NULL) = 1
      AND (SELECT max(x.created_at) FROM deal_activities x
             WHERE x.deal_id = d.id AND x.activity_type = 'email' AND x.deleted_at IS NULL)
          < now() - make_interval(days => p_mindestalter_tage)
    ORDER BY (SELECT max(x.created_at) FROM deal_activities x
                WHERE x.deal_id = d.id AND x.activity_type = 'email' AND x.deleted_at IS NULL) ASC
    LIMIT p_limit
  ),
  verschoben AS (
    UPDATE deals d
    SET pipeline_stage_id = v_stage_id
    FROM faellig f
    WHERE d.id = f.id AND NOT p_trockenlauf
    RETURNING d.id
  )
  SELECT f.id, f.title, f.mail, f.land, f.letzte::date,
         (CURRENT_DATE - f.letzte::date)::integer
  FROM faellig f
  WHERE p_trockenlauf OR f.id IN (SELECT id FROM verschoben);
END
$function$;

COMMENT ON FUNCTION public.plane_zweitkontakte(integer, integer, boolean) IS
  'Verschiebt faellige Deals in die Stufe "2. Mailing" und loest damit den vorhandenen Trigger aus. Taeglich per n8n-Cron vor dem Versand aufrufen. p_trockenlauf=true zeigt nur an, ohne zu verschieben. Aelteste Erstmail zuerst. Deckel p_limit, weil der Trigger je Zeile einen net.http_post feuert. Sendet selbst NICHTS — der Versand haengt an kgFT8aGHP7tOjsQP und an der Mailingfreigabe.';

REVOKE ALL ON FUNCTION public.plane_zweitkontakte(integer, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.plane_zweitkontakte(integer, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.plane_zweitkontakte(integer, integer, boolean) TO service_role;