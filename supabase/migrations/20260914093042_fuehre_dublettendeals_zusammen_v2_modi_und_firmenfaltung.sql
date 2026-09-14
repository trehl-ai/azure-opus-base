-- 14.09.2026: fuehre_dublettendeals_zusammen v2 — zwei neue Modi und
-- Firmenfaltung. Entwurf von Claude Code, md5 29fc8914ae0a7d8b8059f7301d582306.
--
-- MODI (p_modus):
--   'sicher'         wie bisher: eine Firma, ein Bundesland, kein Abschluss,
--                    hoechstens ein Deal mit Aktivitaeten. Schluessel = Adresse.
--   'gleiche_firma'  Schluessel = Adresse + company_id. Fasst nur Deals
--                    zusammen, die dieselbe Firma UND dieselbe Adresse tragen —
--                    entscheidet NICHTS ueber Schulidentitaet und ist deshalb
--                    auch in Sammeladress-Gruppen sicher.
--   'gleiche_schule' Schluessel = Adresse, Firmen werden in die Gewinner-Firma
--                    gefaltet. NUR mit p_mails aus der Sichtpruefung. Ohne
--                    p_mails bricht die Funktion ab — hier gibt es bewusst
--                    keine Heuristik.
--
-- ⚠ WARUM KEINE HEURISTIK: Mein Wortschnitt (gemeinsames Wort mit 4+ Zeichen
-- nach Entfernen der Schulform-Woerter) war bei 94 Gruppen nur 65-mal richtig.
-- 17 vermeintliche Namensvarianten sind VERSCHIEDENE Schulen — das gemeinsame
-- Wort war der ORTSNAME. "Grundschule Neustadt" und "Realschule Neustadt"
-- teilen ein Wort und sind zwei Schulen.
--
-- GEWINNERWAHL, in dieser Reihenfolge:
--   1. Deal mit E-Mail-Aktivitaet (die Beziehung existiert dort)
--   2. Deal mit Firma vor Deal ohne Firma (ohne Firma ist er fuer
--      get_werteraum_candidates unsichtbar)
--   3. versandfaehiger Kontakt vor gesperrtem, UNABHAENGIG von der
--      Aktivitaetszahl — das behebt die Schwaeche des Laufs von heute frueh,
--      wo in 3 von 611 Faellen der gesperrte Zwilling behalten wurde
--   4. meiste Aktivitaeten
--   5. aeltester Deal
-- Stufe 1 steht bewusst vor Stufe 3: bei info@gms-roding.de traegt der
-- email_sent-Deal 12 Aktivitaeten, der pending-Zwilling ist leer. Den
-- pending-Zwilling zu behalten wuerde die Historie verstecken, und mailbar ist
-- die Adresse ohnehin nicht mehr. Gemessen: in allen 38 Gruppen mit
-- Aktivitaeten-Deal widersprechen sich Stufe 1 und 3 nie.
--
-- INVARIANTEN, alle gemessen mit 0 Verstoessen in den 94 Gruppen:
--   0 Aktivitaeten beruehrt — traegt ein Verlierer welche, wird die Gruppe
--     UEBERSPRUNGEN
--   0 Finanzzeilen beruehrt
--   Firmen mit projects-Zeilen werden nie gefaltet
--   Abschluss-Schutz (status <> 'open') gilt IMMER auf Adressebene, auch im
--     Modus gleiche_firma
--
-- ⚠ WAECHTER 4 (Frische) ist der wichtigste Teil: die FOR-Abfrage ist ein
-- Schnappschuss vom Laufbeginn. Teilen sich zwei Gruppen Firmen — die
-- Broetzinger Schule steht unter broetzs@pforzheim.de UND
-- broetzs@stadt-pforzheim.de — hat die erste Gruppe die Firmen der zweiten
-- bereits gefaltet, und die zweite wuerde mit veralteten IDs eine
-- soft-geloeschte Firma zum Gewinner machen. Deshalb wird vor jedem Schreiben
-- geprueft, ob Gewinner-Firma, Verlierer-Firmen und verworfene Deals noch
-- unveraendert leben. Uebersprungene Gruppen faengt der naechste Lauf.
--
-- ⚠ NIE HART LOESCHEN: deal_finance, deal_installments und scheduled_mailings
-- haengen mit ON DELETE CASCADE an deals. Ein UPDATE auf deleted_at loest sie
-- nicht aus. Die vier Deal-Trigger reagieren nur auf pipeline_stage_id.
--
-- SIGNATURWECHSEL: CREATE OR REPLACE mit neuer Argumentliste legte eine
-- Ueberladung an und machte Aufrufe mit zwei Argumenten mehrdeutig — deshalb
-- DROP vorweg.

DROP FUNCTION IF EXISTS public.fuehre_dublettendeals_zusammen(integer, boolean);

CREATE OR REPLACE FUNCTION public.fuehre_dublettendeals_zusammen(
  p_limit       integer DEFAULT 10,
  p_trockenlauf boolean DEFAULT true,
  p_modus       text    DEFAULT 'sicher',
  p_mails       text[]  DEFAULT NULL
)
 RETURNS TABLE(o_mail text, o_schule text, o_deals bigint, o_behalten uuid,
               o_grund text, o_aktivitaeten bigint, o_verworfen text,
               o_firmen_verworfen text, o_ergebnis text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_verworfen uuid[];
  v_firmen    uuid[];
  v_kurz      text;
  v_kurz_f    text;
  v_umgehaengt integer;
BEGIN
  IF p_modus NOT IN ('sicher','gleiche_firma','gleiche_schule') THEN
    RAISE EXCEPTION 'p_modus muss sicher | gleiche_firma | gleiche_schule sein, nicht %', p_modus;
  END IF;
  IF p_modus = 'gleiche_schule' AND (p_mails IS NULL OR cardinality(p_mails) = 0) THEN
    RAISE EXCEPTION 'gleiche_schule braucht p_mails — die belegte Liste aus der Sichtpruefung, keine Heuristik';
  END IF;

  FOR r IN
    WITH basis AS (
      SELECT lower(btrim(c.email)) AS bmail, d.id AS deal_id, d.company_id,
             COALESCE(c.bundesland,'') AS bl, d.status, d.created_at,
             (SELECT count(*) FROM deal_activities a
                WHERE a.deal_id = d.id AND a.deleted_at IS NULL) AS akt,
             (SELECT count(*) FROM deal_activities a
                WHERE a.deal_id = d.id AND a.deleted_at IS NULL
                  AND a.activity_type = 'email') AS mails,
             (c.outreach_status = 'pending'
              AND c.bounce_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM marketing_opt_out mo
                              WHERE mo.email_normalized = lower(btrim(c.email)))) AS versandfaehig,
             c.outreach_status
      FROM contacts c
      JOIN deals d ON d.primary_contact_id = c.id AND d.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
        AND c.email IS NOT NULL AND btrim(c.email) <> ''
        AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
        AND (p_mails IS NULL OR lower(btrim(c.email)) = ANY(p_mails))
    ),
    mailgruppe AS (
      SELECT bmail, count(*) FILTER (WHERE status <> 'open') AS abgeschlossen
      FROM basis GROUP BY bmail
    ),
    keyed AS (
      SELECT b.*,
             CASE WHEN p_modus = 'gleiche_firma'
                  THEN b.bmail || '|' || b.company_id::text
                  ELSE b.bmail END AS k
      FROM basis b
      WHERE p_modus <> 'gleiche_firma' OR b.company_id IS NOT NULL
    ),
    gruppen AS (
      SELECT k.k, k.bmail,
             count(*)                                   AS deals,
             count(DISTINCT k.company_id)               AS firmen,
             count(DISTINCT k.bl)                       AS laender,
             count(*) FILTER (WHERE k.akt > 0)          AS deals_mit_akt
      FROM keyed k GROUP BY k.k, k.bmail HAVING count(*) > 1
    ),
    sicher AS (
      SELECT g.k FROM gruppen g JOIN mailgruppe mg ON mg.bmail = g.bmail
      WHERE mg.abgeschlossen = 0
        AND g.laender <= 1
        AND g.deals_mit_akt <= 1
        AND CASE p_modus
              WHEN 'sicher'         THEN g.firmen = 1
              WHEN 'gleiche_firma'  THEN true
              WHEN 'gleiche_schule' THEN g.firmen >= 1
            END
    ),
    gewaehlt AS (
      SELECT DISTINCT ON (k.k)
             k.k, k.bmail, k.deal_id AS behalten, k.company_id, k.akt, k.mails,
             CASE WHEN k.mails > 0        THEN 'Mail-Historie'
                  WHEN k.versandfaehig    THEN 'versandfaehig (pending)'
                  WHEN k.akt > 0          THEN 'meiste Aktivitaeten'
                  ELSE                         'aeltester' END
             || ' [' || COALESCE(k.outreach_status,'?') || ']' AS grund
      FROM keyed k JOIN sicher s ON s.k = k.k
      ORDER BY k.k,
               (k.mails > 0) DESC,
               (k.company_id IS NOT NULL) DESC,
               k.versandfaehig DESC,
               k.akt DESC,
               k.created_at ASC,
               k.deal_id
    )
    SELECT g.k, g.bmail, g.behalten, g.company_id, g.akt, g.grund,
           (SELECT count(*) FROM keyed x WHERE x.k = g.k) AS deals,
           (SELECT co.name FROM companies co WHERE co.id = g.company_id) AS firmenname,
           ARRAY(SELECT x.deal_id FROM keyed x
                 WHERE x.k = g.k AND x.deal_id <> g.behalten) AS verworfen,
           CASE WHEN p_modus = 'gleiche_schule' THEN
             ARRAY(SELECT DISTINCT x.company_id FROM keyed x
                   WHERE x.k = g.k AND x.company_id IS NOT NULL
                     AND x.company_id <> g.company_id)
           ELSE ARRAY[]::uuid[] END AS firmen_verworfen
    FROM gewaehlt g
    ORDER BY g.bmail, g.k
    LIMIT p_limit
  LOOP
    v_verworfen := r.verworfen;
    v_firmen    := r.firmen_verworfen;
    v_kurz   := array_to_string(ARRAY(SELECT left(u::text,8) FROM unnest(v_verworfen) u), ', ');
    v_kurz_f := array_to_string(ARRAY(SELECT left(u::text,8) FROM unnest(v_firmen) u), ', ');

    IF EXISTS (SELECT 1 FROM deal_activities a
               WHERE a.deal_id = ANY(v_verworfen) AND a.deleted_at IS NULL) THEN
      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, v_kurz_f, 'UEBERSPRUNGEN: Aktivitaeten auf Verlierer'::text;
      CONTINUE;
    END IF;

    IF p_modus = 'gleiche_schule' AND r.company_id IS NULL THEN
      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, v_kurz_f, 'UEBERSPRUNGEN: Gewinner ohne Firma'::text;
      CONTINUE;
    END IF;

    IF cardinality(v_firmen) > 0
       AND EXISTS (SELECT 1 FROM projects p WHERE p.company_id = ANY(v_firmen)) THEN
      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, v_kurz_f, 'UEBERSPRUNGEN: projects an Verlierer-Firma'::text;
      CONTINUE;
    END IF;

    IF p_trockenlauf THEN
      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, v_kurz_f, ('TROCKENLAUF ' || p_modus)::text;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM companies WHERE id = r.company_id AND deleted_at IS NOT NULL)
       OR EXISTS (SELECT 1 FROM companies WHERE id = ANY(v_firmen) AND deleted_at IS NOT NULL)
       OR EXISTS (SELECT 1 FROM deals WHERE id = ANY(v_verworfen) AND deleted_at IS NOT NULL) THEN
      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, v_kurz_f, 'UEBERSPRUNGEN: Gruppe im selben Lauf veraendert, erneut laufen lassen'::text;
      CONTINUE;
    END IF;

    UPDATE deals SET deleted_at = now(), updated_at = now()
    WHERE id = ANY(v_verworfen);

    v_umgehaengt := 0;
    IF cardinality(v_firmen) > 0 THEN
      UPDATE deals SET company_id = r.company_id, updated_at = now()
      WHERE company_id = ANY(v_firmen) AND deleted_at IS NULL;
      GET DIAGNOSTICS v_umgehaengt = ROW_COUNT;

      DELETE FROM company_contacts cc
      WHERE cc.company_id = ANY(v_firmen)
        AND EXISTS (SELECT 1 FROM company_contacts w
                    WHERE w.company_id = r.company_id AND w.contact_id = cc.contact_id);
      UPDATE company_contacts SET company_id = r.company_id
      WHERE company_id = ANY(v_firmen);

      UPDATE companies w SET
        website     = COALESCE(NULLIF(w.website,''),
                        (SELECT NULLIF(l.website,'') FROM companies l WHERE l.id = ANY(v_firmen)
                           AND NULLIF(l.website,'') IS NOT NULL ORDER BY l.created_at LIMIT 1)),
        street      = COALESCE(NULLIF(w.street,''),
                        (SELECT NULLIF(l.street,'') FROM companies l WHERE l.id = ANY(v_firmen)
                           AND NULLIF(l.street,'') IS NOT NULL ORDER BY l.created_at LIMIT 1)),
        postal_code = COALESCE(NULLIF(w.postal_code,''),
                        (SELECT NULLIF(l.postal_code,'') FROM companies l WHERE l.id = ANY(v_firmen)
                           AND NULLIF(l.postal_code,'') IS NOT NULL ORDER BY l.created_at LIMIT 1)),
        city        = COALESCE(NULLIF(w.city,''),
                        (SELECT NULLIF(l.city,'') FROM companies l WHERE l.id = ANY(v_firmen)
                           AND NULLIF(l.city,'') IS NOT NULL ORDER BY l.created_at LIMIT 1)),
        schulstufe  = COALESCE(NULLIF(w.schulstufe,''),
                        (SELECT NULLIF(l.schulstufe,'') FROM companies l WHERE l.id = ANY(v_firmen)
                           AND NULLIF(l.schulstufe,'') IS NOT NULL ORDER BY l.created_at LIMIT 1)),
        updated_at  = now()
      WHERE w.id = r.company_id;

      UPDATE companies SET
        deleted_at = now(), updated_at = now(),
        notes = concat_ws(E'\n', NULLIF(notes,''),
                  'Zusammengefuehrt in Firma ' || r.company_id::text
                  || ' am ' || to_char(now(),'YYYY-MM-DD')
                  || ' (fuehre_dublettendeals_zusammen gleiche_schule, Mail ' || r.bmail || ')')
      WHERE id = ANY(v_firmen);
    END IF;

    INSERT INTO deal_activities (deal_id, activity_type, title, description, created_at)
    VALUES (r.behalten, 'note',
      'Dubletten zusammengefuehrt (' || p_modus || ')',
      'Diese Adresse trug ' || r.deals || ' Deals in der WerteRaum-Pipeline'
      || CASE WHEN p_modus = 'gleiche_firma' THEN ' auf derselben Firma.' ELSE '.' END || E'\n'
      || 'BEHALTEN: ' || left(r.behalten::text,8) || ' (' || r.grund || ', ' || r.akt || ' Aktivitaeten)' || E'\n'
      || 'SOFT-GELOESCHT: ' || v_kurz || E'\n'
      || CASE WHEN cardinality(v_firmen) > 0 THEN
           'FIRMEN GEFALTET in ' || left(r.company_id::text,8) || ': ' || v_kurz_f
           || ' (' || v_umgehaengt || ' Deals umgehaengt, company_contacts umgehaengt, Verlierer soft-geloescht)' || E'\n'
         ELSE '' END
      || 'Ursache: mehrere Import-Ereignisse (Juli, 30./31.07., 08.08.2026) legten dieselbe Schule '
      || 'unter Namensvarianten als neue Firma und neuen Deal an.' || E'\n'
      || 'Es ging nie eine Mail doppelt raus; die Versandfunktionen deduplizieren ueber die Adresse.' || E'\n'
      || 'REVERSIBEL: deals.deleted_at = NULL fuer die verworfenen Deals; companies.deleted_at = NULL '
      || 'fuer die gefalteten Firmen; umgehaengte Deals und Kontakte stehen im audit_log.',
      now());

    RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                        v_kurz, v_kurz_f, ('ZUSAMMENGEFUEHRT ' || p_modus)::text;
  END LOOP;
END
$function$;

COMMENT ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean, text, text[]) IS
  'Fuehrt Dubletten-Deals in der WerteRaum-Pipeline zusammen. Drei Modi: sicher (eine Firma je Gruppe), gleiche_firma (Schluessel Adresse+company_id, entscheidet nichts ueber Schulidentitaet und ist auch in Sammeladress-Gruppen sicher), gleiche_schule (faltet Firmen, NUR mit belegter Adressliste — ohne p_mails bricht sie ab). Gewinnerwahl: Mail-Historie, dann Firma vorhanden, dann versandfaehiger Kontakt, dann Aktivitaeten, dann Alter. Waechter 4 prueft vor jedem Schreiben, ob die Gruppe seit dem Schnappschuss unveraendert ist — teilen sich zwei Gruppen Firmen, wuerde die zweite sonst eine soft-geloeschte Firma zum Gewinner machen.';

REVOKE ALL ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean, text, text[]) TO service_role;