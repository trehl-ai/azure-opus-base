-- 12.09.2026: drei Regeln aus get_werteraum_versandkontrolle uebernommen,
-- damit jFu4cEmPMc7WaM4e abgeschaltet werden kann.
--
-- ANLASS: jFu4 meldete fuenf Tage in Folge ACHTUNG mit denselben Dauerbrennern,
-- alle gemessen FALSCH. Die Kontrolle stammt aus einer Zeit mit EINEM
-- Versandworkflow; heute sind es drei mit drei Budgets.
--   budget=50 gilt nur fuer den Erstversand, gezaehlt wurden alle drei
--     Strecken -> "99 > 50" gemeldet, tatsaechlich 44+45+10
--   "aktive Kampagne" aus werteraum_kampagnen_plan — das 2. Mailing prueft den
--     Plan bewusst NICHT -> vier BW-Nachfassmails als "fremd" gemeldet
--   Domain-Cap gilt nur im Erstversand, gezaehlt ueber alle
--   Ausweichkontakt ist KEIN Fehlversand: alle Treffer sind Schulen mit zwei
--     Kontakten, deren primary_contact_id geblockt ist
--
-- UEBERNOMMEN werden nur die drei Regeln, die es sonst nirgends gibt.
-- NICHT uebernommen: die Antworten-Regel — der Reply-Intake meldet jede
-- Antwort bereits einzeln. Eine zweite Meldung derselben Sache ist genau das
-- Rauschen, das abgestellt werden soll.
--
-- Form bleibt: befund / schwere / faelle / aeltester / juengster / beispiel_ids.
-- Der Bewerten-Node in 1WVq filtert faelle = 0 und schweigt bei 0/0.
--
-- DIE DREI NEUEN SIND TAGESBEZOGEN (current_date), nicht p_tage:
--   Bounces landen innerhalb von zwei Minuten nach dem 08:00-Versand
--     (gemessen 28.08.-11.09.: 06:00:15Z-06:01:32Z). Ein alter Bounce-Tag ist
--     nicht behebbar und wuerde sieben Tage lang wiederholt.
--   Plausible: Kontrollmessung 10/10 Laeufe hatten max(stat_datum) =
--     Tagesdatum. Das Praedikat feuert an gueltigen Tagen nicht.
--   Erstversand: nur l5oYTyjUlmQvisfz zieht aus get_werteraum_candidates.
--     Nachfass und Fit & Aktiv haben eigene Warteschlangen.
--
-- ⚠ DIE BOUNCE-QUOTE ZAEHLT EMPFAENGER, NICHT AKTIVITAETEN —
-- distinct (deal_id, contact_id). Seit dem 10.09. legt der Bounce-Intake
-- denselben Bounce mehrfach ab: 11.09. zehn Aktivitaeten fuer vier Deals.
-- Ueber Aktivitaeten gezaehlt waere die Quote 10 Prozent statt tatsaechlich 4.
-- ⚠ DIE MEHRFACHEINTRAEGE SIND KEINE DUBLETTEN, sondern der Beleg fuer
-- DREIFACHEN VERSAND: n8n prueft checkFailure auf data[0][0].json.error VOR
-- dem Routing in den Fehlerausgang. Scheitert Item 0 einer Charge, gilt der
-- GANZE Node als gescheitert und wird mit ALLEN Items wiederholt —
-- retryOnFail und continueErrorOutput schliessen sich bei Stapelverarbeitung
-- gegenseitig aus. Am 10. und 11.09. bekamen dadurch 48 bzw. 45 Schulen die
-- Nachfassmail dreifach. Die Reparatur ist retryOnFail=false am
-- Send-Email-Node, nicht diese Funktion.
--
-- Entwurf von Claude Code, md5 d7586c5a9198e8151f16ceaee2cce0e6.

CREATE OR REPLACE FUNCTION public.get_versand_konsistenz(p_tage integer DEFAULT 1)
 RETURNS TABLE(befund text, schwere text, faelle bigint, aeltester date, juengster date, beispiel_ids text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'sent ohne Aktivitaet'::text,
         'hoch'::text,
         count(*),
         min(sm.sent_at)::date,
         max(sm.sent_at)::date,
         COALESCE(string_agg(left(sm.deal_id::text,8), ', ' ORDER BY sm.sent_at DESC), '-')
  FROM scheduled_mailings sm
  WHERE sm.status = 'sent'
    AND sm.sent_at IS NOT NULL
    AND sm.sent_at >= now() - make_interval(days => p_tage)
    AND NOT EXISTS (
      SELECT 1 FROM deal_activities a
      WHERE a.deal_id = sm.deal_id AND a.activity_type = 'email'
        AND a.deleted_at IS NULL
        AND a.created_at::date = sm.sent_at::date)

  UNION ALL

  SELECT 'Kontakt email_sent ohne Aktivitaet'::text,
         'hoch'::text,
         count(*),
         min(c.updated_at)::date,
         max(c.updated_at)::date,
         COALESCE(string_agg(left(c.id::text,8), ', ' ORDER BY c.updated_at DESC), '-')
  FROM contacts c
  WHERE c.outreach_status = 'email_sent'
    AND c.deleted_at IS NULL
    AND c.updated_at >= now() - make_interval(days => p_tage)
    AND EXISTS (SELECT 1 FROM deals d
                WHERE d.primary_contact_id = c.id AND d.deleted_at IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM deals d JOIN deal_activities a ON a.deal_id = d.id
      WHERE d.primary_contact_id = c.id AND a.activity_type = 'email'
        AND a.deleted_at IS NULL)

  UNION ALL

  SELECT 'Aktivitaet ohne Kontaktstatus'::text,
         'mittel'::text,
         count(*),
         min(a.created_at)::date,
         max(a.created_at)::date,
         COALESCE(string_agg(left(c.id::text,8), ', ' ORDER BY a.created_at DESC), '-')
  FROM deal_activities a
  JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
  JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
  WHERE a.activity_type = 'email'
    AND a.deleted_at IS NULL
    AND a.created_at >= now() - make_interval(days => p_tage)
    AND c.outreach_status = 'pending'
    AND c.bounce_at IS NULL

  UNION ALL

  SELECT 'Mail ohne Kampagnenstempel'::text,
         'mittel'::text,
         count(*),
         min(a.created_at)::date,
         max(a.created_at)::date,
         COALESCE(string_agg(left(a.deal_id::text,8), ', ' ORDER BY a.created_at DESC), '-')
  FROM deal_activities a
  JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
  WHERE a.activity_type = 'email'
    AND a.deleted_at IS NULL
    AND a.campaign_id IS NULL
    AND a.created_at >= now() - make_interval(days => p_tage)
    AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'

  UNION ALL

  -- E: Bounce-Quote des Tages ueber 15 Prozent. Empfaenger, nicht Aktivitaeten.
  SELECT 'Bounce-Quote ueber 15 Prozent des Tages'::text
           || CASE WHEN t.ueberschritten
                   THEN ' (' || t.bounces || ' von ' || t.mails || ' Mails = '
                        || round(100.0 * t.bounces / t.mails) || ' %)'
                   ELSE '' END,
         'hoch'::text,
         CASE WHEN t.ueberschritten THEN t.bounces ELSE 0 END,
         current_date,
         current_date,
         CASE WHEN t.ueberschritten
              THEN COALESCE((SELECT string_agg(DISTINCT left(b.deal_id::text,8), ', ')
                             FROM deal_activities b
                             WHERE b.activity_type = 'bounce' AND b.deleted_at IS NULL
                               AND b.created_at::date = current_date), '-')
              ELSE '-' END
  FROM (
    SELECT x.mails, x.bounces,
           (x.mails > 0 AND x.bounces::numeric / x.mails > 0.15) AS ueberschritten
    FROM (
      SELECT (SELECT count(*) FROM deal_activities
               WHERE activity_type = 'email' AND deleted_at IS NULL
                 AND created_at::date = current_date)  AS mails,
             (SELECT count(DISTINCT (deal_id, contact_id)) FROM deal_activities
               WHERE activity_type = 'bounce' AND deleted_at IS NULL
                 AND created_at::date = current_date)  AS bounces
    ) x
  ) t

  UNION ALL

  -- F: Plausible-Sync haengt.
  SELECT 'Plausible-Sync haengt, Mails ohne Klick-Erfassung (Stand '
           || COALESCE(t.stand::text, 'nie') || ')',
         'mittel'::text,
         CASE WHEN t.mails > 0 AND (t.stand IS NULL OR t.stand < current_date)
              THEN t.mails ELSE 0 END,
         COALESCE(t.stand, current_date),
         current_date,
         '-'::text
  FROM (
    SELECT (SELECT count(*) FROM deal_activities
             WHERE activity_type = 'email' AND deleted_at IS NULL
               AND created_at::date = current_date)             AS mails,
           (SELECT max(stat_datum) FROM werteraum_kampagnen_stats) AS stand
  ) t

  UNION ALL

  -- G: Kein ERSTVERSAND trotz offener Kandidaten, Mo-Fr.
  SELECT 'Kein Erstversand trotz offener Kandidaten (Mo-Fr)'::text,
         'mittel'::text,
         CASE WHEN t.werktag AND t.erst_mails = 0
              THEN (SELECT count(*)
                    FROM get_werteraum_aktive_kampagnen() k
                    CROSS JOIN LATERAL get_werteraum_candidates(100000, k.bundesland, k.segment, 3) c)
              ELSE 0 END,
         current_date,
         current_date,
         CASE WHEN t.werktag AND t.erst_mails = 0
              THEN COALESCE((SELECT string_agg(left(c.deal_id::text,8), ', ')
                             FROM (SELECT c.deal_id
                                   FROM get_werteraum_aktive_kampagnen() k
                                   CROSS JOIN LATERAL get_werteraum_candidates(6, k.bundesland, k.segment, 3) c
                                   LIMIT 6) c), '-')
              ELSE '-' END
  FROM (
    SELECT extract(dow FROM current_date) BETWEEN 1 AND 5 AS werktag,
           (SELECT count(*)
            FROM deal_activities a
            JOIN deals d ON d.id = a.deal_id
            LEFT JOIN contacts c ON c.id = a.contact_id
            WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
              AND a.created_at::date = current_date
              AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
              AND NOT EXISTS (SELECT 1 FROM deal_activities b
                              WHERE b.deal_id = a.deal_id AND b.activity_type = 'email'
                                AND b.deleted_at IS NULL
                                AND b.created_at < a.created_at::date)
              AND EXISTS (SELECT 1 FROM get_werteraum_aktive_kampagnen() k
                          WHERE k.bundesland = c.bundesland AND k.segment = d.segment)
           ) AS erst_mails
  ) t;
$function$;

COMMENT ON FUNCTION public.get_versand_konsistenz(integer) IS
  'Sieben Befunde. Vier zur Konsistenz der drei Schreibvorgaenge je Versandlauf, drei uebernommen aus get_werteraum_versandkontrolle (jFu4cEmPMc7WaM4e, seit 11.09.2026 deaktiviert): Bounce-Quote, Plausible-Sync, kein Erstversand trotz Kandidaten. Die drei neuen sind tagesbezogen statt p_tage. Die Bounce-Quote zaehlt EMPFAENGER (distinct deal_id, contact_id) — seit dem 10.09. erzeugt ein Node-Retry bei Fehlschlag von Item 0 mehrfache Sendungen und damit mehrfache Bounces.';
