-- 04.09.2026: Liegezeit nicht mehr aus deals.updated_at rechnen.
--
-- WARUM DIE ERSTE FASSUNG FALSCH WAR, gemessen:
-- deals.updated_at wird von manchen Schreibpfaden gesetzt und von anderen nicht.
--   deals      5.077 Zeilen, 2.346 mit updated_at = created_at  (46,2 %)
--   companies  4.273 Zeilen, 3.839                              (89,8 %)
--   contacts   5.678 Zeilen, 1.608                              (28,3 %)
-- Das ist schlimmer als ein leeres Feld, weil es plausibel aussieht.
-- Folge in der ersten Fassung von get_aktionsliste: zwei Vorgaenge wurden mit
-- "121 Tage" ausgewiesen, die drei Tage vorher von Hand bearbeitet worden waren
-- (Kinder- und Jugendstiftung, GHM Handwerksmessen, beide am 01.09.).
--
-- audit_log ALLEIN taugt ebenfalls nicht: am 07.08. lief ein Massenvorgang ueber
-- viele Deals, deshalb zeigte die ganze 53-Tage-Gruppe einheitlich 28 Tage.
-- Ein Skript ist keine Bearbeitung.
--
-- DER BELASTBARE MASSSTAB ist die letzte audit_log-Zeile MIT user_id — eine
-- Handlung eines Menschen. Skriptzeilen tragen user_id NULL (belegt: 329
-- Firmenwechsel im audit_log, alle ohne user_id).
--
-- wartet_seit = der spaetere von beiden:
--   letzte menschliche Aktion   (dann wartet man auf die Gegenseite)
--   letzte eingehende Reaktion  (dann wartet die Gegenseite auf uns)
-- Fallback auf created_at, wenn es keine von beiden gibt.
--
-- NEU: nie_bearbeitet zeigt Vorgaenge OHNE jede menschliche Audit-Zeile. Das ist
-- der schaerfere Befund als eine hohe Tageszahl — bei vier der 25 Vorgaenge hat
-- NIEMAND je von Hand etwas getan, darunter eine Schule, die inhaltlich
-- geantwortet hat (6. Grundschule Dresden, Antwort vom 28.08.).
--
-- Signaturwechsel: RETURNS TABLE aendert sich (wartet_seit statt letzte_bewegung,
-- neu nie_bearbeitet), deshalb DROP und Neuanlage.

DROP FUNCTION IF EXISTS public.get_aktionsliste(integer);

CREATE OR REPLACE FUNCTION public.get_aktionsliste(p_limit integer DEFAULT 100)
 RETURNS TABLE(
   deal_id uuid, deal_title text, company_id uuid, company_name text,
   pipeline_id uuid, pipeline_name text, stage_name text, stage_position integer,
   owner_user_id uuid, owner_name text,
   value_amount numeric, wartet_seit date, liegetage integer, nie_bearbeitet boolean,
   letzte_antwort date, antwort_text text,
   contact_id uuid, kontakt_name text, kontakt_email text, bundesland text
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH basis AS (
    SELECT
      d.id, d.title, d.company_id, d.pipeline_id, d.owner_user_id,
      d.value_amount, d.created_at, d.primary_contact_id, d.pipeline_stage_id,
      (SELECT max(a.created_at) FROM audit_log a
         WHERE a.entity_id = d.id AND a.user_id IS NOT NULL) AS mensch,
      (SELECT max(a.created_at) FROM deal_activities a
         WHERE a.deal_id = d.id AND a.deleted_at IS NULL
           AND a.activity_type IN ('email_reply','link_click')) AS eingang
    FROM deals d
    WHERE d.deleted_at IS NULL AND d.status = 'open'
  )
  SELECT
    b.id, b.title, co.id, co.name,
    p.id, p.name, ps.name, ps.position,
    b.owner_user_id,
    btrim(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),
    b.value_amount,
    GREATEST(COALESCE(b.mensch, b.created_at), COALESCE(b.eingang, b.created_at))::date,
    (CURRENT_DATE - GREATEST(COALESCE(b.mensch, b.created_at), COALESCE(b.eingang, b.created_at))::date)::integer,
    (b.mensch IS NULL),
    (SELECT max(a.created_at)::date FROM deal_activities a
      WHERE a.deal_id = b.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL),
    (SELECT left(a.description, 400) FROM deal_activities a
      WHERE a.deal_id = b.id AND a.activity_type = 'email_reply' AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC LIMIT 1),
    c.id,
    btrim(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')),
    c.email,
    c.bundesland
  FROM basis b
  JOIN pipeline_stages ps ON ps.id = b.pipeline_stage_id AND ps.braucht_aktion
  JOIN pipelines p ON p.id = b.pipeline_id
  LEFT JOIN companies co ON co.id = b.company_id AND co.deleted_at IS NULL
  LEFT JOIN contacts c ON c.id = b.primary_contact_id AND c.deleted_at IS NULL
  LEFT JOIN users u ON u.id = b.owner_user_id
  WHERE public.user_can_access_pipeline(b.pipeline_id)
  ORDER BY (b.mensch IS NULL) DESC,
           GREATEST(COALESCE(b.mensch, b.created_at), COALESCE(b.eingang, b.created_at)) ASC
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.get_aktionsliste(integer) IS
  'Offene Vorgaenge in Stufen mit braucht_aktion. liegetage NICHT aus deals.updated_at — das Feld ist bei 46 Prozent der Deals tot und sieht trotzdem plausibel aus. Quelle ist die letzte audit_log-Zeile MIT user_id (menschliche Handlung, Skripte tragen NULL) beziehungsweise die letzte eingehende Reaktion, je nachdem was spaeter ist. nie_bearbeitet=true heisst: keine einzige menschliche Audit-Zeile. Respektiert user_can_access_pipeline().';