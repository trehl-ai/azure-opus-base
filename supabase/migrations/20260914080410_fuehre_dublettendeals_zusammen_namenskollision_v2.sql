-- 14.09.2026: Korrektur an fuehre_dublettendeals_zusammen — Namenskollision.
--
-- Die RETURNS TABLE-Spalten (mail, schule) sind in PL/pgSQL zugleich Variablen
-- und kollidierten mit den gleichnamigen Spalten der inneren Abfrage:
-- "column reference mail is ambiguous". Ausgabespalten deshalb mit Praefix o_,
-- innere Spalte auf bmail umbenannt.
-- DROP noetig, weil sich der Rueckgabetyp aendert.
-- Fachliche Begruendung unveraendert, siehe Migration
-- fuehre_dublettendeals_zusammen.

DROP FUNCTION IF EXISTS public.fuehre_dublettendeals_zusammen(integer, boolean);

CREATE FUNCTION public.fuehre_dublettendeals_zusammen(
  p_limit       integer DEFAULT 10,
  p_trockenlauf boolean DEFAULT true
)
 RETURNS TABLE(
   o_mail text, o_schule text, o_deals bigint,
   o_behalten uuid, o_grund text, o_aktivitaeten bigint,
   o_verworfen text, o_ergebnis text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_verworfen uuid[];
  v_kurz text;
BEGIN
  FOR r IN
    WITH basis AS (
      SELECT lower(btrim(c.email)) AS bmail, d.id AS deal_id, d.company_id,
             COALESCE(c.bundesland,'') AS bl, d.status, d.created_at,
             (SELECT count(*) FROM deal_activities a
                WHERE a.deal_id = d.id AND a.deleted_at IS NULL) AS akt
      FROM contacts c
      JOIN deals d ON d.primary_contact_id = c.id AND d.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
        AND c.email IS NOT NULL AND btrim(c.email) <> ''
        AND d.pipeline_id = '61b1b7e2-0d21-4ec0-a298-6fa12d9eb36e'::uuid
    ),
    gruppen AS (
      SELECT b.bmail,
             count(*)                                   AS deals,
             count(DISTINCT b.company_id)               AS firmen,
             count(DISTINCT b.bl)                       AS laender,
             count(*) FILTER (WHERE b.status <> 'open') AS abgeschlossen,
             count(*) FILTER (WHERE b.akt > 0)          AS deals_mit_akt
      FROM basis b GROUP BY b.bmail HAVING count(*) > 1
    ),
    sicher AS (
      SELECT g.bmail FROM gruppen g
      WHERE g.firmen = 1 AND g.laender <= 1
        AND g.abgeschlossen = 0
        AND g.deals_mit_akt <= 1
    ),
    gewaehlt AS (
      SELECT DISTINCT ON (b.bmail)
             b.bmail, b.deal_id AS behalten, b.akt,
             CASE WHEN b.akt > 0 THEN 'meiste Aktivitaeten'
                  ELSE 'aeltester (alle ohne Aktivitaet)' END AS grund
      FROM basis b JOIN sicher s ON s.bmail = b.bmail
      ORDER BY b.bmail, b.akt DESC, b.created_at ASC, b.deal_id
    )
    SELECT g.bmail, g.behalten, g.akt, g.grund,
           (SELECT count(*) FROM basis x WHERE x.bmail = g.bmail) AS deals,
           (SELECT co.name FROM basis x JOIN companies co ON co.id = x.company_id
              WHERE x.bmail = g.bmail LIMIT 1) AS firmenname,
           ARRAY(SELECT x.deal_id FROM basis x
                 WHERE x.bmail = g.bmail AND x.deal_id <> g.behalten) AS verworfen
    FROM gewaehlt g
    ORDER BY g.bmail
    LIMIT p_limit
  LOOP
    v_verworfen := r.verworfen;
    v_kurz := array_to_string(ARRAY(SELECT left(u::text,8) FROM unnest(v_verworfen) u), ', ');

    IF p_trockenlauf THEN
      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, 'TROCKENLAUF'::text;
    ELSE
      UPDATE deals SET deleted_at = now(), updated_at = now()
      WHERE id = ANY(v_verworfen);

      INSERT INTO deal_activities (deal_id, activity_type, title, description, created_at)
      VALUES (r.behalten, 'note',
        'Dubletten zusammengefuehrt',
        'Diese Adresse trug ' || r.deals || ' Deals in der WerteRaum-Pipeline.' || E'\n' ||
        'BEHALTEN: ' || left(r.behalten::text,8) || ' (' || r.grund ||
        ', ' || r.akt || ' Aktivitaeten)' || E'\n' ||
        'SOFT-GELOESCHT: ' || v_kurz || E'\n' ||
        'Ursache waren zwei Import-Ereignisse am 30.07. und 01./08.08.2026 — gleiche Firma, gleicher Kontakt, neuer Deal.' || E'\n' ||
        'Es ging nie eine Mail doppelt raus; die Versandfunktionen deduplizieren ueber die Adresse. Falsch waren nur die Auswertungen.' || E'\n' ||
        'REVERSIBEL: deleted_at = NULL setzt die verworfenen Deals zurueck.',
        now());

      RETURN QUERY SELECT r.bmail, r.firmenname, r.deals, r.behalten, r.grund, r.akt,
                          v_kurz, 'ZUSAMMENGEFUEHRT'::text;
    END IF;
  END LOOP;
END
$function$;

COMMENT ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) IS
  'Fuehrt Dubletten-Deals in der WerteRaum-Pipeline zusammen. Behaelt den Deal mit den meisten Aktivitaeten, bei Gleichstand den aeltesten — "aeltester" allein waere falsch, weil in 233 von 633 Gruppen die Historie auf dem juengeren Deal liegt. Fasst NUR mechanisch entscheidbare Gruppen an: eine Firma, ein Bundesland, kein abgeschlossener Deal, Aktivitaeten auf hoechstens einem Deal. Der Pipeline-Filter ist die Sicherung: ohne ihn wuerde sie Porsche-, MotelOne- und REWE-Auftraege loeschen. Verworfene Deals werden SOFT-geloescht — bei hartem DELETE gingen deal_finance, deal_installments und scheduled_mailings mit CASCADE mit.';

REVOKE ALL ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) TO service_role;