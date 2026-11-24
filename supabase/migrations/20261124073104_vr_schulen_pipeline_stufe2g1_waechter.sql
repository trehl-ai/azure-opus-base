-- Baustufe 2g-D1: Waechter zaehlen F&A nach dem Pipeline-Umzug weiter mit.
-- Pipeline-Menge = WR 61b1b7e2 || campaigns.pipeline_id der Kampagne 11da18f2
-- ("VR Fit & Aktiv — Schulen"); heute nur WR -> identische Rueckgabe (md5 gleich belegt).
-- wr_tageswaechter: segment_null ueber die Menge; 24h-Bewegungen "Antwort erhalten"/"Terminiert"
-- ueber den Stufennamen in allen Pipelines der Menge statt fester WR-IDs; ein Umzug zwischen
-- Pipelines der Menge (pipeline_id alt und neu in der Menge) ist keine Stufenbewegung.
-- get_versand_konsistenz: "Mail ohne Kampagnenstempel" und "Kein Erstversand" ueber die Menge;
-- Erstversand-Befund zaehlt F&A-Erstmails unveraendert mit (Entscheidung 6).
-- Signaturen, STABLE, SECURITY DEFINER, search_path und Grants unveraendert (CREATE OR REPLACE
-- behaelt proacl). Aufrufer: n8n gyBXWy9asqZXsd9L (21-Uhr-Ast), 1WVqmCoYs07HtQAd (07:30/09:00).

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

  -- ALARME
  IF v_fehlzuordnung > 0 THEN
    v_alarm := v_alarm || format('FEHLZUORDNUNG: %s Mails haengen am falschen Deal', v_fehlzuordnung);
  END IF;

  IF v_wochentag <= 5 AND v_aktive > 0 AND v_pool > 0 AND v_mails = 0 THEN
    v_alarm := v_alarm || format('VERSAND AUSGEFALLEN: 0 Mails an einem Werktag, obwohl %s Kandidaten bereitstehen', v_pool);
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
  v_info := v_info || format('Groesste Empfaengerdomain heute je Kampagne: %s mit %s (%s)', coalesce(v_domain_name,'—'), coalesce(v_domain_max,0), coalesce(v_domain_kampagne,'—'));

  v_text := CASE WHEN array_length(v_alarm,1) IS NULL
                 THEN E'✅ WerteRaum Tageswaechter ' || to_char(current_date,'DD.MM.YYYY') || E' — alles im Rahmen\n\n'
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
    'domain_max', coalesce(v_domain_max,0), 'domain_name', v_domain_name, 'domain_kampagne', v_domain_kampagne,
    'neue_antworten_24h', v_neue_antworten, 'neue_termine_24h', v_neue_termine
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.get_versand_konsistenz(p_tage integer DEFAULT 1)
 RETURNS TABLE(befund text, schwere text, faelle bigint, aeltester date, juengster date, beispiel_ids text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'sent ohne Aktivitaet'::text, 'hoch'::text, count(*),
         min(sm.sent_at)::date, max(sm.sent_at)::date,
         COALESCE(string_agg(left(sm.deal_id::text,8), ', ' ORDER BY sm.sent_at DESC), '-')
  FROM scheduled_mailings sm
  WHERE sm.status = 'sent' AND sm.sent_at IS NOT NULL
    AND sm.sent_at >= now() - make_interval(days => p_tage)
    AND NOT EXISTS (SELECT 1 FROM deal_activities a
      WHERE a.deal_id = sm.deal_id AND a.activity_type = 'email'
        AND a.deleted_at IS NULL AND a.created_at::date = sm.sent_at::date)

  UNION ALL

  SELECT 'Kontakt email_sent ohne Aktivitaet'::text, 'hoch'::text, count(*),
         min(c.updated_at)::date, max(c.updated_at)::date,
         COALESCE(string_agg(left(c.id::text,8), ', ' ORDER BY c.updated_at DESC), '-')
  FROM contacts c
  WHERE c.outreach_status = 'email_sent' AND c.deleted_at IS NULL
    AND c.updated_at >= now() - make_interval(days => p_tage)
    AND EXISTS (SELECT 1 FROM deals d WHERE d.primary_contact_id = c.id AND d.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM deals d JOIN deal_activities a ON a.deal_id = d.id
      WHERE d.primary_contact_id = c.id AND a.activity_type = 'email' AND a.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM deal_activities a
      WHERE a.contact_id = c.id AND a.activity_type = 'email' AND a.deleted_at IS NULL)

  UNION ALL

  SELECT 'Aktivitaet ohne Kontaktstatus'::text, 'mittel'::text, count(*),
         min(a.created_at)::date, max(a.created_at)::date,
         COALESCE(string_agg(left(c.id::text,8), ', ' ORDER BY a.created_at DESC), '-')
  FROM deal_activities a
  JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
  JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
  WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
    AND a.created_at >= now() - make_interval(days => p_tage)
    AND c.outreach_status = 'pending' AND c.bounce_at IS NULL
    AND (a.contact_id IS NULL OR a.contact_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM deal_activities k
      WHERE k.deal_id = d.id AND k.deleted_at IS NULL
        AND k.title = 'Mailadresse korrigiert' AND k.created_at > a.created_at)

  UNION ALL

  SELECT 'Mail ohne Kampagnenstempel'::text, 'mittel'::text, count(*),
         min(a.created_at)::date, max(a.created_at)::date,
         COALESCE(string_agg(left(a.deal_id::text,8), ', ' ORDER BY a.created_at DESC), '-')
  FROM deal_activities a
  JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
  WHERE a.activity_type = 'email' AND a.deleted_at IS NULL AND a.campaign_id IS NULL
    AND a.created_at >= now() - make_interval(days => p_tage)
    AND d.pipeline_id = ANY(ARRAY['61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid] || ARRAY(SELECT pipeline_id FROM campaigns WHERE id = '11da18f2-9ea8-4950-9d2a-42416f0aef39'::uuid AND pipeline_id IS NOT NULL))

  UNION ALL

  SELECT 'Bounce-Quote ueber 8 Prozent des Tages (ab 20 Mails)'::text
           || CASE WHEN t.ueberschritten
                   THEN ' (' || t.bounces || ' von ' || t.mails || ' Mails = '
                        || round(100.0 * t.bounces / t.mails) || ' %)' ELSE '' END,
         'hoch'::text,
         CASE WHEN t.ueberschritten THEN t.bounces ELSE 0 END,
         current_date, current_date,
         CASE WHEN t.ueberschritten
              THEN COALESCE((SELECT string_agg(DISTINCT left(b.deal_id::text,8), ', ')
                             FROM deal_activities b
                             WHERE b.activity_type = 'bounce' AND b.deleted_at IS NULL
                               AND b.created_at::date = current_date), '-')
              ELSE '-' END
  FROM (SELECT x.mails, x.bounces,
               (x.mails >= 20 AND x.bounces::numeric / x.mails > 0.08) AS ueberschritten
        FROM (SELECT (SELECT count(*) FROM deal_activities
                       WHERE activity_type = 'email' AND deleted_at IS NULL
                         AND created_at::date = current_date) AS mails,
                     (SELECT count(DISTINCT (deal_id, contact_id)) FROM deal_activities
                       WHERE activity_type = 'bounce' AND deleted_at IS NULL
                         AND created_at::date = current_date) AS bounces) x) t

  UNION ALL

  SELECT 'Plausible-Sync haengt, Mails ohne Klick-Erfassung (Stand '
           || COALESCE(t.stand::text, 'nie') || ')',
         'mittel'::text,
         CASE WHEN t.mails > 0 AND (t.stand IS NULL OR t.stand < current_date)
              THEN t.mails ELSE 0 END,
         COALESCE(t.stand, current_date), current_date, '-'::text
  FROM (SELECT (SELECT count(*) FROM deal_activities
                 WHERE activity_type = 'email' AND deleted_at IS NULL
                   AND created_at::date = current_date) AS mails,
               (SELECT max(stat_datum) FROM werteraum_kampagnen_stats) AS stand) t

  UNION ALL

  SELECT 'Kein Erstversand trotz offener Kandidaten (Mo-Fr)'::text, 'mittel'::text,
         CASE WHEN t.werktag AND t.erst_mails = 0
              THEN (SELECT count(*) FROM get_werteraum_aktive_kampagnen() k
                    CROSS JOIN LATERAL get_werteraum_candidates(100000, k.bundesland, k.segment, 3) c)
              ELSE 0 END,
         current_date, current_date,
         CASE WHEN t.werktag AND t.erst_mails = 0
              THEN COALESCE((SELECT string_agg(left(c.deal_id::text,8), ', ')
                             FROM (SELECT c.deal_id FROM get_werteraum_aktive_kampagnen() k
                                   CROSS JOIN LATERAL get_werteraum_candidates(6, k.bundesland, k.segment, 3) c
                                   LIMIT 6) c), '-')
              ELSE '-' END
  FROM (SELECT extract(dow FROM current_date) BETWEEN 1 AND 5 AS werktag,
               (SELECT count(*) FROM deal_activities a
                JOIN deals d ON d.id = a.deal_id
                LEFT JOIN contacts c ON c.id = a.contact_id
                WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
                  AND a.created_at::date = current_date
                  AND d.pipeline_id = ANY(ARRAY['61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid] || ARRAY(SELECT pipeline_id FROM campaigns WHERE id = '11da18f2-9ea8-4950-9d2a-42416f0aef39'::uuid AND pipeline_id IS NOT NULL))
                  AND NOT EXISTS (SELECT 1 FROM deal_activities b
                                  WHERE b.deal_id = a.deal_id AND b.activity_type = 'email'
                                    AND b.deleted_at IS NULL AND b.created_at < a.created_at::date)
                  AND EXISTS (SELECT 1 FROM get_werteraum_aktive_kampagnen() k
                              WHERE k.bundesland = c.bundesland AND k.segment = d.segment)) AS erst_mails) t

  UNION ALL

  -- ACHTER BEFUND, blickt nach VORN: zwei Kandidaten an derselben Firma.
  -- Die Dedup laeuft ueber die Adresse; zwei VERSCHIEDENE Adressen an einer
  -- Firma laufen beide durch. Entsteht durch Adresskorrektur an einem
  -- Zwillingsdeal.
  SELECT 'Zwei Kandidaten an derselben Firma — Doppelversand steht bevor'::text,
         'hoch'::text,
         (SELECT count(*) FROM (
            SELECT d.company_id
            FROM get_werteraum_aktive_kampagnen() ak
            CROSS JOIN LATERAL get_werteraum_candidates(100000, ak.bundesland, ak.segment, 3) k
            JOIN deals d ON d.id = k.deal_id
            WHERE d.company_id IS NOT NULL
            GROUP BY d.company_id HAVING count(*) > 1) x),
         current_date, current_date,
         COALESCE((SELECT string_agg(DISTINCT left(y.company_id::text,8), ', ')
                   FROM (SELECT d.company_id
                         FROM get_werteraum_aktive_kampagnen() ak
                         CROSS JOIN LATERAL get_werteraum_candidates(100000, ak.bundesland, ak.segment, 3) k
                         JOIN deals d ON d.id = k.deal_id
                         WHERE d.company_id IS NOT NULL
                         GROUP BY d.company_id HAVING count(*) > 1) y), '-');
$function$;
