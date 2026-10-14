-- Der Nachfasslauf (kgFT, 10:00) hielt als EINZIGER Versandweg keine
-- Domain-Kappung ein. Gemessen am 12.10.2026: je 4 Mails an
-- bsfb.hamburg.de, dresdner-schulen.de und t-online.de in einem Lauf,
-- waehrend die beiden 08:00-Laeufe den Cap von 3 punktgenau einhielten.
-- bsfb.hamburg.de ist die Hamburger Schulbehoerde — vier Mails in einer
-- Minute an dasselbe Haus.
--
-- get_werteraum_candidates und get_fua_schulen_candidates kennen
-- p_domain_cap seit Langem; hier fehlte er. Dieselbe Mechanik wird
-- uebernommen: row_number() je Empfaengerdomain, danach das Tageslimit.
--
-- SIGNATURAENDERUNG: Ein zusaetzlicher Parameter erzeugt eine zweite
-- Funktion statt sie zu ersetzen — ein Aufruf mit einem Argument waere
-- danach mehrdeutig. Deshalb DROP und Neuanlage in EINER Migration, und
-- die Grants werden ausdruecklich wiederhergestellt (vorher:
-- authenticated und service_role duerfen EXECUTE, anon NICHT).
-- Der aufrufende Workflow uebergibt nur p_limit; p_domain_cap hat einen
-- Default und muss dort nicht angefasst werden.

DROP FUNCTION IF EXISTS public.get_due_second_mailings(integer);

CREATE OR REPLACE FUNCTION public.get_due_second_mailings(
  p_limit integer DEFAULT 50,
  p_domain_cap integer DEFAULT 3
)
 RETURNS TABLE(scheduled_mailing_id uuid, deal_id uuid, deal_title text, contact_id uuid,
               first_name text, last_name text, anrede text, anrede_final text, email text,
               outreach_hook text, company_name text, bundesland text, segment text,
               utm_campaign text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH faellig AS (
    SELECT
      sm.id AS scheduled_mailing_id,
      d.id  AS deal_id,
      d.title AS deal_title,
      c.id  AS contact_id,
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
      co.name AS company_name,
      c.bundesland,
      d.segment,
      k.utm_campaign,
      sm.scheduled_at,
      -- Rang je Empfaengerdomain, in derselben Reihenfolge, in der auch
      -- ausgeliefert wird. lower(), weil Domains nicht case-sensitiv sind.
      row_number() OVER (
        PARTITION BY lower(split_part(c.email,'@',2))
        ORDER BY sm.scheduled_at ASC, sm.id
      ) AS domain_rn
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
  )
  SELECT scheduled_mailing_id, deal_id, deal_title, contact_id,
         first_name, last_name, anrede, anrede_final, email,
         outreach_hook, company_name, bundesland, segment, utm_campaign
  FROM faellig
  -- NEU 13.10.2026: Domain-Kappung. Wer heute nicht drankommt, bleibt
  -- pending und ruckt beim naechsten Lauf nach.
  WHERE domain_rn <= p_domain_cap
  ORDER BY scheduled_at ASC
  LIMIT p_limit;
$function$;

-- Grants wiederherstellen: DROP nimmt sie mit. Vorher galt
-- postgres=X, authenticated=X, service_role=X — anon ausdruecklich NICHT.
GRANT EXECUTE ON FUNCTION public.get_due_second_mailings(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_second_mailings(integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.get_due_second_mailings(integer, integer) FROM anon;