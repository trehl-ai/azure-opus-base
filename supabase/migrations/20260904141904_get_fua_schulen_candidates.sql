-- 04.09.2026: Kandidatenquelle fuer die Kampagne "VR Fit & Aktiv — Schulen".
--
-- ANLASS: Der Workflow JacgxoNjvk2eTKxl zieht ueber
-- get_vr_stiftungen_candidates, gefiltert auf source='vr-stiftungen-research'
-- und die Stiftungspipeline. Fuer die Schulkampagne liefert das NULL Zeilen —
-- und mit p_limit 30 waere es beim Start das Dreifache der geplanten Menge.
--
-- ZIELGRUPPE: weiterfuehrende, berufliche und Foerderschulen in der
-- WerteRaum-Pipeline. Kampagne 11da18f2-9ea8-4950-9d2a-42416f0aef39.
--
-- ⚠ DIESELBE ZIELGRUPPE WIE "WerteRaum 3.0". Das ist Absicht (Entscheidung Tomi
-- 03.09.): beide Kampagnen schreiben denselben Verteiler an, im Abstand von
-- zwei Monaten. Deshalb entscheidet NICHT "hat schon eine Mail bekommen",
-- sondern "hat eine Mail DIESER Kampagne bekommen" — ueber
-- deal_activities.campaign_id. Genau dafuer sitzt der Kampagnenstempel an der
-- Aktivitaet und nicht am Deal.
--
-- DEDUPLIZIERUNG UEBER DIE ADRESSE, nicht ueber den Deal: 1.117 Deals liegen
-- auf weniger Adressen. Der Versand darf eine Adresse nur einmal anschreiben.
-- DISTINCT ON (mail) mit Sortierung nach aeltestem Deal.
--
-- DOMAIN-DECKEL: hoechstens p_domain_cap Adressen je Domain und Lauf. Ohne ihn
-- gingen bei schule.nrw.de dutzende Mails am selben Tag an denselben Server —
-- das ist der schnellste Weg in eine Ratenbegrenzung.
--
-- KEINE Nachnamenspruefung wie bei den Stiftungen: die dortige Regel schuetzt
-- vor erfundenen Namen aus der KI-Recherche. Die Schuladressen stammen aus
-- Importlisten, und die Anrede kommt aus derselben Fallunterscheidung wie bei
-- WerteRaum ("Liebes Team der ..." wenn kein Name da ist).

CREATE OR REPLACE FUNCTION public.get_fua_schulen_candidates(
  p_limit integer DEFAULT 10,
  p_domain_cap integer DEFAULT 3
)
 RETURNS TABLE(
   contact_id uuid, deal_id uuid, company_name text,
   first_name text, last_name text, anrede text, anrede_final text,
   email text, bundesland text, segment text
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
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
          THEN 'Liebes Team der ' || co.name
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
      -- Hat DIESE Kampagne diesen Deal schon angeschrieben?
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
  'Kandidaten fuer VR Fit & Aktiv — Schulen. Ausschluss ueber deal_activities.campaign_id, NICHT ueber "hat irgendeine Mail bekommen" — die Kampagne teilt sich die Zielgruppe absichtlich mit WerteRaum 3.0, im Abstand von zwei Monaten. Dedupliziert ueber lower(btrim(email)), Domain-Deckel je Lauf. Anredelogik wortgleich zu get_werteraum_candidates.';

REVOKE ALL ON FUNCTION public.get_fua_schulen_candidates(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_fua_schulen_candidates(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_fua_schulen_candidates(integer, integer) TO service_role;