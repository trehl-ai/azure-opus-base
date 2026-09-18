-- 18.09.2026: Konsolidierung — plane_zweitkontakte nimmt "Wiedervorlage" nicht mehr als Quelle.
--
-- ⚠ DRIFT-BEFUND (der vierte dieser Art in zwei Tagen): Der Ausschluss lief am
-- 18.09. als DO-Block — ein DO-Block hinterlaesst keine Version.
-- Hintergrund: Die Stufe "Wiedervorlage" wurde fuer zwei Dinge benutzt — als
-- Zwischenstation vor dem Nachfass (59 Wechsel Wiedervorlage -> 2. Mailing im
-- September) und seit dem 17.09. als Ablage fuer Klicker, die ANGERUFEN werden
-- sollen. Solange plane_zweitkontakte sie als Quelle nahm, schob O3hW sie nach
-- "2. Mailing", und der Ausschluss in get_due_second_mailings griff nicht mehr.
-- Trockenlauf 18.09. nach dem Fix: 0 Wiedervorlage-Deals, 130 regulaer faellig.
--
-- Diese Migration schreibt den LIVE-STAND der Funktion 1:1 fest
-- (pg_get_functiondef, md5 vorher 5e5e661c…). Sie aendert am Laufzeitverhalten
-- nichts; Nachweis: md5 nach dem Apply identisch.

CREATE OR REPLACE FUNCTION public.plane_zweitkontakte(p_limit integer DEFAULT 50, p_mindestalter_tage integer DEFAULT 25, p_trockenlauf boolean DEFAULT false)
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
      -- 18.09.2026: "Wiedervorlage" ist KEINE Quelle mehr fuer Zweitkontakte.
      -- ⚠ Die Stufe wurde fuer zwei Dinge benutzt: als Zwischenstation vor dem
      -- Nachfass (59 Wechsel im September) UND, seit dem 17.09., als Ablage
      -- fuer Schulen, die ANGERUFEN werden sollen — Klicker, bei denen eine
      -- weitere Mail der falsche Schritt waere.
      -- Beides geht nicht. get_due_second_mailings schliesst die Stufe seit
      -- heute aus; solange plane_zweitkontakte sie als Quelle nimmt, schiebt
      -- O3hW sie einfach nach "2. Mailing" und der Ausschluss greift nicht
      -- mehr. Der Schutz waere eine Attrappe gewesen.
      -- ⚠ FOLGE, die jemand tragen muss: Wer in der Wiedervorlage liegt und
      -- nicht angerufen wird, bekommt gar nichts mehr. Die Aktionsliste muss
      -- sie zeigen.
      AND ps.name IN ('Mailing erhalten','Erneutes Mailing')
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