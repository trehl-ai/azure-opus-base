-- 14.09.2026: Dubletten-Deals zusammenfuehren, eng begrenzt und reversibel.
--
-- ANLASS: 751 Adressen in der WerteRaum-Pipeline tragen mehr als einen Deal.
-- Ursache sind zwei Import-Ereignisse: 426 Gruppen bekamen ihren zweiten Deal
-- am 30.07., 54 am 01.08., 39 am 08.08. — gleiche Firma, gleicher Kontakt,
-- neuer Deal. Kein Schleichprozess.
--
-- ⚠ ES GEHT KEINE MAIL DOPPELT RAUS. Die Versandfunktionen deduplizieren ueber
-- die Adresse. Falsch sind nur die AUSWERTUNGEN. Deshalb ist hier nichts
-- eilig und alles reversibel.
--
-- === WAS DIESE FUNKTION ANFASST, und was bewusst nicht ===
-- NUR Gruppen, bei denen die Entscheidung mechanisch ist:
--   Pipeline = WerteRaum. ⚠ OHNE DIESEN FILTER LOESCHT SIE AUFTRAEGE:
--     aza.ibishaj@porsche.de traegt 9 Deals (Erlebniswelten),
--     kerstin.winkelmann@motel-one.com 30 (Corporate Events),
--     maike.reichel@rewe-group.com 2 — alle mit Wert und deal_finance.
--     Das sind verschiedene Auftraege derselben Ansprechpartnerin, keine
--     Dubletten.
--   EINE Firma, EIN Bundesland.
--   KEIN abgeschlossener Deal in der Gruppe (6 ausgeschlossen). Dort koennte
--     ein Auftrag am falschen Deal haengen — Menschenentscheidung.
--   Aktivitaeten auf HOECHSTENS EINEM Deal (13 ausgeschlossen). Wo Historie
--     auf mehreren liegt, muss sie erst umgehaengt werden.
--
-- DIE REGEL fuer den zu behaltenden Deal: MEISTE AKTIVITAETEN, bei Gleichstand
-- der AELTESTE.
-- ⚠ "Aeltester" allein waere FALSCH: in 233 von 633 Gruppen liegt die Historie
-- auf dem JUENGEREN Deal — der Juni-Import ist leer, der 30.07.-Deal traegt
-- die Mail. Gemessen, nicht vermutet.
--
-- VERWORFENE DEALS werden SOFT-geloescht (deleted_at). ⚠ NIE HART LOESCHEN:
-- deal_finance, deal_installments und scheduled_mailings haengen mit
-- ON DELETE CASCADE daran. Bei einem UPDATE feuern sie nicht.
--
-- p_trockenlauf zeigt an, ohne zu schreiben. p_limit begrenzt den Lauf.

CREATE OR REPLACE FUNCTION public.fuehre_dublettendeals_zusammen(
  p_limit       integer DEFAULT 10,
  p_trockenlauf boolean DEFAULT true
)
 RETURNS TABLE(
   mail text, schule text, deals_gesamt bigint,
   behalten_id uuid, behalten_grund text, behalten_aktivitaeten bigint,
   verworfen_ids text, ergebnis text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_verworfen uuid[];
BEGIN
  FOR r IN
    WITH basis AS (
      SELECT lower(btrim(c.email)) AS mail, d.id AS deal_id, d.company_id,
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
      SELECT b.mail,
             count(*)                                   AS deals,
             count(DISTINCT b.company_id)               AS firmen,
             count(DISTINCT b.bl)                       AS laender,
             count(*) FILTER (WHERE b.status <> 'open') AS abgeschlossen,
             count(*) FILTER (WHERE b.akt > 0)          AS deals_mit_akt
      FROM basis b GROUP BY b.mail HAVING count(*) > 1
    ),
    sicher AS (
      SELECT mail FROM gruppen
      WHERE firmen = 1 AND laender <= 1
        AND abgeschlossen = 0
        AND deals_mit_akt <= 1
    ),
    gewaehlt AS (
      SELECT DISTINCT ON (b.mail)
             b.mail, b.deal_id AS behalten, b.akt,
             CASE WHEN b.akt > 0 THEN 'meiste Aktivitaeten'
                  ELSE 'aeltester (alle ohne Aktivitaet)' END AS grund
      FROM basis b JOIN sicher s ON s.mail = b.mail
      ORDER BY b.mail, b.akt DESC, b.created_at ASC, b.deal_id
    )
    SELECT g.mail, g.behalten, g.akt, g.grund,
           (SELECT count(*) FROM basis x WHERE x.mail = g.mail) AS deals,
           (SELECT co.name FROM basis x JOIN companies co ON co.id = x.company_id
              WHERE x.mail = g.mail LIMIT 1) AS schule,
           ARRAY(SELECT x.deal_id FROM basis x
                 WHERE x.mail = g.mail AND x.deal_id <> g.behalten) AS verworfen
    FROM gewaehlt g
    ORDER BY g.mail
    LIMIT p_limit
  LOOP
    v_verworfen := r.verworfen;

    IF p_trockenlauf THEN
      RETURN QUERY SELECT r.mail, r.schule, r.deals, r.behalten, r.grund, r.akt,
                          array_to_string(ARRAY(SELECT left(u::text,8) FROM unnest(v_verworfen) u), ', '),
                          'TROCKENLAUF'::text;
    ELSE
      UPDATE deals SET deleted_at = now(), updated_at = now()
      WHERE id = ANY(v_verworfen);

      INSERT INTO deal_activities (deal_id, activity_type, title, description, created_at)
      VALUES (r.behalten, 'note',
        'Dubletten zusammengefuehrt',
        'Diese Adresse trug ' || r.deals || ' Deals in der WerteRaum-Pipeline.' || E'\n' ||
        'BEHALTEN: ' || left(r.behalten::text,8) || ' (' || r.grund ||
        ', ' || r.akt || ' Aktivitaeten)' || E'\n' ||
        'SOFT-GELOESCHT: ' || array_to_string(ARRAY(SELECT left(u::text,8) FROM unnest(v_verworfen) u), ', ') || E'\n' ||
        'Ursache waren zwei Import-Ereignisse am 30.07. und 01./08.08.2026 — gleiche Firma, gleicher Kontakt, neuer Deal.' || E'\n' ||
        'Es ging nie eine Mail doppelt raus; die Versandfunktionen deduplizieren ueber die Adresse. Falsch waren nur die Auswertungen.' || E'\n' ||
        'REVERSIBEL: deleted_at = NULL setzt die verworfenen Deals zurueck.',
        now());

      RETURN QUERY SELECT r.mail, r.schule, r.deals, r.behalten, r.grund, r.akt,
                          array_to_string(ARRAY(SELECT left(u::text,8) FROM unnest(v_verworfen) u), ', '),
                          'ZUSAMMENGEFUEHRT'::text;
    END IF;
  END LOOP;
END
$function$;

COMMENT ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) IS
  'Fuehrt Dubletten-Deals in der WerteRaum-Pipeline zusammen. Behaelt den Deal mit den meisten Aktivitaeten, bei Gleichstand den aeltesten — "aeltester" allein waere falsch, weil in 233 von 633 Gruppen die Historie auf dem juengeren Deal liegt. Fasst NUR mechanisch entscheidbare Gruppen an: eine Firma, ein Bundesland, kein abgeschlossener Deal, Aktivitaeten auf hoechstens einem Deal. Der Pipeline-Filter ist die Sicherung: ohne ihn wuerde sie Porsche-, MotelOne- und REWE-Auftraege loeschen, die als mehrere Deals derselben Ansprechpartnerin gefuehrt werden. Verworfene Deals werden SOFT-geloescht — bei hartem DELETE wuerden deal_finance, deal_installments und scheduled_mailings mit CASCADE mitgehen.';

REVOKE ALL ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.fuehre_dublettendeals_zusammen(integer, boolean) TO service_role;