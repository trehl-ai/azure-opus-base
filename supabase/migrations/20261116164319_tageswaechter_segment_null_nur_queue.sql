DO $$
DECLARE d text; neu text;
  alt_snip text := 'AND ps.is_outreach_source AND d.segment IS NULL;';
  neu_snip text := E'AND ps.is_outreach_source AND d.segment IS NULL\n     AND EXISTS (SELECT 1 FROM werteraum_school_queue q WHERE q.deal_id = d.id);  -- 16.11.2026: Handdeals ohne Queue-Zeile sind kein Versandausfall (Doing 1a83e5a2)';
BEGIN
  d := pg_get_functiondef('public.wr_tageswaechter'::regproc);
  IF (length(d) - length(replace(d, alt_snip, ''))) / length(alt_snip) <> 1 THEN RAISE EXCEPTION 'Snippet nicht genau 1x'; END IF;
  neu := replace(d, alt_snip, neu_snip);
  EXECUTE neu;
END $$;