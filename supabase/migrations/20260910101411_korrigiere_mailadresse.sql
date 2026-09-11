-- 10.09.2026: Eine Adresse korrigieren und den Vorgang zurueck in die Strecke.
--
-- ANLASS: 60 Kontakte tragen bounce_at, dazu drei Adressen aus
-- Abwesenheitsnotizen, die eine Nachfolgeadresse nennen. Alle sollen nach der
-- Recherche wieder angeschrieben werden.
--
-- ⚠ WARUM EINE FUNKTION UND NICHT DREI UPDATES:
-- Adresse tauschen allein reicht NICHT. bounce_at sperrt den Kontakt in ALLEN
-- Versandfunktionen — get_werteraum_candidates, get_due_second_mailings und
-- get_fua_schulen_candidates pruefen es je einzeln. Wer nur die Adresse
-- aendert, hat eine korrekte Adresse, die nie wieder angeschrieben wird.
-- Vier Felder muessen zusammen: email, bounce_at, bounce_typ, outreach_status.
-- Dazu die Stufe.
--
-- ⚠ DIE STUFE IST NICHT "Identifiziert".
-- Der Versand zieht aus allen Stufen mit ps.is_outreach_source — davon gibt es
-- FUENF, je Bundesland eine (Identifiziert, Qualifiziert — NRW, — BW, — RLP,
-- — Niedersachsen). Wer pauschal nach "Identifiziert" schiebt, reisst eine
-- NRW-Schule aus ihrer Kohorte und sie laeuft in der falschen Welle mit.
-- Diese Funktion stellt die LETZTE Quellstufe wieder her, die der Deal laut
-- audit_log hatte. Findet sie keine, nimmt sie die Stufe passend zum
-- Bundesland und meldet das im Rueckgabewert.
--
-- p_trockenlauf zeigt an, was passieren wuerde, ohne zu schreiben.

CREATE OR REPLACE FUNCTION public.korrigiere_mailadresse(
  p_deal_id     uuid,
  p_neue_email  text,
  p_quelle      text DEFAULT 'recherche',
  p_trockenlauf boolean DEFAULT false
)
 RETURNS TABLE(
   ergebnis text, schule text, email_alt text, email_neu text,
   stufe_alt text, stufe_neu text, hinweis text
 )
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
BEGIN
  p_neue_email := lower(btrim(p_neue_email));

  SELECT d.primary_contact_id, c.email, co.name, c.bundesland, ps.name, d.pipeline_id
    INTO v_contact_id, v_email_alt, v_schule, v_bundesland, v_stufe_alt, v_pipeline
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

  -- Zielstufe: die letzte Quellstufe aus dem audit_log wiederherstellen.
  SELECT ps.id, ps.name INTO v_stage_neu, v_stufe_neu
  FROM audit_log a
  JOIN pipeline_stages ps
    ON ps.id = NULLIF(a.old_data ->> 'pipeline_stage_id','')::uuid
  WHERE a.entity_id = p_deal_id
    AND ps.is_outreach_source
    AND ps.pipeline_id = v_pipeline
  ORDER BY a.created_at DESC
  LIMIT 1;

  -- Kein Eintrag im Protokoll: Stufe ueber das Bundesland waehlen.
  IF v_stage_neu IS NULL THEN
    SELECT ps.id, ps.name INTO v_stage_neu, v_stufe_neu
    FROM pipeline_stages ps
    WHERE ps.pipeline_id = v_pipeline AND ps.is_outreach_source
      AND ps.name = CASE
            WHEN v_bundesland = 'NRW'             THEN 'Qualifiziert — NRW'
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

  IF p_trockenlauf THEN
    RETURN QUERY SELECT 'TROCKENLAUF'::text, v_schule, v_email_alt, p_neue_email,
                        v_stufe_alt, v_stufe_neu,
                        (v_hinweis || 'Nichts geschrieben.')::text;
    RETURN;
  END IF;

  -- Alle vier Felder zusammen. Einzeln waere jedes davon eine stille Sperre.
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

  INSERT INTO deal_activities (deal_id, activity_type, title, description, created_at)
  VALUES (p_deal_id, 'note',
          'Mailadresse korrigiert',
          'ALT: ' || COALESCE(v_email_alt,'(leer)') || E'\n' ||
          'NEU: ' || p_neue_email || E'\n' ||
          'Quelle: ' || p_quelle || E'\n' ||
          'Stufe: ' || COALESCE(v_stufe_alt,'(unbekannt)') || ' -> ' || v_stufe_neu || E'\n' ||
          'bounce_at und bounce_typ geleert, outreach_status auf pending. ' ||
          'Die Schule laeuft damit wieder in der Versandstrecke mit.',
          now());

  RETURN QUERY SELECT 'KORRIGIERT'::text, v_schule, v_email_alt, p_neue_email,
                      v_stufe_alt, v_stufe_neu, NULLIF(v_hinweis,'')::text;
END
$function$;

COMMENT ON FUNCTION public.korrigiere_mailadresse(uuid, text, text, boolean) IS
  'Ersetzt die Mailadresse eines Deals und stellt ihn zurueck in die Versandstrecke. Setzt VIER Felder zusammen: email, bounce_at, bounce_typ, outreach_status — bounce_at allein sperrt den Kontakt sonst dauerhaft in allen Versandfunktionen. Die Zielstufe ist die letzte Quellstufe aus dem audit_log, ersatzweise die zum Bundesland passende: der Versand zieht aus fuenf Stufen mit is_outreach_source, pauschales Schieben nach Identifiziert reisst eine Schule aus ihrer Kohorte. Lehnt Adressen ab, die auf der Widerspruchsliste stehen. p_trockenlauf zeigt an, ohne zu schreiben.';

REVOKE ALL ON FUNCTION public.korrigiere_mailadresse(uuid, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.korrigiere_mailadresse(uuid, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.korrigiere_mailadresse(uuid, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.korrigiere_mailadresse(uuid, text, text, boolean) TO authenticated;