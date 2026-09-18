-- 18.09.2026: Der Nachfass laesst Wiedervorlage-Deals in Ruhe.
--
-- ⚠ BEFUND VON HEUTE FRUEH, von Claude Code an einem echten Lauf gemessen:
-- kgFT hat um 10:00 zwei Mails an Deals geschickt, die gestern bewusst in die
-- WIEDERVORLAGE gestellt wurden — Georg-Buechner-Schule Kassel und
-- Cuno-Raabe-Schule Fulda. Beide hatten GEKLICKT.
-- Sie bekamen eine dritte Mail statt eines Anrufs.
--
-- URSACHE: Die Funktion prueft die Stufe bereits, aber 'Wiedervorlage' fehlt
-- in der Ausschlussliste. Ihre scheduled_mailings standen seit dem 17.09.
-- auf pending und blieben beim Stufenwechsel stehen.
-- ⚠ EINE MAIL HAENGT AN DREI STELLEN — Aktivitaet, outreach_status,
-- scheduled_mailings. Beim Verschieben in die Wiedervorlage habe ich nur die
-- Stufe angefasst. Dieselbe Lehre wie bei gib_deal_wieder_frei, nur
-- andersherum.
--
-- ZWEI AENDERUNGEN:
--   'Wiedervorlage' kommt in die Ausschlussliste. Wer dort steht, wartet auf
--   einen Menschen, nicht auf eine Mail.
--   Die Anrede nutzt jetzt anrede_team_oder_kollegium — dieselbe Funktion wie
--   die beiden Kandidaten-RPCs. Sonst schriebe der Nachfass weiter
--   "Liebes Team der Dortmund, Gym Helmholtz", waehrend der Erstversand es
--   seit gestern richtig macht.
--
-- ⚠ 'Erneutes Mailing' bleibt DRIN, also erlaubt: diese Stufe ist fuer
-- Schulen gedacht, die noch eine Ansprache bekommen sollen.

CREATE OR REPLACE FUNCTION public.get_due_second_mailings(p_limit integer DEFAULT 50)
 RETURNS TABLE(scheduled_mailing_id uuid, deal_id uuid, deal_title text, contact_id uuid,
               first_name text, last_name text, anrede text, anrede_final text, email text,
               outreach_hook text, company_name text, bundesland text, segment text,
               utm_campaign text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    sm.id,
    d.id,
    d.title,
    c.id,
    c.first_name,
    c.last_name,
    c.anrede,
    CASE
      WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
        OR btrim(c.last_name) ILIKE 'schulleitung'
        -- Seit 18.09.2026 dieselbe Anrede-Logik wie im Erstversand: bei
        -- Firmennamen im NRW-Muster "Ort, Kuerzel Name" weicht sie auf
        -- "Liebes Kollegium" aus.
        THEN anrede_team_oder_kollegium(co.name)
      WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
      WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
      ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
    END AS anrede_final,
    c.email,
    c.outreach_hook,
    co.name,
    c.bundesland,
    d.segment,
    k.utm_campaign
  FROM scheduled_mailings sm
  JOIN deals d ON d.id = sm.deal_id
  JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  LEFT JOIN contacts c ON c.id = sm.contact_id
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN LATERAL (
    SELECT p.utm_campaign
    FROM werteraum_kampagnen_plan p
    WHERE p.bundesland = c.bundesland
      AND p.segment = d.segment
      AND p.aktiv
    ORDER BY p.start_datum DESC, p.created_at DESC
    LIMIT 1
  ) k ON true
  WHERE sm.status = 'pending'
    AND sm.scheduled_at <= now()
    AND sm.mailing_type = '2nd_mailing'
    AND c.email IS NOT NULL
    AND c.email != ''
    AND c.deleted_at IS NULL
    AND d.deleted_at IS NULL
    AND co.deleted_at IS NULL
    AND c.bounce_at IS NULL
    AND COALESCE(c.outreach_status,'') NOT IN
        ('replied','terminated','blocked_widerspruch','blocked_behoerde','blocked_unklare_adresse')
    AND d.status = 'open'
    -- NEU 18.09.2026: 'Wiedervorlage' ergaenzt. Wer dort steht, wartet auf
    -- einen Menschen — heute frueh bekamen zwei Klicker eine dritte Mail
    -- statt eines Anrufs, weil die Stufe hier fehlte.
    AND ps.name NOT IN ('Antwort erhalten','Terminiert','Angebot erstellt','Verhandlung',
                        'Gewonnen','Verloren','Blacklist','Wiedervorlage')
    AND NOT EXISTS (
      SELECT 1 FROM marketing_opt_out mo
      WHERE mo.email_normalized = lower(btrim(c.email))
    )
  ORDER BY sm.scheduled_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_due_second_mailings(integer) IS
  'Faellige Zweitmailings. Schliesst Stufen aus, in denen eine weitere Mail schaedlich waere — seit 18.09.2026 auch "Wiedervorlage": dort warten Schulen auf einen Anruf, und zwei Klicker bekamen an diesem Morgen eine dritte Mail statt eines Gespraechs. Die Anrede nutzt anrede_team_oder_kollegium wie der Erstversand.';