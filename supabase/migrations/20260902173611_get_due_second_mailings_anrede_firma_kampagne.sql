-- 02.09.2026: get_due_second_mailings liefert anrede_final, company_name,
-- bundesland und segment mit.
--
-- ANLASS: Beim Austausch des Nachfasstextes fiel auf, dass die Funktion nur
-- scheduled_mailings -> deals -> contacts joint. Drei Luecken derselben Wurzel:
--
-- 1. anrede_final fehlte. Die Erstmail hat dafuer eine Fallunterscheidung: fehlt
--    der Name oder heisst der Nachname "Schulleitung", wird daraus
--    "Liebes Team der <Schule>". Ohne sie schreibt die Nachfassmail
--    "Sehr geehrte/r  ," an jeden Kontakt ohne Namen — bei Schulen die Mehrheit.
--    Die Logik unten ist WORTGLEICH aus get_werteraum_candidates uebernommen,
--    nicht nachgebaut. Wer eine der beiden aendert, muss die andere mitaendern.
-- 2. company_name fehlte. Der Betreff soll den Schulnamen tragen, nicht
--    deals.title — der enthaelt bei WerteRaum-Deals einen Ortszusatz in Klammern
--    und liest sich im Betreff ungelenk.
-- 3. bundesland und segment fehlten. Ohne sie kann der Workflow das
--    Kampagnensegment fuer den Kurzlink nicht bilden und faellt auf den festen
--    Wert outreach2026 zurueck — womit die Plausible-Zuordnung, die die Erstmail
--    herstellt, unterlaufen wird.
--
-- Signaturwechsel: RETURNS TABLE aendert sich, deshalb DROP und Neuanlage.
-- p_limit DEFAULT 50 bleibt unveraendert (siehe 20260902170409).

DROP FUNCTION IF EXISTS public.get_due_second_mailings(integer);

CREATE OR REPLACE FUNCTION public.get_due_second_mailings(p_limit integer DEFAULT 50)
 RETURNS TABLE(scheduled_mailing_id uuid, deal_id uuid, deal_title text, contact_id uuid, first_name text, last_name text, anrede text, anrede_final text, email text, outreach_hook text, company_name text, bundesland text, segment text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
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
        THEN 'Liebes Team der ' || co.name
      WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
      WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
      ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
    END AS anrede_final,
    c.email,
    c.outreach_hook,
    co.name,
    c.bundesland,
    d.segment
  FROM scheduled_mailings sm
  JOIN deals d ON d.id = sm.deal_id
  LEFT JOIN contacts c ON c.id = sm.contact_id
  LEFT JOIN companies co ON co.id = d.company_id
  WHERE sm.status = 'pending'
    AND sm.scheduled_at <= now()
    AND sm.mailing_type = '2nd_mailing'
    AND c.email IS NOT NULL
    AND c.email != ''
    -- Dieselben Sperren wie im Erstversand. Ein Widerspruch oder ein Hard Bounce
    -- darf die Nachfassstrecke nicht passieren, nur weil der Datensatz vor der
    -- Sperre eingeplant wurde.
    AND c.deleted_at IS NULL
    AND d.deleted_at IS NULL
    AND co.deleted_at IS NULL
    AND c.bounce_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM marketing_opt_out mo
      WHERE mo.email_normalized = lower(btrim(c.email))
    )
  ORDER BY sm.scheduled_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_due_second_mailings(integer) IS
  'Faellige Nachfassmails, gedeckelt (DEFAULT 50). Liefert anrede_final, company_name, bundesland und segment fuer Betreff, Anrede und Kurzlink. Anredelogik wortgleich zu get_werteraum_candidates — beide gemeinsam aendern. Prueft bounce_at, deleted_at auf Kontakt, Deal und Firma sowie marketing_opt_out.';