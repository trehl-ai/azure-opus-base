-- 07.09.2026: Reporter fuer Versandkonsistenz.
--
-- ANLASS: Claude Code hat am 07.09. angemerkt, dass die bestehende
-- Versandkontrolle (jFu4cEmPMc7WaM4e) die FALSCHE DIAGNOSE stellt. Sie zieht
-- ihre Kennzahl aus deal_activities und meldet "kein Versand", wenn der
-- SCHREIBvorgang ausfaellt — obwohl versendet wurde. Wer dem folgt, debuggt den
-- Versandpfad, waehrend der Fehler im Protokollpfad liegt.
--
-- ⚠ WAS DIESER REPORTER NICHT KANN: "versendet gegen protokolliert" vergleichen.
-- Das SMTP-Ergebnis lebt ausschliesslich in den n8n-Executions, die Datenbank
-- kennt es nicht.
--
-- WAS ER STATTDESSEN TUT, und das ist belastbarer:
-- Jeder Versandlauf schreibt an DREI unabhaengigen Stellen —
--   scheduled_mailings.status = 'sent' + sent_at   (nur Nachfass)
--   contacts.outreach_status  = 'email_sent'
--   deal_activities           activity_type 'email'
-- Faellt einer dieser Schreibvorgaenge aus, weichen sie voneinander ab. Genau
-- diese Abweichung ist messbar, ohne n8n zu befragen.
--
-- GEMESSEN BEIM BAU, ueber den gesamten Bestand:
--   A  sent ohne Aktivitaet                      0 Faelle
--   B  Aktivitaet, Kontakt aber pending         10 Faelle, 19.08.-04.09.
--   C  Kontakt email_sent, keine Aktivitaet     25 Faelle, 09.06.-22.08.
--        davon 21 echt, 4 ohne aktiven Deal am Kontakt
-- 31 echte Abweichungen, die nie jemand gemeldet hat.
--
-- Fall B ist der harmlosere: die Mail ist protokolliert, nur der Kontaktstatus
-- fehlt. Fall C ist der gefaehrliche — der Kontakt gilt als angeschrieben,
-- ohne dass eine Mail nachweisbar ist. Er faellt aus jeder Kampagnenzaehlung
-- und aus jeder Nachfassauswahl heraus.
--
-- p_tage begrenzt den Zeitraum. Der taegliche Waechter fragt mit 1 ab, eine
-- Bestandsaufnahme mit 999.

CREATE OR REPLACE FUNCTION public.get_versand_konsistenz(p_tage integer DEFAULT 1)
 RETURNS TABLE(
   befund text, schwere text, faelle bigint,
   aeltester date, juengster date, beispiel_ids text
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- A: Nachfassmail als versendet markiert, aber nicht protokolliert
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

  -- C: Kontakt gilt als angeschrieben, keine Mail nachweisbar.
  -- Der gefaehrlichere Fall: faellt aus Kampagnenzaehlung und Nachfassauswahl.
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

  -- B: Mail protokolliert, Kontaktstatus nicht nachgezogen. Harmloser —
  -- die Mail ist nachweisbar, nur der Status hinkt.
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

  -- D: Mail versendet, aber ungestempelt. Seit dem Trigger vom 07.09. sollte
  -- das bei WerteRaum-Grundschulen nicht mehr vorkommen. Bei weiterfuehrenden
  -- Schulen muss der Workflow den Stempel liefern — dort ist es ein echter
  -- Befund.
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
    AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e';
$function$;

COMMENT ON FUNCTION public.get_versand_konsistenz(integer) IS
  'Vergleicht die DREI unabhaengigen Schreibvorgaenge eines Versandlaufs gegeneinander: scheduled_mailings.status, contacts.outreach_status und deal_activities. Weichen sie ab, ist ein Schreibvorgang ausgefallen. Kann NICHT gegen das SMTP-Ergebnis pruefen — das lebt nur in den n8n-Executions. Ersetzt die Diagnose der Versandkontrolle jFu4cEmPMc7WaM4e, die einen Protokollausfall als "kein Versand" meldet.';

REVOKE ALL ON FUNCTION public.get_versand_konsistenz(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_versand_konsistenz(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_versand_konsistenz(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_versand_konsistenz(integer) TO authenticated;