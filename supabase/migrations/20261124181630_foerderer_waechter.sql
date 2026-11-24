-- Foerderer-Waechter (go Waechter + go geplant_ab, Tomi 24.11.2026). Quelle: ~/eic-001/work/foerderer_waechter_entwurf_v2_20261124.sql.
-- (1) Neue Tabelle versand_pausen: Pause je Absenderdomain, von/bis als Berliner Datum (einschliesslich).
--     REVOKE ALL FROM PUBLIC, anon, authenticated (Default-ACL vergibt anon/authenticated sonst ausdruecklich), nur service_role; RLS an.
--     Die Tabelle haelt nur den Waechter still, nicht die Versand-Workflows.
-- (2) wr_tageswaechter: zwei Ausfall-Alarme an Werktagen, wenn heute (Berliner Datum) 0 Mails rausgingen, obwohl
--     Kandidaten da sind, das Budget viktoria-roadshow.com Rest > 0 hat und keine Pause greift:
--     Foerderer-Erstmail (HYDA, stiftung_erstmail_foerderer) und Foerderer-Nachfass (MPu8, stiftung_nachfass_foerderer).
--     Der Nachfass-Alarm ist erst scharf ab campaign_mailings.geplant_ab von Text Nr. 4 (eb871f1f); NULL = nie scharf.
--     Ausnahme vom Abbruchkriterium (go geplant_ab): geplant_ab lesen auch get_campaign_overview() und MailingListe.tsx,
--     beide mit derselben Bedeutung und ohne Versandsteuerung.
--     Die Ausfall-Alarme stehen mit Praefix "AUSFALL:" ganz oben im Text, vor dem Kopf und allen anderen Alarmen.
--     Dazu eine Infozeile "Foerderer: ..." und neun JSON-Felder foerderer_*. Signatur, ACL und bisherige Alarme unveraendert.
-- Rollback-Test 24.11.: (i) Ist-Stand kein Foerderer-Alarm, (ii) Erstmails weg -> AUSFALL erste Zeile, (iii) Pause -> kein Alarm.

CREATE TABLE IF NOT EXISTS public.versand_pausen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  absender_domain text NOT NULL,
  von date NOT NULL,
  bis date NOT NULL,
  grund text,
  erfasst_von uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT versand_pausen_zeitraum CHECK (bis >= von)
);
REVOKE ALL ON TABLE public.versand_pausen FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.versand_pausen TO service_role;
ALTER TABLE public.versand_pausen ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wr_tageswaechter()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline uuid := '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
  -- Baustufe 2g: WerteRaum-Schulen + Pipeline der F&A-Kampagne 11da18f2 (campaigns.pipeline_id)
  v_pipes uuid[] := (ARRAY['61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid] || ARRAY(SELECT pipeline_id FROM campaigns WHERE id = '11da18f2-9ea8-4950-9d2a-42416f0aef39'::uuid AND pipeline_id IS NOT NULL));
  v_st_antwort uuid[];
  v_st_termin uuid[];
  v_stage_mailing uuid := 'eed128e9-373f-44a1-aaef-f705ce9511da';
  v_wochentag int := extract(isodow FROM current_date);
  v_mails int; v_bounce_hart int; v_bounce_soft int; v_replies int;
  v_klicks int; v_fehlzuordnung int; v_segment_null int;
  v_domain_max int; v_domain_name text; v_domain_kampagne text;
  v_mails_kampagnen text; v_budget_domains text;
  v_pool int; v_aktive int;
  v_neue_antworten int; v_neue_termine int;
  v_alarm text[] := ARRAY[]::text[];
  v_info text[] := ARRAY[]::text[];
  v_text text;
  -- 24.11.2026 Foerderer-Waechter (Entwurf): Ausfall von Erstmail (HYDA) und Nachfass (MPu8) an Werktagen.
  v_heute_berlin date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_vr_pause boolean;
  v_vr_rest int;
  v_fo_erst_kand int; v_fo_erst_heute int;
  v_fo_nf_ab date; v_fo_nf_kand int; v_fo_nf_heute int;
  v_ausfall text[] := ARRAY[]::text[];  -- v2: Foerderer-Ausfall-Alarme, stehen im Text ganz oben
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
   WHERE d.pipeline_id = ANY(v_pipes) AND d.deleted_at IS NULL
     AND ps.is_outreach_source AND d.segment IS NULL
     AND EXISTS (SELECT 1 FROM werteraum_school_queue q WHERE q.deal_id = d.id);  -- 16.11.2026: Handdeals ohne Queue-Zeile sind kein Versandausfall (Doing 1a83e5a2)

  -- Domain-Cap je Kampagne: Erst- und Nachfassversand teilen sich eine campaign_id und
  -- werden ueber sequence_type getrennt (der Nachfass traegt kein metadata.subject).
  SELECT lower(split_part(c.email,'@',2)), count(*),
         coalesce(k.name, 'ohne Kampagne') || CASE WHEN da.sequence_type = '2nd_mailing' THEN ' · Nachfass' ELSE '' END
    INTO v_domain_name, v_domain_max, v_domain_kampagne
    FROM deal_activities da JOIN contacts c ON c.id = da.contact_id
    LEFT JOIN campaigns k ON k.id = da.campaign_id
   WHERE da.activity_type='email' AND da.deleted_at IS NULL
     AND da.created_at::date = current_date
   GROUP BY da.campaign_id, k.name, da.sequence_type = '2nd_mailing', 1
   ORDER BY 2 DESC, 1, 3 LIMIT 1;

  -- Versand je Kampagne fuer die Infozeile
  SELECT string_agg(label || ' ' || n, ', ' ORDER BY n DESC, label) INTO v_mails_kampagnen
    FROM (SELECT coalesce(k.name, 'ohne Kampagne') || CASE WHEN da.sequence_type = '2nd_mailing' THEN ' · Nachfass' ELSE '' END AS label,
                 count(*) AS n
            FROM deal_activities da LEFT JOIN campaigns k ON k.id = da.campaign_id
           WHERE da.activity_type='email' AND da.deleted_at IS NULL
             AND da.created_at::date = current_date
           GROUP BY da.campaign_id, k.name, da.sequence_type = '2nd_mailing') s;

  -- Tagesbudget gilt je Absenderdomain (wie get_domain_tagesbudget), nicht als Gesamtsumme
  SELECT string_agg(absender_domain || ' ' || n || '/' || lim, ', ' ORDER BY absender_domain) INTO v_budget_domains
    FROM (SELECT k.absender_domain, max(k.tageslimit) AS lim,
                 (SELECT count(*) FROM deal_activities a JOIN campaigns k2 ON k2.id = a.campaign_id
                   WHERE a.activity_type='email' AND a.deleted_at IS NULL
                     AND a.created_at::date = current_date
                     AND k2.absender_domain = k.absender_domain) AS n
            FROM campaigns k
           WHERE k.aktiv AND k.absender_domain IS NOT NULL
           GROUP BY k.absender_domain) b;

  -- Stage-Bewegungen der letzten 24h, die einen Menschen brauchen
  -- Baustufe 2g: Stufen ueber Name in allen Schul-Pipelines; ein Umzug zwischen diesen
  -- Pipelines (pipeline_id alt und neu in v_pipes) ist keine Stufenbewegung.
  v_st_antwort := ARRAY(SELECT id FROM pipeline_stages WHERE pipeline_id = ANY(v_pipes) AND name = 'Antwort erhalten');
  v_st_termin  := ARRAY(SELECT id FROM pipeline_stages WHERE pipeline_id = ANY(v_pipes) AND name = 'Terminiert');
  SELECT count(*) FILTER (WHERE (a.details->'new'->>'pipeline_stage_id')::uuid = ANY(v_st_antwort)),
         count(*) FILTER (WHERE (a.details->'new'->>'pipeline_stage_id')::uuid = ANY(v_st_termin))
    INTO v_neue_antworten, v_neue_termine
    FROM audit_log a
   WHERE a.entity_type='deals' AND a.aktion='UPDATE'
     AND a.created_at >= now() - interval '24 hours'
     AND a.details->'old'->>'pipeline_stage_id'
         IS DISTINCT FROM a.details->'new'->>'pipeline_stage_id'
     AND NOT coalesce((a.details->'old'->>'pipeline_id' IS DISTINCT FROM a.details->'new'->>'pipeline_id'
              AND (a.details->'old'->>'pipeline_id')::uuid = ANY(v_pipes)
              AND (a.details->'new'->>'pipeline_id')::uuid = ANY(v_pipes)), false);

  SELECT count(*) INTO v_aktive FROM get_werteraum_aktive_kampagnen();
  SELECT count(*) INTO v_pool FROM get_werteraum_candidates(100000, NULL, 'grundschule', 100);

  -- Foerderer (viktoria-roadshow.com): Pause aus versand_pausen, Budget aus get_domain_tagesbudget,
  -- Nachfass-Startdatum aus campaign_mailings.geplant_ab (Text Nr. 4, eb871f1f; NULL = nicht scharf).
  SELECT EXISTS (SELECT 1 FROM versand_pausen vp
                  WHERE vp.absender_domain = 'viktoria-roadshow.com'
                    AND v_heute_berlin BETWEEN vp.von AND vp.bis) INTO v_vr_pause;
  SELECT b.rest INTO v_vr_rest FROM get_domain_tagesbudget('viktoria-roadshow.com') b;
  SELECT count(*) INTO v_fo_erst_kand FROM get_vr_foerderer_erst_candidates(1, 2);
  SELECT count(*) INTO v_fo_erst_heute FROM deal_activities
   WHERE activity_type='email' AND deleted_at IS NULL AND sequence_type='stiftung_erstmail_foerderer'
     AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_heute_berlin;
  SELECT (cm.geplant_ab AT TIME ZONE 'Europe/Berlin')::date INTO v_fo_nf_ab
    FROM campaign_mailings cm WHERE cm.id = 'eb871f1f-98fb-4849-b7b6-4ed7d8d1dd79'::uuid;
  SELECT count(*) INTO v_fo_nf_kand FROM get_vr_foerderer_nachfass_candidates(1, 2, 14);
  SELECT count(*) INTO v_fo_nf_heute FROM deal_activities
   WHERE activity_type='email' AND deleted_at IS NULL AND sequence_type='stiftung_nachfass_foerderer'
     AND (created_at AT TIME ZONE 'Europe/Berlin')::date = v_heute_berlin;

  -- ALARME
  IF v_fehlzuordnung > 0 THEN
    v_alarm := v_alarm || format('FEHLZUORDNUNG: %s Mails haengen am falschen Deal', v_fehlzuordnung);
  END IF;

  IF v_wochentag <= 5 AND v_aktive > 0 AND v_pool > 0 AND v_mails = 0 THEN
    v_alarm := v_alarm || format('VERSAND AUSGEFALLEN: 0 Mails an einem Werktag, obwohl %s Kandidaten bereitstehen', v_pool);
  END IF;

  IF v_wochentag <= 5 AND NOT v_vr_pause AND coalesce(v_vr_rest, 0) > 0
     AND v_fo_erst_kand > 0 AND v_fo_erst_heute = 0 THEN
    v_ausfall := v_ausfall || format('AUSFALL: FOERDERER-ERSTMAIL AUSGEFALLEN: 0 Mails heute, obwohl Kandidaten bereitstehen und das Budget viktoria-roadshow.com %s frei hat', v_vr_rest);
  END IF;

  IF v_wochentag <= 5 AND NOT v_vr_pause AND v_fo_nf_ab IS NOT NULL AND v_heute_berlin >= v_fo_nf_ab
     AND coalesce(v_vr_rest, 0) > 0 AND v_fo_nf_kand > 0 AND v_fo_nf_heute = 0 THEN
    v_ausfall := v_ausfall || format('AUSFALL: FOERDERER-NACHFASS AUSGEFALLEN: 0 Mails heute, obwohl Kandidaten faellig sind und das Budget viktoria-roadshow.com %s frei hat', v_vr_rest);
  END IF;

  IF v_mails >= 20 AND v_bounce_hart::numeric / v_mails > 0.08 THEN
    v_alarm := v_alarm || format('BOUNCE-QUOTE %s von %s = %s Prozent. Ueber 20 Prozent gefaehrdet die Domain-Reputation.',
                                 v_bounce_hart, v_mails, round(100.0*v_bounce_hart/v_mails));
  END IF;

  IF v_domain_max > 3 THEN
    v_alarm := v_alarm || format('DOMAIN-CAP DURCHBROCHEN: %s Mails an %s in Kampagne %s (erlaubt 3)', v_domain_max, v_domain_name, v_domain_kampagne);
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
  v_info := v_info || format('Mails heute: %s (%s)', v_mails, coalesce(v_mails_kampagnen, '—'));
  v_info := v_info || format('Tagesbudget je Absenderdomain: %s', coalesce(v_budget_domains, '—'));
  v_info := v_info || format('Bounces: %s hart, %s weich', v_bounce_hart, v_bounce_soft);
  v_info := v_info || format('Antworten: %s | Klicks: %s (Klicks sind womoeglich Gateway-Scanner)', v_replies, v_klicks);
  v_info := v_info || format('Pool Grundschule: %s | aktive Kampagnen: %s', v_pool, v_aktive);
  v_info := v_info || format('Foerderer: Erstmail heute %s (Kandidaten %s) | Nachfass heute %s (faellig %s, scharf ab %s)%s',
                             v_fo_erst_heute, CASE WHEN v_fo_erst_kand > 0 THEN 'ja' ELSE 'nein' END,
                             v_fo_nf_heute, CASE WHEN v_fo_nf_kand > 0 THEN 'ja' ELSE 'nein' END,
                             coalesce(to_char(v_fo_nf_ab,'DD.MM.YYYY'), 'nicht gesetzt'),
                             CASE WHEN v_vr_pause THEN ' | VERSANDPAUSE viktoria-roadshow.com' ELSE '' END);
  v_info := v_info || format('Groesste Empfaengerdomain heute je Kampagne: %s mit %s (%s)', coalesce(v_domain_name,'—'), coalesce(v_domain_max,0), coalesce(v_domain_kampagne,'—'));

  v_text := CASE WHEN array_length(v_ausfall,1) IS NULL AND array_length(v_alarm,1) IS NULL
                 THEN E'✅ WerteRaum Tageswaechter ' || to_char(current_date,'DD.MM.YYYY') || E' — alles im Rahmen\n\n'
                 ELSE CASE WHEN array_length(v_ausfall,1) IS NULL THEN '' ELSE array_to_string(v_ausfall, E'\n') || E'\n\n' END
                      || E'\U0001F6A8 WerteRaum Tageswaechter ' || to_char(current_date,'DD.MM.YYYY') || E'\n\n'
                      || CASE WHEN array_length(v_alarm,1) IS NULL THEN '' ELSE array_to_string(v_alarm, E'\n') || E'\n\n' END
            END
            || array_to_string(v_info, E'\n');

  RETURN json_build_object(
    'text', v_text,
    'alarm', coalesce(array_length(v_ausfall,1), 0) + coalesce(array_length(v_alarm,1), 0) > 0,
    'alarm_anzahl', coalesce(array_length(v_ausfall,1), 0) + coalesce(array_length(v_alarm,1), 0),
    'mails', v_mails, 'bounce_hart', v_bounce_hart, 'bounce_soft', v_bounce_soft,
    'replies', v_replies, 'klicks', v_klicks, 'pool', v_pool,
    'fehlzuordnung', v_fehlzuordnung, 'segment_null', v_segment_null,
    'domain_max', coalesce(v_domain_max,0), 'domain_name', v_domain_name, 'domain_kampagne', v_domain_kampagne,
    'neue_antworten_24h', v_neue_antworten, 'neue_termine_24h', v_neue_termine,
    'foerderer_pause', v_vr_pause, 'foerderer_budget_rest', v_vr_rest,
    'foerderer_erst_heute', v_fo_erst_heute, 'foerderer_erst_kandidaten', v_fo_erst_kand > 0,
    'foerderer_nachfass_heute', v_fo_nf_heute, 'foerderer_nachfass_faellig', v_fo_nf_kand > 0, 'foerderer_nachfass_scharf_ab', v_fo_nf_ab,
    'foerderer_erst_alarm', array_to_string(v_ausfall, '|') LIKE '%FOERDERER-ERSTMAIL AUSGEFALLEN%',
    'foerderer_nachfass_alarm', array_to_string(v_ausfall, '|') LIKE '%FOERDERER-NACHFASS AUSGEFALLEN%'
  );
END
$function$;

NOTIFY pgrst, 'reload schema';
