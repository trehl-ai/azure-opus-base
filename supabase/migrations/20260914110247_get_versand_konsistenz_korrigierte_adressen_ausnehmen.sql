-- 14.09.2026: Regel "Aktivitaet ohne Kontaktstatus" nimmt korrigierte Adressen aus.
--
-- BEFUND: Der Waechter meldete fuenf Faelle — Mail-Aktivitaet vorhanden,
-- Kontakt auf pending. Bei vier davon ist das der GEWOLLTE Zustand: die Mail
-- ging an die ALTE Adresse, danach wurde sie korrigiert und der Kontakt
-- bewusst auf pending gesetzt, damit die Schule die neue Adresse bekommt.
-- korrigiere_mailadresse tut genau das.
--
-- ⚠ DIE REGEL MELDETE EINEN NORMALZUSTAND ALS BEFUND. Das ist die
-- gefaehrlichere Sorte Fehlalarm: wer sie drei Tage sieht, liest den vierten
-- nicht mehr — genau der Grund, warum die alte Versandkontrolle am 11.09.
-- abgeschaltet wurde.
--
-- NEU: ausgenommen wird, wessen Deal eine Notiz "Mailadresse korrigiert"
-- traegt, die NACH der letzten Mail-Aktivitaet entstand. Die Reihenfolge ist
-- entscheidend — eine Korrektur VOR der Mail erklaert einen pending-Kontakt
-- nicht.
--
-- Der fuenfte Fall (St. Peter) faellt weiterhin auf: dort wurde die Adresse
-- am 10.09. von Hand geaendert, ohne korrigiere_mailadresse zu nutzen, und es
-- gibt keine Notiz. Das ist richtig so — eine Handkorrektur ohne Spur SOLL
-- auffallen.
--
-- Alles Uebrige unveraendert.

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

  UNION ALL

  -- NEU: korrigierte Adressen ausgenommen.
  SELECT 'Aktivitaet ohne Kontaktstatus'::text, 'mittel'::text, count(*),
         min(a.created_at)::date, max(a.created_at)::date,
         COALESCE(string_agg(left(c.id::text,8), ', ' ORDER BY a.created_at DESC), '-')
  FROM deal_activities a
  JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
  JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
  WHERE a.activity_type = 'email' AND a.deleted_at IS NULL
    AND a.created_at >= now() - make_interval(days => p_tage)
    AND c.outreach_status = 'pending' AND c.bounce_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM deal_activities k
      WHERE k.deal_id = d.id AND k.deleted_at IS NULL
        AND k.title = 'Mailadresse korrigiert'
        AND k.created_at > a.created_at)

  UNION ALL

  SELECT 'Mail ohne Kampagnenstempel'::text, 'mittel'::text, count(*),
         min(a.created_at)::date, max(a.created_at)::date,
         COALESCE(string_agg(left(a.deal_id::text,8), ', ' ORDER BY a.created_at DESC), '-')
  FROM deal_activities a
  JOIN deals d ON d.id = a.deal_id AND d.deleted_at IS NULL
  WHERE a.activity_type = 'email' AND a.deleted_at IS NULL AND a.campaign_id IS NULL
    AND a.created_at >= now() - make_interval(days => p_tage)
    AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'

  UNION ALL

  SELECT 'Bounce-Quote ueber 15 Prozent des Tages'::text
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
               (x.mails > 0 AND x.bounces::numeric / x.mails > 0.15) AS ueberschritten
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
                  AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
                  AND NOT EXISTS (SELECT 1 FROM deal_activities b
                                  WHERE b.deal_id = a.deal_id AND b.activity_type = 'email'
                                    AND b.deleted_at IS NULL AND b.created_at < a.created_at::date)
                  AND EXISTS (SELECT 1 FROM get_werteraum_aktive_kampagnen() k
                              WHERE k.bundesland = c.bundesland AND k.segment = d.segment)) AS erst_mails) t;
$function$;

COMMENT ON FUNCTION public.get_versand_konsistenz(integer) IS
  'Sieben Befunde zur Versandkonsistenz. Seit 14.09.2026 nimmt "Aktivitaet ohne Kontaktstatus" korrigierte Adressen aus: traegt der Deal eine Notiz "Mailadresse korrigiert", die NACH der Mail-Aktivitaet entstand, ist der pending-Kontakt gewollt — die Mail ging an die alte Adresse, danach wurde sie korrigiert. Eine Handkorrektur ohne Notiz faellt weiterhin auf, und das ist Absicht.';