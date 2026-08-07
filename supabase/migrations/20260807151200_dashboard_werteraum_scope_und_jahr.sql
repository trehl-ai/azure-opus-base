-- Dashboard: WerteRaum-Fokus + korrekte Jahreszahlen
-- ===================================================
-- Die Startseite bekommt einen Umschalter "WerteRaum | Gesamt". Damit alle
-- Bloecke (Kacheln, Top Kunden, Umsatz nach Jahr) denselben Ausschnitt zeigen,
-- nehmen die drei Dashboard-RPCs ab jetzt einen optionalen Pipeline-Filter.
--
-- Warum serverseitig aggregiert wird:
--   PostgREST liefert ohne Fehlermeldung hoechstens 1000 Zeilen. Die alten
--   Client-Summen (useWonTotal, RevenueByYearCard) haetten bei >1000 Zeilen
--   still zu niedrige Betraege angezeigt. Allein die offenen Deals sind
--   aktuell 3.224 Zeilen -- eine Client-Summe waere dort bereits heute falsch.
--
-- Jahresfilter:
--   * "Gewonnen"  -> status='won' UND won_at im Jahr p_won_year.
--                    Nicht ueber pipeline_stage_id: die Stufen sind pro
--                    Pipeline verschieden benannt, status ist die verlaessliche
--                    Quelle.
--   * "Pipeline-Wert" / "Gewichteter Forecast" -> status='open', KEIN
--                    Jahresfilter (Begruendung siehe dort).
--
-- Alle Zaehlungen mit deleted_at IS NULL.

/* ------------------------------------------------------------------ */
/* 1. Hilfsfunktion: haengt ein Kontakt an einer Pipeline?             */
/* ------------------------------------------------------------------ */
CREATE OR REPLACE FUNCTION public.contact_in_pipeline(p_contact_id uuid, p_pipeline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM deals d
    WHERE d.deleted_at IS NULL
      AND d.pipeline_id = p_pipeline_id
      AND d.primary_contact_id = p_contact_id
  ) OR EXISTS (
    SELECT 1
    FROM company_contacts cc
    JOIN deals d ON d.company_id = cc.company_id
    WHERE cc.contact_id = p_contact_id
      AND d.deleted_at IS NULL
      AND d.pipeline_id = p_pipeline_id
  );
$function$;

GRANT EXECUTE ON FUNCTION public.contact_in_pipeline(uuid, uuid)
  TO anon, authenticated, service_role;

/* ------------------------------------------------------------------ */
/* 2. get_dashboard_stats — Kacheln, Lead-Score-Verteilung, Hover      */
/* ------------------------------------------------------------------ */
-- Signaturwechsel: die parameterlose Variante muss weg, sonst ist der
-- PostgREST-Aufruf ohne Argumente zwischen beiden Ueberladungen mehrdeutig.
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, integer);

CREATE FUNCTION public.get_dashboard_stats(
  p_pipeline_id uuid    DEFAULT NULL,   -- NULL = Gesamt (kein Pipeline-Filter)
  p_won_year    integer DEFAULT NULL    -- NULL = alle Jahre
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_won_from date := CASE WHEN p_won_year IS NULL THEN NULL
                          ELSE make_date(p_won_year, 1, 1) END;
  v_won_to   date := CASE WHEN p_won_year IS NULL THEN NULL
                          ELSE make_date(p_won_year + 1, 1, 1) END;
BEGIN
  RETURN json_build_object(
    -- Pipeline-Wert: offene Deals, ALLE Jahre.
    -- Kein Jahresfilter, weil expected_close_date bei 3.208 von 3.224 offenen
    -- Deals leer ist (gemessen 07.08.2026). Ein Jahresfilter ueber dieses Feld
    -- wuerde 99,5 % der Pipeline verschwinden lassen und einen Wert anzeigen,
    -- den niemand als "die Pipeline" wiedererkennt.
    'pipeline_value', (
      SELECT COALESCE(SUM(value_amount), 0)
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    ),
    -- Anzahl der OFFENEN Deals (passend zum Untertitel "offene Deals").
    -- Vorher wurden hier alle Deals gezaehlt, auch gewonnene und verlorene.
    'deal_count', (
      SELECT COUNT(*)
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    ),
    -- Gewonnen: status='won' im Jahresfenster ueber won_at.
    'won_value', (
      SELECT COALESCE(SUM(value_amount), 0)
      FROM deals
      WHERE status = 'won' AND deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
        AND (v_won_from IS NULL OR (won_at >= v_won_from AND won_at < v_won_to))
    ),
    'won_deal_count', (
      SELECT COUNT(*)
      FROM deals
      WHERE status = 'won' AND deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
        AND (v_won_from IS NULL OR (won_at >= v_won_from AND won_at < v_won_to))
    ),
    'won_year', p_won_year,
    'avg_probability', (
      SELECT COALESCE(AVG(probability_percent), 0)::int
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND probability_percent IS NOT NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    ),
    'weighted_probability', (
      SELECT CASE
        WHEN COALESCE(SUM(value_amount), 0) = 0 THEN 0
        ELSE ROUND(SUM(value_amount * probability_percent) / SUM(value_amount))::int
      END
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND probability_percent IS NOT NULL AND value_amount IS NOT NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    ),
    -- Gewichteter Forecast: ebenfalls offen, alle Jahre (gleiche Begruendung).
    'expected_value', (
      SELECT COALESCE(SUM(value_amount * probability_percent / 100), 0)::int
      FROM deals
      WHERE status = 'open' AND deleted_at IS NULL
        AND probability_percent IS NOT NULL AND value_amount IS NOT NULL
        AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id)
    ),
    -- Kontakte/Unternehmen haben selbst keine Pipeline. Im WerteRaum-Ausschnitt
    -- zaehlen deshalb die Kontakte, die an einem Deal dieser Pipeline haengen --
    -- direkt als primary_contact_id oder ueber company_contacts der Firma.
    'contact_count', (
      SELECT COUNT(*) FROM contacts c
      WHERE c.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR public.contact_in_pipeline(c.id, p_pipeline_id))
    ),
    'company_count', (
      SELECT COUNT(*) FROM companies co
      WHERE co.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR EXISTS (
              SELECT 1 FROM deals d
              WHERE d.company_id = co.id AND d.deleted_at IS NULL
                AND d.pipeline_id = p_pipeline_id))
    ),
    'hot_leads', (
      SELECT COUNT(*) FROM contacts c
      WHERE c.lead_score >= 80 AND c.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR public.contact_in_pipeline(c.id, p_pipeline_id))
    ),
    'warm_leads', (
      SELECT COUNT(*) FROM contacts c
      WHERE c.lead_score >= 60 AND c.lead_score < 80 AND c.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR public.contact_in_pipeline(c.id, p_pipeline_id))
    ),
    'medium_leads', (
      SELECT COUNT(*) FROM contacts c
      WHERE c.lead_score >= 40 AND c.lead_score < 60 AND c.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR public.contact_in_pipeline(c.id, p_pipeline_id))
    ),
    'cold_leads', (
      SELECT COUNT(*) FROM contacts c
      WHERE c.lead_score < 40 AND c.deleted_at IS NULL
        AND (p_pipeline_id IS NULL OR public.contact_in_pipeline(c.id, p_pipeline_id))
    ),
    -- pipeline_breakdown ist ein VERGLEICH der Pipelines untereinander und
    -- bleibt deshalb bewusst ungefiltert -- auf eine Pipeline eingeschraenkt
    -- waere das Diagramm ein einzelner Balken und damit sinnlos.
    'pipeline_breakdown', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          p.name,
          COALESCE(SUM(d.value_amount) FILTER (WHERE d.status = 'won'), 0) AS total_value,
          COALESCE(SUM(d.value_amount * d.probability_percent / 100) FILTER (WHERE d.status = 'open'), 0)::int AS weighted_value,
          COUNT(d.id) FILTER (WHERE d.status = 'open') AS deal_count
        FROM pipelines p
        LEFT JOIN deals d ON d.pipeline_id = p.id AND d.deleted_at IS NULL
        GROUP BY p.name
        ORDER BY total_value DESC
      ) t
    ),
    'hover_pipeline_companies', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          c.name AS company_name,
          p.name AS pipeline_name,
          COALESCE(SUM(d.value_amount), 0) AS total_value,
          COUNT(d.id) AS deal_count
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        JOIN pipelines p ON d.pipeline_id = p.id
        WHERE d.status = 'open' AND d.deleted_at IS NULL
          AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
        GROUP BY c.name, p.name
        ORDER BY total_value DESC
        LIMIT 20
      ) t
    ),
    -- Hover der "Gewonnen"-Kachel: gleicher Ausschnitt wie die Kachel selbst,
    -- also inklusive Jahresfenster. Sonst widersprechen sich Zahl und Tooltip.
    'hover_won_companies', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          c.name AS company_name,
          p.name AS pipeline_name,
          COALESCE(SUM(d.value_amount), 0) AS total_value,
          COUNT(d.id) AS deal_count
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        JOIN pipelines p ON d.pipeline_id = p.id
        WHERE d.status = 'won' AND d.deleted_at IS NULL
          AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
          AND (v_won_from IS NULL OR (d.won_at >= v_won_from AND d.won_at < v_won_to))
        GROUP BY c.name, p.name
        ORDER BY total_value DESC
        LIMIT 20
      ) t
    ),
    'hover_probability_companies', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          c.name AS company_name,
          p.name AS pipeline_name,
          COALESCE(SUM(d.value_amount * d.probability_percent / 100), 0)::int AS expected_value,
          AVG(d.probability_percent)::int AS avg_probability,
          COUNT(d.id) AS deal_count
        FROM deals d
        JOIN companies c ON d.company_id = c.id
        JOIN pipelines p ON d.pipeline_id = p.id
        WHERE d.status = 'open' AND d.deleted_at IS NULL
          AND d.probability_percent IS NOT NULL AND d.value_amount IS NOT NULL
          AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
        GROUP BY c.name, p.name
        ORDER BY expected_value DESC
        LIMIT 20
      ) t
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, integer)
  TO anon, authenticated, service_role;

/* ------------------------------------------------------------------ */
/* 3. get_top_kunden_won — jetzt mit Pipeline- und Jahresfilter        */
/* ------------------------------------------------------------------ */
-- Zwei Korrekturen gegenueber der Vorversion:
--   a) deleted_at IS NULL fehlte komplett -- soft-geloeschte Deals zaehlten mit.
--   b) ohne Jahresfilter summierte die Liste ueber alle Jahre und zeigte z. B.
--      MotelOne mit 32 Deals statt der 13 aus 2026.
DROP FUNCTION IF EXISTS public.get_top_kunden_won(int);
DROP FUNCTION IF EXISTS public.get_top_kunden_won(int, uuid, int);

CREATE FUNCTION public.get_top_kunden_won(
  p_limit       int  DEFAULT 8,
  p_pipeline_id uuid DEFAULT NULL,
  p_won_year    int  DEFAULT NULL
)
RETURNS TABLE(company_id uuid, company_name text, won_revenue bigint, won_deals bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.company_id, co.name, SUM(d.value_amount)::bigint, COUNT(*)::bigint
  FROM deals d
  JOIN companies co ON co.id = d.company_id
  WHERE d.status = 'won'
    AND d.deleted_at IS NULL
    AND d.company_id IS NOT NULL
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
    AND (p_won_year IS NULL OR (d.won_at >= make_date(p_won_year, 1, 1)
                            AND d.won_at <  make_date(p_won_year + 1, 1, 1)))
  GROUP BY d.company_id, co.name
  ORDER BY SUM(d.value_amount) DESC NULLS LAST
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.get_top_kunden_won(int, uuid, int)
  TO anon, authenticated, service_role;

/* ------------------------------------------------------------------ */
/* 4. get_revenue_by_year — Umsatz nach Jahr, serverseitig aggregiert  */
/* ------------------------------------------------------------------ */
-- Ersetzt den Client-Select auf deal_revenue_periods (1000-Zeilen-Kappung)
-- und ergaenzt den fehlenden Pipeline-Filter: die View liefert nur den
-- Pipeline-NAMEN, nicht die id -- deshalb der Join zurueck auf deals.
--
-- Zeitachse: umsatz_datum der View, also Rechnungsdatum, ersatzweise geplante
-- Faelligkeit. Wo beides fehlt, faellt die Zeile jetzt auf won_at zurueck
-- statt in den Topf "undatiert" -- so landet kein gewonnener Deal ohne Jahr
-- im Diagramm. created_at wird bewusst NICHT verwendet: alle Deals wurden
-- 2026 migriert, ihr created_at traegt keine fachliche Information.
DROP FUNCTION IF EXISTS public.get_revenue_by_year(uuid);

CREATE FUNCTION public.get_revenue_by_year(p_pipeline_id uuid DEFAULT NULL)
RETURNS TABLE(jahr int, umsatz numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(r.jahr, EXTRACT(YEAR FROM d.won_at)::int) AS jahr,
         SUM(r.betrag)                                      AS umsatz
  FROM deal_revenue_periods r
  JOIN deals d ON d.id = r.deal_id
  WHERE r.deal_status = 'won'
    AND d.deleted_at IS NULL
    AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
  GROUP BY 1
  ORDER BY 1 NULLS LAST;
$function$;

GRANT EXECUTE ON FUNCTION public.get_revenue_by_year(uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
