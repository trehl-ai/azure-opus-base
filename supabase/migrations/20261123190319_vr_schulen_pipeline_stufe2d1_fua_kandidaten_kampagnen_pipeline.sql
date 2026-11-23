-- Baustufe 2d-1: get_fua_schulen_candidates liest die Pipeline aus campaigns.pipeline_id der
-- Kampagne 11da18f2 ("VR Fit & Aktiv — Schulen") statt aus der festen WR-ID 61b1b7e2.
-- Der Umzug nach "Viktoria Rebensburg - Schulen" (ffcb34b3) schaltet allein ueber diese Zeile.
-- Kampagne per ID statt per Name. pipeline_id NULL -> keine Kandidaten (fail closed).
-- Signatur, STABLE, SECURITY DEFINER, search_path und Grants unveraendert (CREATE OR REPLACE
-- behaelt proacl). Aufrufer: n8n uuuW957tpI9ihzKW, DB korrigiere_mailadresse.

CREATE OR REPLACE FUNCTION public.get_fua_schulen_candidates(p_limit integer DEFAULT 10, p_domain_cap integer DEFAULT 3)
 RETURNS TABLE(contact_id uuid, deal_id uuid, company_name text, first_name text, last_name text, anrede text, anrede_final text, email text, bundesland text, segment text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Baustufe 2d: Die Pipeline kommt aus campaigns.pipeline_id der Kampagne
  -- 11da18f2 ("VR Fit & Aktiv — Schulen") statt aus einer festen WR-ID. Der Umzug nach
  -- "Viktoria Rebensburg - Schulen" schaltet allein ueber diese Zeile. pipeline_id NULL
  -- -> keine Kandidaten (fail closed). Kampagne per ID statt per Name.
  WITH kampagne AS (
    SELECT id, pipeline_id FROM campaigns WHERE id = '11da18f2-9ea8-4950-9d2a-42416f0aef39'
  ),
  roh AS (
    SELECT DISTINCT ON (lower(btrim(c.email)))
      c.id AS contact_id, d.id AS deal_id, co.name AS company_name,
      c.first_name, c.last_name, c.anrede,
      CASE
        WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
          OR btrim(c.last_name) ILIKE 'schulleitung'
          -- Siehe Kopfkommentar: bei "Ort, Kurzname" waere die Anrede unlesbar.
          THEN anrede_team_oder_kollegium(co.name)
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
      AND d.pipeline_id = (SELECT k0.pipeline_id FROM kampagne k0)
      AND d.segment IN ('weiterfuehrend','beruflich','foerderschule')
      AND c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      -- 21.10.2026: Positivliste statt Sperrliste. Nur pending ist anschreibbar; jeder
      -- andere Wert (pruefung_schulform, blocked_*, kuenftige Haltewerte) haelt den Versand
      -- auf. Bereits F&A-bemailte Kontakte schliesst zusaetzlich das NOT EXISTS unten aus.
      AND COALESCE(c.outreach_status,'pending') = 'pending'
      AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre
      AND NOT EXISTS (
        SELECT 1 FROM marketing_opt_out mo
        WHERE mo.email_normalized = lower(btrim(c.email))
      )
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities a, kampagne k
        WHERE a.deal_id = d.id AND a.campaign_id = k.id
          AND a.activity_type = 'email' AND a.deleted_at IS NULL
          -- B14 (Variante D): dieselbe Bedeutung wie in get_werteraum_candidates.
          AND a.created_at >= COALESCE(d.erstmail_neustart_ab, '-infinity'::timestamptz)
      )
      -- 26.10.2026 Adresssperre: eine Adresse bekommt die F&A-Erstmail nur einmal,
      -- auch wenn sie an mehreren Deals/Kontakten haengt (Dubletten, Sammelfirmen,
      -- Stadtpostfaecher). Vergleich ueber die aktuelle Kontaktadresse wie bereits_bemailt
      -- in get_werteraum_candidates (Empfaenger steht nicht an der Mail).
      AND NOT EXISTS (
        SELECT 1
        FROM deal_activities a2
        JOIN deals d2 ON d2.id = a2.deal_id
        JOIN contacts c2 ON c2.id = COALESCE(a2.contact_id, d2.primary_contact_id)
        CROSS JOIN kampagne k2
        WHERE a2.campaign_id = k2.id
          AND a2.activity_type = 'email'
          AND a2.deleted_at IS NULL
          AND a2.deal_id <> d.id
          AND a2.created_at >= COALESCE(d2.erstmail_neustart_ab, '-infinity'::timestamptz)
          AND lower(btrim(c2.email)) = lower(btrim(c.email))
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
$function$
;
