-- 20260730193911_contact_enrichment_queue_tabelle_und_rpcs
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 34c5cfa00a8d34c4f288849dec660a19 verifiziert.
-- Warteschlange fuer Scoring und Embedding neuer Kontakte.
-- Ersetzt das direkte net.http_post im Trigger auto_score_new_contact. Gruende:
--  1. pg_net feuert pro Zeile. Eine Sammel-Promotion (77 Kontakte am 30.07.) haette
--     77 gleichzeitige Gemini-Calls ausgeloest. Sequenziell lag die Fehlerquote bei
--     0,46 Prozent, parallel deutlich schlechter.
--  2. Der bisherige Trigger nutzt eine EINSCHLUSSliste: nur gmail_intake und
--     cloudtalk_import. eis-bridge, telegram-intake, ssteo_import_v2, cal-inbound und
--     manual fehlen. Jede vergessene Quelle erzeugt unsichtbare Kontakte OHNE Fehlermeldung.
--     Die Queue nimmt alles auf, gefiltert wird erst beim Abholen - eine Regelaenderung
--     braucht dann keinen Trigger-Eingriff mehr.
--  3. Retry wird moeglich. Die 11 Gemini-503 vom 29.07. waeren nachgeholt worden.
CREATE TABLE IF NOT EXISTS public.contact_enrichment_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text,
  quelle       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  processed_at timestamptz,
  CONSTRAINT contact_enrichment_queue_status_chk
    CHECK (status IN ('pending','running','done','failed','skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_enrichment_queue_offen_uidx
  ON public.contact_enrichment_queue (contact_id)
  WHERE status IN ('pending','running');

CREATE INDEX IF NOT EXISTS idx_ceq_status_created
  ON public.contact_enrichment_queue (status, created_at);

ALTER TABLE public.contact_enrichment_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ceq_service_role_all ON public.contact_enrichment_queue;
CREATE POLICY ceq_service_role_all ON public.contact_enrichment_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ceq_authenticated_read ON public.contact_enrichment_queue;
CREATE POLICY ceq_authenticated_read ON public.contact_enrichment_queue
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.contact_enrichment_queue IS
'Warteschlange fuer lead_score und embedding. Der Trigger auf contacts schreibt hier hinein statt direkt HTTP zu feuern; ein n8n-Cron arbeitet sie sequenziell ab. Filterung (Schulen ausschliessen) passiert beim Abholen in get_enrichment_batch, nicht im Trigger.';

-- Abholen: sequenziell, mit Ausschlussregel und Sperre gegen Doppelverarbeitung
CREATE OR REPLACE FUNCTION public.get_enrichment_batch(p_limit integer DEFAULT 20)
RETURNS TABLE (queue_id uuid, contact_id uuid, first_name text, last_name text,
               company text, job_title text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH kand AS (
    SELECT q.id
    FROM contact_enrichment_queue q
    JOIN contacts c ON c.id = q.contact_id
    WHERE q.status = 'pending'
      AND q.attempts < 3
      AND c.deleted_at IS NULL
      -- AUSSCHLUSSliste statt Einschlussliste: Schulen und Kitas brauchen kein Scoring
      AND NOT ('Schule' = ANY(c.tags))
      AND coalesce(c.company,'') !~* '(kindergarten|kindertagesstaette|kita\M|grundschule|mittelschule|realschule|gymnasium)'
      -- nur was wirklich fehlt
      AND (c.embedding IS NULL OR coalesce(c.lead_score,0) = 0)
    ORDER BY q.created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), gesperrt AS (
    UPDATE contact_enrichment_queue q
    SET status = 'running', started_at = now(), attempts = q.attempts + 1
    FROM kand WHERE q.id = kand.id
    RETURNING q.id, q.contact_id
  )
  SELECT g.id, g.contact_id, c.first_name, c.last_name, c.company, c.job_title, c.email
  FROM gesperrt g JOIN contacts c ON c.id = g.contact_id;
END;
$function$;

-- Abschluss: prueft gegen die DB statt HTTP 200 zu glauben
CREATE OR REPLACE FUNCTION public.finish_enrichment(p_queue_id uuid, p_error text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_cid uuid; v_ok boolean; v_att integer;
BEGIN
  SELECT contact_id, attempts INTO v_cid, v_att
  FROM contact_enrichment_queue WHERE id = p_queue_id;
  IF v_cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund','queue_eintrag_unbekannt');
  END IF;

  SELECT (embedding IS NOT NULL AND coalesce(lead_score,0) > 0) INTO v_ok
  FROM contacts WHERE id = v_cid;

  IF v_ok AND p_error IS NULL THEN
    UPDATE contact_enrichment_queue
    SET status='done', processed_at=now(), last_error=NULL WHERE id=p_queue_id;
    RETURN jsonb_build_object('ok', true, 'status','done', 'contact_id', v_cid);
  END IF;

  UPDATE contact_enrichment_queue
  SET status = CASE WHEN v_att >= 3 THEN 'failed' ELSE 'pending' END,
      processed_at = CASE WHEN v_att >= 3 THEN now() ELSE NULL END,
      started_at = NULL,
      last_error = coalesce(p_error, 'embedding oder lead_score nach dem Lauf weiterhin leer')
  WHERE id = p_queue_id;

  RETURN jsonb_build_object('ok', false, 'status', CASE WHEN v_att >= 3 THEN 'failed' ELSE 'retry' END,
                            'contact_id', v_cid, 'versuche', v_att);
END;
$function$;

-- Hängengebliebene running-Eintraege zuruecksetzen (Cron abgebrochen, n8n neugestartet)
CREATE OR REPLACE FUNCTION public.reset_stale_enrichment(p_minuten integer DEFAULT 30)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH r AS (
    UPDATE contact_enrichment_queue
    SET status='pending', started_at=NULL,
        last_error='automatisch zurueckgesetzt: laenger als '||p_minuten||' Minuten in running'
    WHERE status='running' AND started_at < now() - (p_minuten || ' minutes')::interval
    RETURNING id
  ) SELECT count(*)::integer FROM r;
$function$;

GRANT EXECUTE ON FUNCTION public.get_enrichment_batch(integer)  TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_enrichment(uuid,text)   TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stale_enrichment(integer) TO service_role, authenticated;
