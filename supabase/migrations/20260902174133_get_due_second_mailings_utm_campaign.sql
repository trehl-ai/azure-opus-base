-- 02.09.2026: get_due_second_mailings liefert utm_campaign mit.
--
-- ANLASS: Ohne sie faellt der Workflow auf den festen Wert 'werteraum-outreach2026'
-- zurueck. Die Nachfassmails landen in Plausible dann alle unter derselben Kampagne,
-- statt unter der Bundesland-/Wellenkampagne, die die Erstmail herstellt.
--
-- WICHTIG — warum nicht der naheliegende LEFT JOIN:
-- werteraum_kampagnen_plan hat KEINEN Unique-Constraint auf (bundesland, segment),
-- nur den Primaerschluessel auf id. Heute sind 65 Zeilen drin und keine Doppelung.
-- Sobald aber eine zweite Welle eingetragen wird (werteraum-by-w2 neben
-- werteraum-by-w1), liefert ein einfacher LEFT JOIN ZWEI Zeilen pro Mailing —
-- und die Schule bekaeme die Nachfassmail doppelt.
-- Deshalb LATERAL mit ausdruecklicher Auswahl: die zuletzt gestartete aktive
-- Kampagne gewinnt, hoechstens eine Zeile.
--
-- Die Kampagne ist ein GESPEICHERTER Wert, kein aus bundesland+segment ableitbarer.
-- Die Kuerzel-Zuordnung (16 Bundeslaender, 4 Segmente, Wellennummer) im Code
-- nachzubauen waere Duplikation, die bei der naechsten Welle lautlos driftet.
--
-- Signaturwechsel: RETURNS TABLE aendert sich, deshalb DROP und Neuanlage.
-- p_limit DEFAULT 50 bleibt (20260902170409), Anredelogik bleibt (20260902173611).

DROP FUNCTION IF EXISTS public.get_due_second_mailings(integer);

CREATE OR REPLACE FUNCTION public.get_due_second_mailings(p_limit integer DEFAULT 50)
 RETURNS TABLE(scheduled_mailing_id uuid, deal_id uuid, deal_title text, contact_id uuid, first_name text, last_name text, anrede text, anrede_final text, email text, outreach_hook text, company_name text, bundesland text, segment text, utm_campaign text)
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
    d.segment,
    k.utm_campaign
  FROM scheduled_mailings sm
  JOIN deals d ON d.id = sm.deal_id
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
    AND NOT EXISTS (
      SELECT 1 FROM marketing_opt_out mo
      WHERE mo.email_normalized = lower(btrim(c.email))
    )
  ORDER BY sm.scheduled_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_due_second_mailings(integer) IS
  'Faellige Nachfassmails, gedeckelt (DEFAULT 50). Liefert anrede_final, company_name, bundesland, segment und utm_campaign. utm_campaign per LATERAL, weil werteraum_kampagnen_plan keinen Unique-Constraint auf (bundesland, segment) hat — ein einfacher JOIN wuerde bei einer zweiten Welle Mailings verdoppeln. Anredelogik wortgleich zu get_werteraum_candidates, beide gemeinsam aendern.';