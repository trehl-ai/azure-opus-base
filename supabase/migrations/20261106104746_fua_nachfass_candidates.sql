-- F&A-Nachfass Kandidaten (Bauplan 472f579d, Entscheidungen Tomi 06.11.2026):
-- Klicker drin, berufliche Schulen und weiterfuehrende BE/BB drin (Wording ueber Altersgruppe),
-- Mindestabstand 21 Tage zur F&A-Erstmail, Klicker zuerst, dann aelteste Erstmail.
-- STABLE: schreibt nichts. Zaehlen/Kontrollieren ist gefahrlos.
CREATE OR REPLACE FUNCTION public.get_fua_nachfass_candidates(
  p_limit integer DEFAULT 35,
  p_domain_cap integer DEFAULT 3,
  p_min_tage integer DEFAULT 21)
RETURNS TABLE(deal_id uuid, contact_id uuid, email text, anrede_final text, company_name text,
              segment text, bundesland text, outreach_status text, erst_am timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH fua_erst AS (
    SELECT da.deal_id, COALESCE(da.contact_id, d.primary_contact_id) AS contact_id, min(da.created_at) AS erst_am
    FROM deal_activities da
    JOIN deals d ON d.id = da.deal_id
    WHERE da.deleted_at IS NULL
      AND da.activity_type = 'email'
      AND da.campaign_id = '11da18f2-9ea8-4950-9d2a-42416f0aef39'::uuid   -- VR Fit & Aktiv — Schulen
    GROUP BY 1, 2
  ),
  -- Sperre ueber die ADRESSE (wie get_werteraum_candidates): bounce oder gesperrt an irgendeinem Kontakt.
  gesperrt AS (
    SELECT DISTINCT lower(btrim(c3.email)) AS mail
    FROM contacts c3
    WHERE c3.deleted_at IS NULL AND c3.email IS NOT NULL AND btrim(c3.email) <> ''
      AND (c3.bounce_at IS NOT NULL
           OR c3.outreach_status IN ('bounced','blocked_unklare_adresse','blocked_behoerde','blocked_widerspruch'))
  ),
  cand AS (
    SELECT f.deal_id, c.id AS contact_id, c.email, c.outreach_status, co.name AS company_name,
           d.segment, c.bundesland, f.erst_am,
           CASE
             WHEN COALESCE(NULLIF(btrim(c.first_name),''), NULLIF(btrim(c.last_name),'')) IS NULL
               OR btrim(c.last_name) ILIKE 'schulleitung'
               THEN anrede_team_oder_kollegium(co.name)
             WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
             WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
             ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
           END AS anrede_final
    FROM fua_erst f
    JOIN deals d ON d.id = f.deal_id AND d.deleted_at IS NULL AND d.status = 'open'
    JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
    JOIN contacts c ON c.id = f.contact_id AND c.deleted_at IS NULL
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      AND c.outreach_status IN ('email_sent','link_clicked')          -- Positivliste
      AND ps.name NOT IN ('Antwort erhalten','Terminiert','Angebot erstellt','Verhandlung',
                          'Gewonnen','Verloren','Blacklist','Wiedervorlage')
      AND (co.id IS NULL OR co.deleted_at IS NULL)
      AND f.erst_am < now() - make_interval(days => p_min_tage)
      AND lower(btrim(c.email)) NOT IN (SELECT mail FROM gesperrt)
      AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = lower(btrim(c.email)))
      -- Kein zweiter Kontakt vorhanden: weder WR-Nachfass (die 10 Leck-Schulen 23.-27.10.) noch F&A-Nachfass.
      AND NOT EXISTS (
        SELECT 1 FROM deal_activities x
        WHERE x.deal_id = f.deal_id AND x.deleted_at IS NULL AND x.activity_type = 'email'
          AND (x.sequence_type IN ('2nd_mailing','fua_nachfass') OR x.title ILIKE '2. Mailing%')
      )
  ),
  dedup_email AS (
    SELECT DISTINCT ON (lower(email)) * FROM cand
    ORDER BY lower(email), (outreach_status = 'link_clicked') DESC, erst_am
  ),
  dedup_deal AS (
    SELECT DISTINCT ON (deal_id) * FROM dedup_email
    ORDER BY deal_id, (outreach_status = 'link_clicked') DESC, erst_am
  ),
  ranked AS (
    SELECT *, row_number() OVER (
      PARTITION BY lower(split_part(email,'@',2))
      ORDER BY (outreach_status = 'link_clicked') DESC, erst_am, contact_id) AS domain_rn
    FROM dedup_deal
  )
  SELECT deal_id, contact_id, email, anrede_final, company_name, segment, bundesland, outreach_status, erst_am
  FROM ranked
  WHERE domain_rn <= p_domain_cap
  ORDER BY (outreach_status = 'link_clicked') DESC, erst_am, contact_id
  LIMIT p_limit;
$function$;

-- Datenleck-Regel (29.09.): neue Objekte in public bekommen per Default anon-Grants.
REVOKE ALL ON FUNCTION public.get_fua_nachfass_candidates(integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_fua_nachfass_candidates(integer, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_fua_nachfass_candidates(integer, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_fua_nachfass_candidates(integer, integer, integer) TO service_role;