-- 04.09.2026: Zwei Luecken zwischen Einplanung und Versand schliessen.
--
-- DER DEFEKT: Zwischen dem Verschieben nach "2. Mailing" und dem tatsaechlichen
-- Versand liegen bis zu 25 Tage. In dieser Zeit prueft nichts, ob sich am
-- Vorgang etwas geaendert hat. Geprueft wurden bisher nur bounce_at, deleted_at
-- und marketing_opt_out.
--
-- FOLGE 1: Eine Schule, die nach der Einplanung ANTWORTET, bekommt trotzdem die
-- Nachfassmail — "vor einigen Wochen habe ich Ihnen vorgestellt ... deshalb
-- melde ich mich noch einmal kurz". An jemanden, der gerade geantwortet hat.
-- Dieselbe Fehlerklasse wie das erfundene Telefonat im alten Text.
--
-- FOLGE 2: Ein Deal kann nach der Einplanung in "Angebot erstellt", "Terminiert"
-- oder "Verloren" wandern und bekommt die Nachfassmail trotzdem. Bei einem
-- laufenden Angebot ist das peinlich, bei einem verlorenen Vorgang schlicht falsch.
--
-- NEU GEPRUEFT, unmittelbar vor dem Versand:
--   c.outreach_status nicht replied / terminated / blocked_*
--   d.status = 'open'  (weder gewonnen noch verloren)
--   die Stufe darf keine Reaktionsstufe sein: nicht Antwort erhalten,
--   Terminiert, Angebot erstellt, Verhandlung, Gewonnen, Verloren, Blacklist
--
-- WARUM NICHT UEBER braucht_aktion: die Spalte markiert Stufen, die eine
-- MENSCHLICHE Reaktion erfordern — das ist eine andere Frage als "hier darf kein
-- Automat mehr senden". Blacklist braucht keine Aktion, darf aber nichts bekommen.
-- Zwei Fragen, zwei Listen, keine ueberladene Spalte.
--
-- Ausserdem: der Deal muss noch in einer Nachfassstufe stehen. Wer laengst
-- weitergezogen ist, bekommt nichts mehr.

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
    -- NEU: hat der Kontakt inzwischen reagiert oder widersprochen?
    AND COALESCE(c.outreach_status,'') NOT IN
        ('replied','terminated','blocked_widerspruch','blocked_behoerde','blocked_unklare_adresse')
    -- NEU: ist der Vorgang inzwischen abgeschlossen?
    AND d.status = 'open'
    -- NEU: steht der Deal noch dort, wo eine zweite Mail hingehoert?
    AND ps.name NOT IN ('Antwort erhalten','Terminiert','Angebot erstellt','Verhandlung',
                        'Gewonnen','Verloren','Blacklist')
    AND NOT EXISTS (
      SELECT 1 FROM marketing_opt_out mo
      WHERE mo.email_normalized = lower(btrim(c.email))
    )
  ORDER BY sm.scheduled_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_due_second_mailings(integer) IS
  'Faellige Nachfassmails, gedeckelt (DEFAULT 50). Prueft UNMITTELBAR VOR DEM VERSAND, ob sich seit der Einplanung etwas geaendert hat: Antwort, Termin, Widerspruch, Abschluss, Stufenwechsel in eine Reaktionsstufe. Ohne diese Pruefungen bekaeme eine Schule, die zwischenzeitlich geantwortet hat, trotzdem die Nachfassmail. Zwischen Einplanung und Versand liegen bis zu 25 Tage. Anredelogik wortgleich zu get_werteraum_candidates.';