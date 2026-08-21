-- 17.08.2026 — Tageswaechter fuer den unbeaufsichtigten Betrieb.
-- Zweck: eine einzige RPC, die alles zurueckgibt, was waehrend einer
-- mehrtaegigen Abwesenheit schieflaufen kann, als fertigen Telegram-Text.
-- Bewusst so gebaut, dass ALARM-Zeilen oben stehen und der Text auf einem
-- Handy in fuenf Sekunden lesbar ist.
-- Traeger ist ein eigener minimaler n8n-Workflow, NICHT der bestehende
-- Health-Check — ein neuer Workflow kann keinen bestehenden Alarm zerstoeren.

CREATE OR REPLACE FUNCTION public.wr_tageswaechter()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  v_stage_mailing uuid := 'eed128e9-373f-44a1-aaef-f705ce9511da';
  v_wochentag int := extract(isodow FROM current_date);
  v_mails int; v_bounce_hart int; v_bounce_soft int; v_replies int;
  v_klicks int; v_fehlzuordnung int; v_segment_null int;
  v_domain_max int; v_domain_name text;
  v_pool int; v_aktive int; v_erwartet int;
  v_neue_antworten int; v_neue_termine int;
  v_alarm text[] := ARRAY[]::text[];
  v_info text[] := ARRAY[]::text[];
  v_text text;
BEGIN
  -- Versand heute
  SELECT count(*) INTO v_mails FROM deal_activities
   WHERE activity_type='email' AND deleted_at IS NULL AND created_at::date = current_date;

  SELECT count(*) FILTER (WHERE metadata->>'typ' = 'hard_bounce'),
         count(*) FILTER (WHERE metadata->>'typ' = 'soft_bounce')
    INTO v_bounce_hart, v_bounce_soft
    FROM deal_activities
   WHERE activity_type='bounce' AND deleted_at IS NULL AND created_at::date = current_date;

  SELECT count(*) INTO v_replies FROM deal_activities
   WHERE activity_type='email_reply' AND deleted_at IS NULL AND created_at::date = current_date;

  SELECT count(*) INTO v_klicks FROM deal_activities
   WHERE activity_type='link_click' AND deleted_at IS NULL AND created_at::date = current_date;

  -- Integritaetswaechter
  SELECT count(*) INTO v_fehlzuordnung
    FROM deal_activities da JOIN deals d ON d.id = da.deal_id
   WHERE da.activity_type='email' AND da.deleted_at IS NULL
     AND da.created_at::date = current_date
     AND d.primary_contact_id IS DISTINCT FROM da.contact_id;

  SELECT count(*) INTO v_segment_null
    FROM deals d JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
   WHERE d.pipeline_id = v_pipeline AND d.deleted_at IS NULL
     AND ps.is_outreach_source AND d.segment IS NULL;

  SELECT lower(split_part(c.email,'@',2)), count(*) INTO v_domain_name, v_domain_max
    FROM deal_activities da JOIN contacts c ON c.id = da.contact_id
   WHERE da.activity_type='email' AND da.deleted_at IS NULL
     AND da.created_at::date = current_date
   GROUP BY 1 ORDER BY 2 DESC LIMIT 1;

  -- Stage-Bewegungen der letzten 24h, die einen Menschen brauchen
  SELECT count(*) FILTER (WHERE a.details->'new'->>'pipeline_stage_id' = 'ce17aedc-ec18-46b7-8f17-1ad6bd9f9115'),
         count(*) FILTER (WHERE a.details->'new'->>'pipeline_stage_id' = '6cfd9d0a-cdfa-4048-b711-bf63bd4640b6')
    INTO v_neue_antworten, v_neue_termine
    FROM audit_log a
   WHERE a.entity_type='deals' AND a.aktion='UPDATE'
     AND a.created_at >= now() - interval '24 hours'
     AND a.details->'old'->>'pipeline_stage_id'
         IS DISTINCT FROM a.details->'new'->>'pipeline_stage_id';

  SELECT count(*) INTO v_aktive FROM get_werteraum_aktive_kampagnen();
  SELECT count(*) INTO v_pool FROM get_werteraum_candidates(100000, NULL, 'grundschule', 100);
  v_erwartet := least(50, v_pool);

  -- ALARME
  IF v_fehlzuordnung > 0 THEN
    v_alarm := v_alarm || format('FEHLZUORDNUNG: %s Mails haengen am falschen Deal', v_fehlzuordnung);
  END IF;

  IF v_wochentag <= 5 AND v_aktive > 0 AND v_pool > 0 AND v_mails = 0 THEN
    v_alarm := v_alarm || format('VERSAND AUSGEFALLEN: 0 Mails an einem Werktag, obwohl %s Kandidaten bereitstehen', v_pool);
  END IF;

  IF v_mails > 0 AND v_bounce_hart::numeric / v_mails > 0.2 THEN
    v_alarm := v_alarm || format('BOUNCE-QUOTE %s von %s = %s Prozent. Ueber 20 Prozent gefaehrdet die Domain-Reputation.',
                                 v_bounce_hart, v_mails, round(100.0*v_bounce_hart/v_mails));
  END IF;

  IF v_domain_max > 3 THEN
    v_alarm := v_alarm || format('DOMAIN-CAP DURCHBROCHEN: %s Mails an %s (erlaubt 3)', v_domain_max, v_domain_name);
  END IF;

  IF v_segment_null > 0 THEN
    v_alarm := v_alarm || format('SEGMENT NULL bei %s Deals — die fallen stillschweigend aus dem Versand', v_segment_null);
  END IF;

  IF v_replies > 0 OR v_neue_antworten > 0 THEN
    v_alarm := v_alarm || format('ANTWORT VON EINER SCHULE: %s heute, %s Stage-Wechsel in 24h. Braucht einen Menschen.',
                                 v_replies, v_neue_antworten);
  END IF;

  IF v_neue_termine > 0 THEN
    v_alarm := v_alarm || format('TERMIN GEBUCHT: %s in 24h. Kalender pruefen.', v_neue_termine);
  END IF;

  IF v_pool < 60 THEN
    v_alarm := v_alarm || format('POOL LAEUFT LEER: nur noch %s Kandidaten gesamt', v_pool);
  END IF;

  -- INFO
  v_info := v_info || format('Mails heute: %s (erwartet bis %s)', v_mails, v_erwartet);
  v_info := v_info || format('Bounces: %s hart, %s weich', v_bounce_hart, v_bounce_soft);
  v_info := v_info || format('Antworten: %s | Klicks: %s (Klicks sind womoeglich Gateway-Scanner)', v_replies, v_klicks);
  v_info := v_info || format('Pool Grundschule: %s | aktive Kampagnen: %s', v_pool, v_aktive);
  v_info := v_info || format('Groesste Empfaengerdomain heute: %s mit %s', coalesce(v_domain_name,'—'), coalesce(v_domain_max,0));

  v_text := CASE WHEN array_length(v_alarm,1) IS NULL
                 THEN E'\u2705 WerteRaum Tageswaechter ' || to_char(current_date,'DD.MM.YYYY') || E' — alles im Rahmen\n\n'
                 ELSE E'\U0001F6A8 WerteRaum Tageswaechter ' || to_char(current_date,'DD.MM.YYYY') || E'\n\n'
                      || array_to_string(v_alarm, E'\n') || E'\n\n'
            END
            || array_to_string(v_info, E'\n');

  RETURN json_build_object(
    'text', v_text,
    'alarm', coalesce(array_length(v_alarm,1), 0) > 0,
    'alarm_anzahl', coalesce(array_length(v_alarm,1), 0),
    'mails', v_mails, 'bounce_hart', v_bounce_hart, 'bounce_soft', v_bounce_soft,
    'replies', v_replies, 'klicks', v_klicks, 'pool', v_pool,
    'fehlzuordnung', v_fehlzuordnung, 'segment_null', v_segment_null,
    'domain_max', coalesce(v_domain_max,0), 'domain_name', v_domain_name,
    'neue_antworten_24h', v_neue_antworten, 'neue_termine_24h', v_neue_termine
  );
END
$function$;

REVOKE ALL ON FUNCTION public.wr_tageswaechter() FROM anon;
GRANT EXECUTE ON FUNCTION public.wr_tageswaechter() TO service_role, authenticated;