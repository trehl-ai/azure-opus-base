-- 15.09.2026: Die Sperre wirkt jetzt ueber die ADRESSE, nicht nur ueber die Zeile.
--
-- BEFUND: Ein Block haengt am KONTAKT. Traegt ein zweiter Kontakt dieselbe
-- Adresse und steht auf pending, laeuft er weiter in den Versand — die Sperre
-- des ersten wirkt nicht.
-- ⚠ INKONSISTENZ IN DERSELBEN FUNKTION: bereits_bemailt sperrt bereits ueber
-- die Adresse (DISTINCT lower(c2.email)). Die Statussperre tat es nicht.
--
-- GEMESSEN am 15.09.: 26 pending-Kontakte auf 21 Adressen erben eine Sperre.
-- Im Betriebslauf und in der BW-Vorschau keiner, weil 19 der 21 Adressen
-- ohnehin in bereits_bemailt stecken — die Zwillingsmail ist also schon raus.
-- ⚠ EIN ECHTER FALL IN DER BAYERN-VORSCHAU ZUM 30.09.: Die Grundschule
-- Bodenmais wuerde ueber schulamt@lra.landkreis-regen.de angeschrieben — eine
-- Adresse, die an der Mittelschule Regen als blocked_behoerde gesperrt ist.
-- Eine Werbemail ans Landratsamt, obwohl die Sperre existiert.
--
-- WELCHE GRUENDE VERERBEN, und warum:
--   bounce_at                 das Postfach nimmt nichts an
--   bounced                   dito
--   blocked_unklare_adresse   die Adresse gehoert nicht der Schule
--   blocked_behoerde          es ist eine Behoerde, keine Schule
--   blocked_widerspruch       der Postfachinhaber hat widersprochen
-- Alle fuenf sind Eigenschaften der ADRESSE. Wer sie ueber eine Zwillingszeile
-- erbt, ist nie zu Recht im Versand.
--
-- ⚠ WELCHE NICHT VERERBEN, und warum:
--   blocked_namenskollision   Eigenschaft der FIRMA — die Adresse kann
--                             tadellos sein, nur die Zuordnung stimmt nicht
--   pruefung_schulform        dito
-- Diese beiden zu vererben wuerde Kandidaten verlieren, die zu Recht drin
-- sind. Heute erbt keiner der 26 eine davon.
--
-- Gegenprobe vor dem Anwenden: Betriebslauf 28, BW grundschule 205,
-- BW foerderschule 27 — erwartet unveraendert; Bayern minus 1.

CREATE OR REPLACE FUNCTION public.get_werteraum_candidates(
  p_limit integer DEFAULT 30,
  p_bundesland text DEFAULT NULL::text,
  p_segment text DEFAULT 'grundschule'::text,
  p_domain_cap integer DEFAULT 10
)
 RETURNS TABLE(contact_id uuid, first_name text, last_name text, anrede text,
               anrede_final text, email text, company_name text, outreach_hook text,
               outreach_email_draft text, outreach_cluster text, outreach_score integer,
               deal_id uuid, bundesland text, segment text, company_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH bereits_bemailt AS (
    -- ACHTUNG: bewusst OHNE companies.deleted_at-Filter.
    -- Diese CTE ist die Sperrliste. Ein Filter wuerde sie verkleinern
    -- und archivierte Firmen erneut anschreibbar machen.
    SELECT DISTINCT lower(c2.email) AS mail
    FROM contacts c2
      JOIN company_contacts cc2 ON cc2.contact_id = c2.id
      JOIN deals d2 ON d2.company_id = cc2.company_id AND d2.deleted_at IS NULL
      JOIN deal_activities da2 ON da2.deal_id = d2.id AND da2.activity_type = 'email'
                              AND da2.deleted_at IS NULL
    WHERE c2.deleted_at IS NULL AND c2.email IS NOT NULL
  ),
  -- NEU 15.09.2026: Sperre ueber die ADRESSE. Nur Gruende, die Eigenschaften
  -- der Adresse sind — nicht blocked_namenskollision oder pruefung_schulform,
  -- die gehoeren zur Firma.
  gesperrte_adressen AS (
    SELECT DISTINCT lower(btrim(c3.email)) AS mail
    FROM contacts c3
    WHERE c3.deleted_at IS NULL
      AND c3.email IS NOT NULL AND btrim(c3.email) <> ''
      AND (c3.bounce_at IS NOT NULL
           OR c3.outreach_status IN ('bounced','blocked_unklare_adresse',
                                     'blocked_behoerde','blocked_widerspruch'))
  ),
  gestartet AS (
    SELECT bundesland, segment
    FROM werteraum_kampagnen_plan
    WHERE aktiv AND start_datum <= CURRENT_DATE
  ),
  cand AS (
    SELECT DISTINCT ON (c.id)
      c.id AS contact_id, c.first_name, c.last_name, c.anrede,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          OR btrim(c.last_name) ILIKE 'schulleitung'
          THEN 'Liebes Team der ' || co.name
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final,
      c.email, co.name AS company_name, c.outreach_hook, c.outreach_email_draft,
      c.outreach_cluster, c.lead_score AS outreach_score, d.id AS deal_id,
      c.bundesland, d.segment,
      co.id AS company_id
    FROM contacts c
      JOIN company_contacts cc ON cc.contact_id = c.id
      JOIN companies co ON co.id = cc.company_id
      JOIN deals d ON d.company_id = co.id
      JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    WHERE d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
      AND ps.is_outreach_source
      AND d.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND co.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND c.outreach_status = 'pending'
      AND c.bounce_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM marketing_opt_out mo
        WHERE mo.email_normalized = lower(btrim(c.email))
      )
      AND (p_segment IS NULL OR d.segment = p_segment)
      AND (p_bundesland IS NULL OR c.bundesland = p_bundesland)
      AND (
        p_bundesland IS NOT NULL
        OR EXISTS (SELECT 1 FROM gestartet g
                   WHERE g.bundesland = c.bundesland AND g.segment = d.segment)
      )
      AND lower(c.email) NOT IN (SELECT mail FROM bereits_bemailt)
      -- NEU 15.09.2026
      AND lower(btrim(c.email)) NOT IN (SELECT mail FROM gesperrte_adressen)
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities da
        WHERE da.deal_id = d.id AND da.activity_type = 'email'
          AND da.deleted_at IS NULL
      )
    -- 15.09.2026: Der Deal des EMPFAENGERS gewinnt, nicht die kleinste UUID.
    ORDER BY c.id, COALESCE(d.primary_contact_id = c.id, false) DESC, d.id
  ),
  valid AS (
    SELECT * FROM cand
    WHERE email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
      AND lower(email) <> 'email@adresse.de'
      AND lower(email) !~ '(muster|platzhalter|example|^test@|noreply|no-reply|dummy)'
  ),
  dedup_email AS (
    SELECT DISTINCT ON (lower(email)) * FROM valid
    ORDER BY lower(email), outreach_score DESC NULLS LAST, contact_id
  ),
  ranked AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY lower(split_part(email,'@',2))
        ORDER BY outreach_score DESC NULLS LAST, contact_id
      ) AS domain_rn,
      row_number() OVER (
        PARTITION BY bundesland
        ORDER BY outreach_score DESC NULLS LAST, contact_id
      ) AS land_rn
    FROM dedup_email
  )
  SELECT contact_id, first_name, last_name, anrede, anrede_final, email, company_name,
         outreach_hook, outreach_email_draft, outreach_cluster, outreach_score,
         deal_id, bundesland, segment, company_id
  FROM ranked
  WHERE domain_rn <= p_domain_cap
  ORDER BY land_rn, outreach_score DESC NULLS LAST, contact_id
  LIMIT p_limit;
$function$;