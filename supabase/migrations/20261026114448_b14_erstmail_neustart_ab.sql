-- <YYYYMMDDHHMMSS> B14 Variante D: Erstmail-Neustart nur nach bewusster Adresskorrektur.
--
-- BEFUND 26.10.2026 (Claude Code, gemessen): korrigiere_mailadresse parkt den Deal in einer
-- Quellstufe, ohne dass je wieder eine Mail rausgeht. Zwei Sperren in get_werteraum_candidates
-- zaehlen jede Mail-Aktivitaet fuer immer:
--   Deal-Filter     NOT EXISTS email-Aktivitaet am Deal       (seit 20260611081711)
--   bereits_bemailt aktuelle Adresse jedes Kontakts einer Firma mit bemailtem Deal (seit 20260809160147)
-- Die korrigierte Adresse faellt damit sofort unter beide Sperren. Die Adressbereinigung vom
-- 10./11.09. lief nur, weil die alten Aktivitaeten von Hand soft-geloescht wurden.
-- 8 Deals hingen am 26.10. fest, dazu 2 ueber Zwillingsdeals.
--
-- ⚠ KORREKTUR ZU 20260910101411: Deren Kopfkommentar ("den Vorgang zurueck in die Strecke") und
-- die Notiz der Funktion ("Die Schule laeuft damit wieder in der Versandstrecke mit") stimmten seit
-- dem 11.06. nur, wenn zusaetzlich die Mail-Aktivitaeten geloescht wurden. Der alte Kommentar bleibt
-- als Beleg stehen; diese Migration ersetzt nur die Funktion.
--
-- WAS SICH AENDERT:
--   deals.erstmail_neustart_ab  Mails VOR diesem Zeitpunkt zaehlen in keiner Erstmail-Sperre.
--   Beide Kandidaten-RPCs        dieselbe Regel an allen drei Stellen, STABLE bleibt.
--   korrigiere_mailadresse       setzt den Neustart am Deal und an Zwillingen derselben Firma,
--                                deren Hauptkontakt die ALTE Adresse traegt — aber NICHT, wenn die
--                                NEUE Adresse schon angeschrieben wurde. Die Notiz meldet das
--                                gemessene Ergebnis (Kandidat ja/nein, Grund) statt eines Versprechens.
--
-- WARUM NICHT LOESCHEN (A), NICHT audit_log (B), NICHT jede Adressaenderung (C):
--   Mail-Aktivitaeten sind Versandbelege und bleiben. Die Sperre faellt nur, wenn ein Mensch
--   bewusst ueber korrigiere_mailadresse korrigiert. Eine Tippkorrektur im CRM oeffnet nichts.
--
-- ⚠ RECHTE: anon und authenticated haben auf deals Tabellenrechte arwdDxtm; die neue Spalte erbt
-- sie. RLS ist an, Policies nur fuer authenticated. Ein angemeldeter CRM-Nutzer kann die Spalte also
-- direkt setzen. Keine neuen Grants in dieser Migration.

ALTER TABLE public.deals ADD COLUMN erstmail_neustart_ab timestamptz NULL;
COMMENT ON COLUMN public.deals.erstmail_neustart_ab IS
  'B14 (26.10.2026): Mail-Aktivitaeten dieses Deals VOR diesem Zeitpunkt zaehlen nicht fuer die Erstmail-Sperren in get_werteraum_candidates und get_fua_schulen_candidates. Gesetzt nur von korrigiere_mailadresse (bewusste Adresskorrektur), nie von Hand. NULL = alle Mails zaehlen.';

CREATE OR REPLACE FUNCTION public.get_werteraum_candidates(p_limit integer DEFAULT 30, p_bundesland text DEFAULT NULL::text, p_segment text DEFAULT 'grundschule'::text, p_domain_cap integer DEFAULT 10)
 RETURNS TABLE(contact_id uuid, first_name text, last_name text, anrede text, anrede_final text, email text, company_name text, outreach_hook text, outreach_email_draft text, outreach_cluster text, outreach_score integer, deal_id uuid, bundesland text, segment text, company_id uuid)
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
                              -- B14 (Variante D): Mails vor einem bewussten Neustart zaehlen nicht.
                              AND da2.created_at >= COALESCE(d2.erstmail_neustart_ab, '-infinity'::timestamptz)
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
          THEN anrede_team_oder_kollegium(co.name)
        WHEN c.anrede = 'Frau' THEN 'Sehr geehrte Frau ' || btrim(c.last_name)
        WHEN c.anrede = 'Herr' THEN 'Sehr geehrter Herr ' || btrim(c.last_name)
        ELSE 'Sehr geehrte/r ' || btrim(btrim(COALESCE(c.first_name,'')) || ' ' || btrim(COALESCE(c.last_name,'')))
      END AS anrede_final,
      c.email, co.name AS company_name, c.outreach_hook, c.outreach_email_draft,
      c.outreach_cluster, c.lead_score AS outreach_score, d.id AS deal_id,
      c.bundesland, d.segment,
      co.id AS company_id,
      COALESCE(d.primary_contact_id = c.id, false) AS ist_hauptkontakt
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
          -- B14 (Variante D): gleiche Regel wie in bereits_bemailt.
          AND da.created_at >= COALESCE(d.erstmail_neustart_ab, '-infinity'::timestamptz)
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
  -- NEU 01.10.2026 (B12): eine Schule = eine Erstmail. Hauptkontakt des Deals gewinnt.
  dedup_deal AS (
    SELECT DISTINCT ON (deal_id) * FROM dedup_email
    ORDER BY deal_id, ist_hauptkontakt DESC, outreach_score DESC NULLS LAST, contact_id
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
    FROM dedup_deal
  )
  SELECT contact_id, first_name, last_name, anrede, anrede_final, email, company_name,
         outreach_hook, outreach_email_draft, outreach_cluster, outreach_score,
         deal_id, bundesland, segment, company_id
  FROM ranked
  WHERE domain_rn <= p_domain_cap
  ORDER BY land_rn, outreach_score DESC NULLS LAST, contact_id
  LIMIT p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_fua_schulen_candidates(p_limit integer DEFAULT 10, p_domain_cap integer DEFAULT 3)
 RETURNS TABLE(contact_id uuid, deal_id uuid, company_name text, first_name text, last_name text, anrede text, anrede_final text, email text, bundesland text, segment text)
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
      AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'
      AND d.segment IN ('weiterfuehrend','beruflich','foerderschule')
      AND c.email IS NOT NULL AND btrim(c.email) <> ''
      AND c.bounce_at IS NULL
      -- 21.10.2026: Positivliste statt Sperrliste. Nur pending ist anschreibbar; jeder
      -- andere Wert (pruefung_schulform, blocked_*, kuenftige Haltewerte) haelt den Versand
      -- auf. Bereits F&A-bemailte Kontakte schliesst zusaetzlich das NOT EXISTS unten aus.
      AND COALESCE(c.outreach_status,'pending') = 'pending'
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

CREATE OR REPLACE FUNCTION public.korrigiere_mailadresse(p_deal_id uuid, p_neue_email text, p_quelle text DEFAULT 'recherche'::text, p_trockenlauf boolean DEFAULT false)
 RETURNS TABLE(ergebnis text, schule text, email_alt text, email_neu text, stufe_alt text, stufe_neu text, hinweis text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id  uuid;
  v_email_alt   text;
  v_schule      text;
  v_bundesland  text;
  v_stufe_alt   text;
  v_stage_neu   uuid;
  v_stufe_neu   text;
  v_hinweis     text := '';
  v_pipeline    uuid;
  -- B14 (Variante D)
  v_company_id  uuid;
  v_segment     text;
  v_deals       uuid[];
  v_neu_bemailt boolean;
  v_kandidat    boolean;
  v_grund       text;
  v_ergebnis    text;
BEGIN
  p_neue_email := lower(btrim(p_neue_email));

  SELECT d.primary_contact_id, c.email, co.name, c.bundesland, ps.name, d.pipeline_id, d.company_id, d.segment
    INTO v_contact_id, v_email_alt, v_schule, v_bundesland, v_stufe_alt, v_pipeline, v_company_id, v_segment
  FROM deals d
  LEFT JOIN contacts c  ON c.id  = d.primary_contact_id
  LEFT JOIN companies co ON co.id = d.company_id
  LEFT JOIN pipeline_stages ps ON ps.id = d.pipeline_stage_id
  WHERE d.id = p_deal_id AND d.deleted_at IS NULL;

  IF v_contact_id IS NULL THEN
    RETURN QUERY SELECT 'FEHLER'::text, NULL::text, NULL::text, p_neue_email,
                        NULL::text, NULL::text,
                        'Deal nicht gefunden oder ohne Hauptkontakt'::text;
    RETURN;
  END IF;

  IF p_neue_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$' THEN
    RETURN QUERY SELECT 'FEHLER'::text, v_schule, v_email_alt, p_neue_email,
                        v_stufe_alt, NULL::text,
                        'Neue Adresse ist keine gueltige Mailadresse'::text;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM marketing_opt_out mo WHERE mo.email_normalized = p_neue_email) THEN
    RETURN QUERY SELECT 'ABGELEHNT'::text, v_schule, v_email_alt, p_neue_email,
                        v_stufe_alt, NULL::text,
                        'Die neue Adresse steht auf der Widerspruchsliste'::text;
    RETURN;
  END IF;

  -- Zielstufe: letzte Quellstufe aus dem Protokoll.
  SELECT ps.id, ps.name INTO v_stage_neu, v_stufe_neu
  FROM audit_log a
  JOIN pipeline_stages ps
    ON ps.id = NULLIF(a.details -> 'old' ->> 'pipeline_stage_id','')::uuid
  WHERE a.entity_id = p_deal_id
    AND a.entity_type = 'deals'
    AND ps.is_outreach_source
    AND ps.pipeline_id = v_pipeline
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_stage_neu IS NULL THEN
    SELECT ps.id, ps.name INTO v_stage_neu, v_stufe_neu
    FROM pipeline_stages ps
    WHERE ps.pipeline_id = v_pipeline AND ps.is_outreach_source
      AND ps.name = CASE
            WHEN v_bundesland = 'NRW'               THEN 'Qualifiziert — NRW'
            WHEN v_bundesland = 'Baden-Württemberg' THEN 'Qualifiziert — BW'
            WHEN v_bundesland = 'Rheinland-Pfalz'   THEN 'Qualifiziert — RLP'
            WHEN v_bundesland = 'Niedersachsen'     THEN 'Qualifiziert — Niedersachsen'
            ELSE 'Identifiziert' END
    LIMIT 1;
    v_hinweis := 'Stufe ueber Bundesland gewaehlt, keine Quellstufe im Protokoll. ';
  END IF;

  IF v_stage_neu IS NULL THEN
    RETURN QUERY SELECT 'FEHLER'::text, v_schule, v_email_alt, p_neue_email,
                        v_stufe_alt, NULL::text,
                        'Keine Quellstufe gefunden — bitte von Hand setzen'::text;
    RETURN;
  END IF;

  -- B14 (Variante D): Erstmail-Neustart nur, wenn die NEUE Adresse noch nie angeschrieben wurde.
  -- Gleiche Zaehlregel wie bereits_bemailt in get_werteraum_candidates (Mails vor einem
  -- Neustart zaehlen nicht). Der korrigierte Kontakt selbst traegt noch die alte Adresse.
  SELECT EXISTS (
    SELECT 1
    FROM contacts c2
      JOIN company_contacts cc2 ON cc2.contact_id = c2.id
      JOIN deals d2 ON d2.company_id = cc2.company_id AND d2.deleted_at IS NULL
      JOIN deal_activities da2 ON da2.deal_id = d2.id AND da2.activity_type = 'email'
                              AND da2.deleted_at IS NULL
                              AND da2.created_at >= COALESCE(d2.erstmail_neustart_ab, '-infinity'::timestamptz)
    WHERE c2.deleted_at IS NULL AND c2.id <> v_contact_id
      AND lower(btrim(c2.email)) = p_neue_email
  ) INTO v_neu_bemailt;

  -- Der Deal selbst und seine Zwillinge: Deals derselben Firma, deren Hauptkontakt die ALTE Adresse traegt.
  SELECT array_agg(d.id ORDER BY d.id) INTO v_deals
  FROM deals d
  JOIN contacts c ON c.id = d.primary_contact_id
  WHERE d.deleted_at IS NULL
    AND (d.id = p_deal_id
         OR (v_company_id IS NOT NULL AND d.company_id = v_company_id
             AND lower(btrim(c.email)) = lower(btrim(v_email_alt))));

  IF p_trockenlauf THEN
    RETURN QUERY SELECT 'TROCKENLAUF'::text, v_schule, v_email_alt, p_neue_email,
                        v_stufe_alt, v_stufe_neu,
                        (v_hinweis ||
                         CASE WHEN v_neu_bemailt
                              THEN 'KEIN Erstmail-Neustart: die neue Adresse wurde schon angeschrieben. '
                              ELSE 'Erstmail-Neustart fuer ' || cardinality(v_deals) || ' Deal(s): ' || array_to_string(v_deals, ', ') || '. ' END ||
                         'Nichts geschrieben.')::text;
    RETURN;
  END IF;

  UPDATE contacts
  SET email           = p_neue_email,
      bounce_at       = NULL,
      bounce_typ      = NULL,
      outreach_status = 'pending',
      updated_at      = now()
  WHERE id = v_contact_id;

  UPDATE deals
  SET pipeline_stage_id = v_stage_neu,
      updated_at        = now()
  WHERE id = p_deal_id;

  IF NOT v_neu_bemailt THEN
    UPDATE deals
    SET erstmail_neustart_ab = now()
    WHERE id = ANY (v_deals);
  END IF;

  -- Gemessen statt versprochen: steht einer der Deals jetzt in einer Kandidaten-RPC?
  SELECT EXISTS (SELECT 1 FROM get_werteraum_candidates(100000, NULL, NULL, 100000) g WHERE g.deal_id = ANY (v_deals))
      OR EXISTS (SELECT 1 FROM get_fua_schulen_candidates(100000, 100000) f WHERE f.deal_id = ANY (v_deals))
    INTO v_kandidat;

  IF v_kandidat THEN
    v_grund := 'Kandidat fuer die Erstmail: ja.';
  ELSIF v_neu_bemailt THEN
    v_grund := 'Kandidat fuer die Erstmail: nein — die neue Adresse wurde schon angeschrieben, kein Neustart gesetzt.';
  ELSIF EXISTS (SELECT 1 FROM contacts c3 WHERE c3.deleted_at IS NULL AND lower(btrim(c3.email)) = p_neue_email
                  AND (c3.bounce_at IS NOT NULL OR c3.outreach_status IN ('bounced','blocked_unklare_adresse','blocked_behoerde','blocked_widerspruch'))) THEN
    v_grund := 'Kandidat fuer die Erstmail: nein — die neue Adresse ist an einem anderen Kontakt gesperrt.';
  ELSIF NOT EXISTS (SELECT 1 FROM werteraum_kampagnen_plan g
                    WHERE g.aktiv AND g.start_datum <= CURRENT_DATE
                      AND g.bundesland = v_bundesland AND g.segment = v_segment) THEN
    v_grund := 'Kandidat fuer die Erstmail: nein — fuer Bundesland/Segment laeuft keine gestartete Kampagne.';
  ELSE
    v_grund := 'Kandidat fuer die Erstmail: nein — Grund nicht ermittelt (z. B. Mail eines anderen Deals derselben Firma). Bitte pruefen.';
  END IF;

  v_ergebnis := CASE WHEN v_kandidat THEN 'KORRIGIERT' ELSE 'KORRIGIERT_OHNE_VERSAND' END;

  INSERT INTO deal_activities (deal_id, activity_type, title, description, created_at)
  VALUES (p_deal_id, 'note',
          'Mailadresse korrigiert',
          'ALT: ' || COALESCE(v_email_alt,'(leer)') || E'\n' ||
          'NEU: ' || p_neue_email || E'\n' ||
          'Quelle: ' || p_quelle || E'\n' ||
          'Stufe: ' || COALESCE(v_stufe_alt,'(unbekannt)') || ' -> ' || v_stufe_neu || E'\n' ||
          'bounce_at und bounce_typ geleert, outreach_status auf pending.' || E'\n' ||
          CASE WHEN v_neu_bemailt THEN 'Erstmail-Neustart: nicht gesetzt.'
               ELSE 'Erstmail-Neustart gesetzt fuer ' || cardinality(v_deals) || ' Deal(s).' END || E'\n' ||
          v_grund,
          now());

  RETURN QUERY SELECT v_ergebnis, v_schule, v_email_alt, p_neue_email,
                      v_stufe_alt, v_stufe_neu, (v_hinweis || v_grund)::text;
END
$function$;
