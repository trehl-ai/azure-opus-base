-- 17.09.2026: Die Anrede weicht aus, wo der Firmenname ein Komma traegt.
--
-- BEFUND von Claude Code: Die NRW-Landesliste liefert Firmennamen im Muster
-- "Ort, Kurzname" — "Dortmund, Gym Helmholtz", "Bielefeld, GE Rosenhoehe",
-- "Duesseldorf, KH Itterstr.".
-- Die Anrede baute daraus "Liebes Team der Dortmund, Gym Helmholtz" — DIE
-- ERSTE ZEILE, DIE EINE SCHULLEITUNG LIEST.
-- ⚠ 73 der 747 Kandidaten sind betroffen, 10 davon standen morgen frueh im
-- Versand von 35.
--
-- DIE ANREDE WEICHT AUS, DER NAME BLEIBT:
--   Firmenname enthaelt ", "  ->  "Liebes Kollegium"
--   sonst                     ->  "Liebes Team der <Name>" wie bisher
--
-- ⚠ WARUM NICHT DEN NAMEN REPARIEREN: Ihn umzudrehen waere eine Heuristik auf
-- Schulnamen, und die lag in dieser Woche DREIMAL daneben — beim Wortschnitt
-- der Dubletten (29 von 94 falsch), bei "Regionale Schule" gegen "Grund- und
-- Werkrealschule", und bei der Segmentableitung aus dem Firmennamen.
-- "GE", "KH", "BK", "RS" muessten alle richtig aufgeloest werden, und
-- "KH Itterstr." ist schon als Klartext unklar.
-- Der Name ist ausserdem die Referenz zur Landesliste und haengt an 161
-- Datensaetzen.
--
-- ⚠ WAS DAMIT NICHT GELOEST IST: Der BETREFF traegt dasselbe Muster
-- ("Fit & Aktiv an Dortmund, Gym Helmholtz"). Er wird im Workflow gebaut,
-- nicht hier. Das ist ein eigener Posten.

CREATE OR REPLACE FUNCTION public.get_fua_schulen_candidates(
  p_limit integer DEFAULT 10,
  p_domain_cap integer DEFAULT 3
)
 RETURNS TABLE(contact_id uuid, deal_id uuid, company_name text, first_name text,
               last_name text, anrede text, anrede_final text, email text,
               bundesland text, segment text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH kampagne AS (
    SELECT id FROM campaigns WHERE name = 'VR Fit & Aktiv — Schulen'
  ),
  roh AS (
    SELECT DISTINCT ON (lower(btrim(c.email)))
      c.id AS contact_id, d.id AS deal_id, co.name AS company_name,
      c.first_name, c.last_name, c.anrede,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          OR btrim(c.last_name) ILIKE 'schulleitung'
          -- Siehe Kopfkommentar: bei "Ort, Kurzname" waere die Anrede unlesbar.
          THEN CASE WHEN co.name LIKE '%, %'
                    THEN 'Liebes Kollegium'
                    ELSE 'Liebes Team der ' || co.name END
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final,
      c.email, c.bundesland, d.segment,
      lower(split_part(c.email,'@',2)) AS domain,
      d.created_at
    FROM deals d
    JOIN contacts c ON c.id = d.primary_contact_id AND c.deleted_at IS NULL
    JOIN companies co ON co.id = d.company_id AND co.deleted_at IS NULL
    WHERE d.deleted_at IS NULL
      AND d.status = 'open'
      AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
      AND d.segment IN ('weiterfuehrend','beruflich','foerderschule')
      AND c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      AND COALESCE(c.outreach_status,'pending') NOT IN
          ('replied','terminated','blocked_widerspruch','blocked_behoerde','blocked_unklare_adresse')
      AND NOT EXISTS (
        SELECT 1 FROM marketing_opt_out mo
        WHERE mo.email_normalized = lower(btrim(c.email))
      )
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities a, kampagne k
        WHERE a.deal_id = d.id AND a.campaign_id = k.id
          AND a.activity_type = 'email' AND a.deleted_at IS NULL
      )
    ORDER BY lower(btrim(c.email)), d.created_at ASC
  ),
  gedeckelt AS (
    SELECT *, row_number() OVER (PARTITION BY domain ORDER BY created_at ASC) AS domain_rn
    FROM roh
  )
  SELECT contact_id, deal_id, company_name, first_name, last_name,
         anrede, anrede_final, email, bundesland, segment
  FROM gedeckelt
  WHERE domain_rn <= p_domain_cap
  ORDER BY created_at ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_fua_schulen_candidates(integer, integer) IS
  'Kandidaten fuer VR Fit & Aktiv Schulen, alle drei Segmente (weiterfuehrend, beruflich, foerderschule). Seit 17.09.2026: bei Firmennamen mit Komma ("Dortmund, Gym Helmholtz" aus der NRW-Landesliste) lautet die Anrede "Liebes Kollegium" statt "Liebes Team der ...". Der Name bleibt unangetastet — ihn umzudrehen waere eine Heuristik auf Schulnamen, und die lag in derselben Woche dreimal daneben. ⚠ Der BETREFF traegt dasselbe Muster und wird im Workflow gebaut, nicht hier.';